import {
  Scenario,
  fieldSide,
  position,
  type ActionType,
  type PlayerType,
  type ScenarioType,
} from "./model.ts";
import type { ProtectionResult, DefenseCoverage } from "./protection.ts";
import type { ZoneResult } from "./zone.ts";
import { ravensProfile } from "./ravens-catalog.ts";

export const opponentTiming = {
  dlMaxSpeed: 2.6,
  lbMaxSpeed: 3.5,
  dbMaxSpeed: 4.1,
  passReadDelay: 0.45,
  runReadDelay: 0.6,
  screenReadDelay: 1.15,
};
type Point = [number, number];
type OpponentScenario = ScenarioType & {
  opponent?: { id: string; mode: "adaptive" | "source" };
};
type Plan = ProtectionResult | ZoneResult;
const linePositions = ["LT", "LG", "C", "RG", "RT"];
const isDB = (p: PlayerType) => ["CB", "SS", "FS", "DB", "S"].includes(p.pos);
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
function bounded(from: Point, to: Point, length: number): Point {
  const d = distance(from, to);
  return d <= length
    ? [...to]
    : [
        from[0] + ((to[0] - from[0]) * length) / d,
        from[1] + ((to[1] - from[1]) * length) / d,
      ];
}
function mean(points: Point[], fallback: Point): Point {
  return points.length
    ? [
        points.reduce((n, p) => n + p[0], 0) / points.length,
        points.reduce((n, p) => n + p[1], 0) / points.length,
      ]
    : fallback;
}
/**
 * A finite delayed observer: every reaction segment reads OFF positions only at
 * segment start minus the role's delay. OFF routes and initial alignments never change.
 * The 1.5 speed factor compensates for the existing smoothstep interpolation.
 */
export function reactOpponent<T extends Plan>(plan: T): T {
  const original = plan.scenario as OpponentScenario,
    opponent = original.opponent;
  if (!opponent || opponent.mode === "source") return plan;
  const s = structuredClone(original),
    snap = s.steps[0]?.end ?? 1.1,
    finish = Math.max(snap + 0.1, ...s.steps.map((step) => step.end)),
    field = fieldSide(s) === "right" ? 1 : -1;
  let kind = s.zone?.enabled
    ? "zone"
    : s.protection?.enabled
      ? "pass"
      : "source-special";
  if (s.ravens)
    try {
      kind = ravensProfile(s.ravens.id).kind;
    } catch {
      /* A custom imported Ravens id can still use its selected block mode. */
    }
  if (s.ravens?.blocking === "inside" || s.ravens?.blocking === "outside")
    kind = "zone";
  if (s.ravens?.blocking === "pass") kind = "pass";
  const isPass =
      ["pass", "rollout", "pass-wrap"].includes(kind) ||
      s.ravens?.blocking === "pass",
    screen = kind === "screen",
    option = kind === "speed-option",
    tush = kind === "tushpush",
    counter = [
      "gt-counter",
      "ct-counter",
      "dart",
      "trap3",
      "trap5",
      "source-special",
    ].includes(kind);
  const qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB"),
    rb = s.players.find((p) => p.side === "OFF" && p.pos === "RB"),
    offense = s.players.filter((p) => p.side === "OFF"),
    defenders = s.players.filter((p) => p.side === "DEF");
  const center =
    s.players.find((p) => p.side === "OFF" && p.pos === "C")?.at[0] ?? 0;
  const manual = new Set(
    s.actions
      .filter(
        (a) =>
          (!a.source || a.source === "manual") &&
          defenders.some((p) => p.id === a.player),
      )
      .map((a) => a.player),
  );
  const scripted = s.actions.filter(
    (a) => a.source === "opponent" && a.kind !== "opponent-reactive",
  );
  const scriptIds = new Set(scripted.map((a) => a.player));
  const active = defenders.filter(
    (p) =>
      !manual.has(p.id) &&
      p.intent !== "hold" &&
      p.intent !== "show" &&
      p.reaction !== "hold",
  );
  // Explicitly authored paths survive byte-for-byte. Existing team contact tracks are
  // replaced for adaptive players, while the imported opening is retained as a landmark.
  s.actions = s.actions.filter(
    (a) => offense.some((p) => p.id === a.player) || manual.has(a.player),
  );
  const fixedActions = s.actions.length,
    budget = Math.max(0, 300 - fixedActions),
    slots = Math.max(0, Math.floor(budget / Math.max(1, active.length))),
    segments = Math.max(0, Math.min(18, slots - 1));
  const sourceView = {
    ...original,
    actions: [
      ...original.actions.filter(
        (a) =>
          offense.some((p) => p.id === a.player) ||
          (defenders.some((p) => p.id === a.player) &&
            (!a.source || a.source === "manual")),
      ),
      ...scripted,
    ],
  };
  const receivers = offense.filter(
    (p) =>
      !linePositions.includes(p.pos) &&
      p.pos !== "QB" &&
      s.actions.some(
        (a) =>
          a.player === p.id &&
          a.label !== "motion" &&
          a.assignment !== "watch" &&
          !/pickup|handoff|mesh|fake|push/.test(a.label),
      ),
  );
  const selectedReceivers = new Set<string>(),
    receiverByDef = new Map<string, string>();
  // CB matches are based on the starting matchup, never the receiver's future route.
  for (const d of [...active].sort(
    (a, b) =>
      (a.pos === "CB" ? -1 : 0) - (b.pos === "CB" ? -1 : 0) ||
      a.at[0] - b.at[0],
  )) {
    if (!isDB(d) || d.intent === "blitz") continue;
    const candidates = receivers
      .filter((p) => !selectedReceivers.has(p.id))
      .sort(
        (a, b) => Math.abs(a.at[0] - d.at[0]) - Math.abs(b.at[0] - d.at[0]),
      );
    const receiver =
      candidates[0] ??
      [...receivers].sort(
        (a, b) => Math.abs(a.at[0] - d.at[0]) - Math.abs(b.at[0] - d.at[0]),
      )[0];
    if (receiver) {
      receiverByDef.set(d.id, receiver.id);
      selectedReceivers.add(receiver.id);
    }
  }
  type Owner = {
    player: string;
    from: number;
    until: number;
    priority: number;
  };
  const owners = new Map<string, Owner[]>(),
    assignmentByDef = new Map<string, string>(),
    engaged = new Set<string>();
  const appendOwner = (target: string | undefined, owner: Owner) => {
    if (!target) return;
    owners.set(target, [...(owners.get(target) ?? []), owner]);
  };
  for (const a of plan.assignments) {
    if (a.type === "watch" || !offense.some((p) => p.id === a.player)) continue;
    const releaseAt = a.release
      ? Math.min(
          ...s.actions
            .filter((x) => x.player === a.player && x.target === a.release)
            .map((x) => x.start),
          finish,
        )
      : finish;
    const covered = "covered" in a && a.covered;
    appendOwner(a.target, {
      player: a.player,
      from: snap,
      until: a.release ? releaseAt : finish,
      priority: covered ? 0 : a.release ? 2 : 1,
    });
    appendOwner(a.release, {
      player: a.player,
      from: releaseAt,
      until: finish,
      priority: 1,
    });
  }
  for (const [target, list] of owners) {
    list.sort((a, b) => a.priority - b.priority);
    assignmentByDef.set(target, list[0].player);
  }
  const pullers = offense.filter(
    (p) =>
      linePositions.includes(p.pos) &&
      s.actions.some(
        (a) =>
          a.player === p.id &&
          (a.assignment === "pull" ||
            a.kind === "pull" ||
            /pull|wrap|lead/.test(a.label)),
      ),
  );
  const forceDef = active
    .filter((p) => !assignmentByDef.has(p.id) && (p.at[0] - center) * field > 0)
    .sort((a, b) => b.at[0] * field - a.at[0] * field)[0];
  const roles = new Map<string, string>();
  function observed(id: string | undefined, time: number): Point {
    return id ? position(sourceView, id, Math.max(0, time)) : [center, -2];
  }
  function carrierAt(time: number) {
    const explicit = offense.find((p) => p.id === s.ravens?.carrier),
      transfer =
        s.ravens?.transferAt ??
        (s.zone?.enabled
          ? (s.actions.find((a) => a.player === rb?.id && a.label === "mesh")
              ?.end ?? snap + 0.8)
          : snap + 0.8);
    return time < transfer
      ? (qb ?? rb)
      : (explicit ?? (s.zone?.enabled ? rb : qb) ?? rb);
  }
  function gazeAndAim(
    d: PlayerType,
    time: number,
    at: Point,
    delay: number,
  ): { aim: Point; gaze?: string; target?: string; role: string } {
    const read = Math.max(0, time - delay),
      carrier = carrierAt(read),
      runner = observed(carrier?.id, read),
      qbAt = observed(qb?.id, read),
      candidate = (owners.get(d.id) ?? []).find(
        (owner) => read >= owner.from && read <= owner.until,
      ),
      owner = candidate?.player,
      blocker = owner ? observed(owner, read) : undefined;
    const ownerAction = owner
        ? s.actions.find(
            (a) => a.player === owner && read >= a.start && read <= a.end,
          )
        : undefined,
      ownerPhase = ownerAction?.phases?.find(
        (p) => read >= p.start && read <= p.end,
      )?.name;
    const openingPull =
      ownerAction?.assignment === "pull" &&
      (["open", "run"].includes(ownerPhase ?? "") ||
        (/source-pull/.test(ownerAction.label) &&
          ownerPhase !== "gather" &&
          ownerPhase !== "strike"));
    const ownScript = scripted
        .filter((a) => a.player === d.id)
        .sort((a, b) => a.end - b.end),
      landmark = ownScript.at(-1)?.to ?? d.at;
    if (
      blocker &&
      (!isDB(d) || d.intent === "blitz") &&
      !openingPull &&
      (engaged.has(d.id) || distance(at, blocker) <= 1.35)
    ) {
      engaged.add(d.id);
      // Pressure stays on the assigned blocker's front; it never ghosts through the OL
      // just because an imported rush arrow continues into the backfield.
      const side = clamp(
        (d.at[0] - (offense.find((p) => p.id === owner)?.at[0] ?? d.at[0])) *
          0.25,
        -0.28,
        0.28,
      );
      return {
        aim: [blocker[0] + side, blocker[1] + 0.55],
        target: owner,
        gaze: isPass ? qb?.id : carrier?.id,
        role: "pressure",
      };
    }
    const rush =
      d.pos === "DL" ||
      d.intent === "blitz" ||
      ownScript.some((a) => a.kind === "opponent-rush");
    if (isPass && rush)
      return { aim: qbAt, target: qb?.id, gaze: qb?.id, role: "rush" };
    if (isPass) {
      const matched = offense.find((p) => p.id === receiverByDef.get(d.id)),
        receiver = observed(matched?.id, read),
        deep = d.pos === "FS" || d.pos === "SS" || landmark[1] - d.at[1] > 1.4;
      if (isDB(d) && matched && !deep)
        return {
          aim: [
            receiver[0] + Math.sign(center - receiver[0]) * 0.3,
            receiver[1] + 0.6,
          ],
          target: matched.id,
          gaze: matched.id,
          role: "match",
        };
      if (isDB(d)) {
        const nearby = receivers
          .map((p) => ({ p, at: observed(p.id, read) }))
          .filter(
            (x) =>
              Math.abs(x.at[0] - landmark[0]) < 5 &&
              x.at[1] > Math.min(2, landmark[1] - 4),
          );
        const threat = nearby.sort(
          (a, b) => distance(a.at, at) - distance(b.at, at),
        )[0];
        const aim: Point = threat
          ? [
              clamp(threat.at[0], landmark[0] - 3, landmark[0] + 3),
              Math.max(landmark[1] - 0.8, threat.at[1] + 0.8),
            ]
          : [landmark[0], Math.max(d.at[1], landmark[1])];
        return {
          aim,
          target: threat?.p.id,
          gaze: threat?.p.id ?? qb?.id,
          role: "zone",
        };
      }
      const around = receivers
          .map((p) => observed(p.id, read))
          .filter((p) => Math.abs(p[0] - d.at[0]) < 4),
        hook = mean(around, [landmark[0], Math.max(2, landmark[1])]);
      return {
        aim: [
          clamp(hook[0], d.at[0] - 2, d.at[0] + 2),
          clamp(hook[1], 2, Math.max(4, d.at[1] + 1)),
        ],
        gaze: qb?.id,
        role: "zone",
      };
    }
    if (screen && time < snap + opponentTiming.screenReadDelay + 0.6) {
      return {
        aim: [landmark[0], Math.max(d.at[1] - 0.5, landmark[1])],
        gaze: qb?.id,
        role: "screen-read",
      };
    }
    if (option && d.id === forceDef?.id) {
      return {
        aim: [qbAt[0] + field * 0.9, qbAt[1] + 0.15],
        target: qb?.id,
        gaze: qb?.id,
        role: "force",
      };
    }
    if (tush) {
      return {
        aim: [d.at[0] * 0.6 + runner[0] * 0.4, runner[1] + 0.5],
        target: carrier?.id,
        gaze: carrier?.id,
        role: "fit",
      };
    }
    if (screen && !s.ravens?.carrier) {
      const lead = pullers
        .map((p) => ({ p, at: observed(p.id, read) }))
        .filter((x) => (x.at[0] - center) * field > 0)
        .sort((a, b) => b.at[0] * field - a.at[0] * field)[0];
      if (lead)
        return {
          aim: [lead.at[0] + field * 0.5, lead.at[1] + 0.7],
          gaze: lead.p.id,
          target: lead.p.id,
          role: "rally",
        };
    }
    if (d.pos === "LB" && runner[1] < -0.35) {
      const keys = counter ? pullers : [];
      const key = keys
        .map((p) => ({ p, at: observed(p.id, read) }))
        .sort(
          (a, b) => Math.abs(a.at[0] - d.at[0]) - Math.abs(b.at[0] - d.at[0]),
        )[0];
      const lane = key?.at[0] ?? runner[0];
      return {
        aim: [
          clamp(lane, d.at[0] - 1.5, d.at[0] + 1.5),
          Math.max(0.6, Math.min(2.1, d.at[1] - 0.6)),
        ],
        gaze: key?.p.id ?? carrier?.id,
        role: counter ? "guard-key" : "fit",
      };
    }
    if (isDB(d) && d.intent !== "blitz") {
      const sameSide = (d.at[0] - center) * (runner[0] - center) > 0,
        outer = d.pos === "CB" || d.pos === "SS";
      return {
        aim: [
          runner[0] +
            (sameSide && outer ? Math.sign(d.at[0] - center) * 0.7 : 0),
          runner[1] + (outer ? 0.45 : 0.7),
        ],
        target: carrier?.id,
        gaze: carrier?.id,
        role: sameSide && outer ? "force" : "rally",
      };
    }
    return {
      aim: [runner[0], runner[1] + 0.4],
      target: carrier?.id,
      gaze: carrier?.id,
      role: rush ? "rush" : "rally",
    };
  }
  for (const d of active) {
    if (slots < 1) break;
    const speed =
      d.pos === "DL"
        ? opponentTiming.dlMaxSpeed
        : d.pos === "LB"
          ? opponentTiming.lbMaxSpeed
          : opponentTiming.dbMaxSpeed;
    const delay = screen
        ? opponentTiming.screenReadDelay
        : isPass
          ? opponentTiming.passReadDelay + (isDB(d) ? 0.1 : 0)
          : opponentTiming.runReadDelay + (isDB(d) ? 0.1 : 0),
      readAt = Math.min(finish - 0.01, snap + delay);
    const opening = scriptIds.has(d.id)
        ? position(sourceView, d.id, readAt)
        : d.at,
      early = bounded(d.at, opening, (speed * (readAt - snap)) / 1.5);
    const first: ActionType = {
      source: "opponent",
      player: d.id,
      kind: "opponent-reactive",
      label: "opponent-call-step",
      start: snap,
      end: readAt,
      to: early,
      gaze: qb?.id,
    };
    s.actions.push(first);
    let at = early;
    if (segments) {
      const dt = (finish - readAt) / segments;
      for (let i = 0; i < segments; i++) {
        const start = readAt + i * dt,
          end = i === segments - 1 ? finish : start + dt,
          read = gazeAndAim(d, start, at, delay),
          targetDistance = distance(at, read.aim),
          stop =
            read.role === "rush" || read.role === "rally"
              ? 0.45
              : read.role === "match"
                ? 0.3
                : 0;
        const travel = Math.max(
          0,
          Math.min((speed * (end - start)) / 1.5, targetDistance - stop),
        );
        const to =
          targetDistance < 1e-8
            ? ([...at] as Point)
            : bounded(at, read.aim, travel);
        s.actions.push({
          source: "opponent",
          player: d.id,
          kind: "opponent-reactive",
          label: "opponent-react-" + read.role,
          start,
          end,
          to,
          target: read.target,
          gaze: read.gaze,
        });
        at = to;
        roles.set(d.id, read.role);
      }
    }
  }
  const dbIds = new Set(
    defenders.filter((p) => isDB(p) && p.intent !== "blitz").map((p) => p.id),
  );
  const coverage: DefenseCoverage[] = defenders.map((p) => {
    const existing = plan.coverage.find((c) => c.defender === p.id),
      role = roles.get(p.id);
    if (isDB(p) && p.intent === "blitz") {
      const owner = assignmentByDef.get(p.id);
      return {
        defender: p.id,
        position: p.pos,
        technique: null,
        blockers: owner ? [owner] : [],
        watchers: existing?.watchers ?? [],
        detail: owner
          ? `${owner} · savunma pressure`
          : "Gerçek DB blitz / serbest rusher",
        status: owner ? "blocked" : "hot",
      };
    }
    if (dbIds.has(p.id))
      return {
        defender: p.id,
        position: p.pos,
        technique: null,
        blockers: [],
        watchers: [],
        detail: manual.has(p.id)
          ? "Manuel savunma yolu"
          : `Gecikmeli ${role ?? "coverage"} reaksiyonu`,
        status: p.intent === "hold" ? "idle" : "watch",
      };
    return existing
      ? {
          ...existing,
          detail: existing.detail + (role ? ` · savunma ${role}` : ""),
        }
      : {
          defender: p.id,
          position: p.pos,
          technique: null,
          blockers: [],
          watchers: [],
          detail: role ?? "",
          status: "idle",
        };
  });
  for (const step of s.steps) {
    for (const d of defenders) {
      const role = roles.get(d.id);
      if (role)
        step.notes[d.id] =
          `${d.pos}: ${role === "pressure" ? "Atanmış blokçuyla teması koru; QB/taşıyıcıyı gözle." : role === "match" ? "Başlangıç eşleşmesindeki alıcı rotasına gecikmeli tepki ver." : role === "zone" ? "Kaynak drop bölgesini koru, görülen rota akışına tepki ver." : role === "guard-key" ? "Guard/puller hareketini oku; taşıyıcıya körlemesine koşma." : role === "force" ? "Dış omzu ve contain açısını koru." : role === "screen-read" ? "Pas görünüşünü oku; screen teşhisinden sonra rally yap." : "Görülen QB/taşıyıcıya kontrollü takip."} Tepki ve hız sınırlıdır; gelecekteki rota bilinmez.`;
    }
  }
  const warnings = plan.warnings.filter(
    (w) =>
      !defenders.some(
        (d) =>
          dbIds.has(d.id) &&
          w.startsWith(d.id) &&
          /hot|bloklanmıyor|rusher/i.test(w),
      ),
  );
  if (slots < 2)
    warnings.push(
      "Aksiyon sınırı nedeniyle adaptif savunmanın bazı takip adımları kısaltıldı.",
    );
  const explicitDBRush = defenders.filter(
      (d) => isDB(d) && d.intent === "blitz",
    ),
    unblocked = [
      ...new Set([
        ...plan.unblocked.filter((id) => !dbIds.has(id)),
        ...explicitDBRush
          .filter((d) => !assignmentByDef.has(d.id))
          .map((d) => d.id),
      ]),
    ];
  return {
    ...plan,
    scenario: Scenario.parse(s),
    coverage,
    warnings,
    unblocked,
    fieldThreats: [
      ...new Set([
        ...plan.fieldThreats.filter((id) => !dbIds.has(id)),
        ...explicitDBRush
          .filter((d) => (d.at[0] - center) * field > 2.4)
          .map((d) => d.id),
      ]),
    ],
    boundaryThreats: [
      ...new Set([
        ...plan.boundaryThreats.filter((id) => !dbIds.has(id)),
        ...explicitDBRush
          .filter((d) => (d.at[0] - center) * field < -2.4)
          .map((d) => d.id),
      ]),
    ],
    interiorThreats: [
      ...new Set([
        ...plan.interiorThreats.filter((id) => !dbIds.has(id)),
        ...explicitDBRush
          .filter((d) => Math.abs(d.at[0] - center) <= 2.4)
          .map((d) => d.id),
      ]),
    ],
  };
}
