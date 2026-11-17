import {
  Scenario,
  fieldSide,
  position,
  pathLength,
  type ScenarioType,
  type ActionType,
  type PlayerType,
} from "./model.ts";
import { matchDefenders } from "./front-matching.ts";
import { alignment } from "./tactics.ts";
import { frontLabel } from "./protection.ts";
import type { DefenseCoverage } from "./protection.ts";
import { travelDuration } from "./timing.ts";
export type ZoneAssignment = {
  player: string;
  target?: string;
  release?: string;
  partner?: string;
  gaze?: string;
  watchTargets?: string[];
  type:
    | "zone"
    | "combo"
    | "reach"
    | "climb"
    | "cutoff"
    | "carry"
    | "watch"
    | "handoff";
  note: string;
};
export type ZoneResult = {
  scenario: ScenarioType;
  mode: "inside-zone" | "outside-zone";
  frontLabel: string;
  pressureCount: number;
  assignments: ZoneAssignment[];
  warnings: string[];
  coverage: DefenseCoverage[];
  unblocked: string[];
  boundaryLocks: { player: string; target: string }[];
  alert: boolean;
  fieldThreats: string[];
  boundaryThreats: string[];
  interiorThreats: string[];
  read: string;
};
export const zoneDefaults = {
  enabled: true,
  variant: "inside" as const,
  dlReaction: "base" as const,
  lbReaction: "fit" as const,
  rbRead: "auto" as const,
};
export function createFieldZone(input: ScenarioType) {
  const s = structuredClone(input),
    center =
      s.players.find((p) => p.side === "OFF" && p.pos === "C")?.at[0] ?? 0;
  s.name = "Field zone";
  s.scheme = "Field zone · Inside / Outside";
  s.protection = { enabled: false, showDepth: 1.8 };
  s.zone = { ...zoneDefaults };
  s.actions = s.actions.filter(
    (a) =>
      (!a.source || a.source === "manual") &&
      s.players.find((p) => p.id === a.player)?.side === "DEF",
  );
  for (const p of s.players.filter((p) => p.side === "OFF")) {
    if (p.pos === "RB") p.at = [center, -3];
    if (p.pos === "QB") p.at = [center, -2.2];
  }
  if (!s.players.some((p) => p.side === "OFF" && p.pos === "RB"))
    s.players.push({
      id: "RB_ZONE",
      side: "OFF",
      pos: "RB",
      at: [center, -3],
      stance: "2pt",
    });
  s.steps = [
    {
      title: "Field zone dizilişi",
      start: 0,
      end: 6,
      description:
        "Standart, düzenlenebilir zone taslağı. Savunmayı yerleştir; inside/outside, slant ve LB reaksiyonunu seç.",
      notes: {},
      focus: [],
    },
  ];
  s.rules = [];
  s.playbook = "Field zone · koç tarafından düzenlenebilir standart taslak";
  return Scenario.parse(s);
}
export function planZone(input: ScenarioType): ZoneResult {
  const s = structuredClone(input),
    cfg = { ...zoneDefaults, ...s.zone },
    sign = fieldSide(s) === "right" ? 1 : -1;
  s.zone = cfg;
  s.protection = { enabled: false, showDepth: s.protection?.showDepth ?? 1.8 };
  const ol = s.players.filter(
      (p) => p.side === "OFF" && ["LT", "LG", "C", "RG", "RT"].includes(p.pos),
    ),
    dl = s.players.filter(
      (p) => p.side === "DEF" && p.pos === "DL" && p.intent !== "hold",
    ),
    lbs = s.players.filter((p) => p.side === "DEF" && p.pos !== "DL"),
    rb = s.players.find((p) => p.side === "OFF" && p.pos === "RB"),
    qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB");
  const center = ol.find((p) => p.pos === "C")?.at[0] ?? 0;
  const warnings: string[] = [];
  if (ol.length !== 5) warnings.push("Zone şablonu beş OL bekler.");
  if (!rb) warnings.push("Top taşıyacak RB sahada yok.");
  const snap = 1.1,
    fit = 2.6,
    stepEnd = 1.7;
  let secured = 3.25,
    driveEnd = 5.3,
    finish = 7.8;
  const actions: ActionType[] = s.actions.filter(
    (a) =>
      (!a.source || a.source === "manual") &&
      s.players.some(
        (p) =>
          p.id === a.player &&
          p.side === "DEF" &&
          p.intent !== "hold" &&
          p.intent !== "show",
      ),
  );
  const authored = new Set(actions.map((a) => a.player));
  const reaction = (p: PlayerType) =>
    p.pos !== "DL" &&
    (p.intent === "blitz" || (p.intent === "auto" && p.at[1] <= 1.8))
      ? "blitz"
      : p.reaction && p.reaction !== "auto"
        ? p.reaction
        : p.pos === "DL"
          ? cfg.dlReaction
          : cfg.lbReaction;
  const pair = [...dl]
    .filter((p) => (p.at[0] - center) * sign >= 0)
    .sort((a, b) => a.at[0] * sign - b.at[0] * sign)
    .slice(0, 2);
  for (const p of s.players.filter((p) => p.side === "DEF")) {
    if (
      authored.has(p.id) ||
      p.intent === "hold" ||
      p.intent === "show" ||
      reaction(p) === "hold"
    )
      continue;
    const r = reaction(p);
    let to: [number, number],
      label: string,
      path: [number, number][] | undefined;
    if (p.pos === "DL") {
      const lateral =
        r === "slant-field"
          ? sign * 0.65
          : r === "slant-boundary"
            ? -sign * 0.65
            : r === "pinch"
              ? -Math.sign(p.at[0] - center) * 0.5
              : r === "widen"
                ? Math.sign(p.at[0] - center || sign) * 0.55
                : sign * 0.12;
      to = [p.at[0] + lateral, 0.6];
      label = r === "base" ? "run-read" : r;
      if (r === "twist" && pair.length === 2 && pair.includes(p)) {
        const other = pair.find((q) => q.id !== p.id)!;
        to = [other.at[0], 0.5];
        path = [
          [p.at[0], pair[0] === p ? 0.4 : 1.7],
          [other.at[0], pair[0] === p ? 0.3 : 1.5],
        ];
        label = pair[0] === p ? "stunt" : "twist";
      }
    } else {
      const blitz =
        p.intent === "blitz" || (p.intent === "auto" && p.at[1] <= 1.8);
      label = blitz ? "blitz" : r;
      to = blitz
        ? [p.at[0], -0.1]
        : r === "sail"
          ? [p.at[0] + sign * 1.2, Math.max(3.5, p.at[1] + 0.7)]
          : r === "bait"
            ? [p.at[0], p.at[1] - 0.25]
            : r === "scrape"
              ? [p.at[0] + sign * 1.1, 2.7]
              : r === "flow"
                ? [p.at[0] + sign * 1.2, 2.8]
                : [p.at[0] + sign * 0.35, 2.7];
    }
    actions.push({
      source: "zone",
      player: p.id,
      label,
      start: snap,
      end: fit,
      to,
      path,
      gap: alignment(s, to[0]).gap,
    });
  }
  const projected = dl.map((p) => ({
      ...p,
      at: position({ ...s, actions }, p.id, fit),
    })),
    base = matchDefenders(ol, projected);
  const assignments: ZoneAssignment[] = ol.map((p) => ({
    player: p.id,
    target: base.get(p.id),
    type:
      (p.at[0] - center) * sign < -0.1
        ? "cutoff"
        : cfg.variant === "outside"
          ? "reach"
          : "zone",
    note: "",
  }));
  const usedLB = new Set<string>();
  const activeLB = lbs
    .filter(
      (p) =>
        p.intent !== "hold" &&
        p.intent !== "show" &&
        !["sail", "bait", "hold"].includes(reaction(p)),
    )
    .sort((a, b) => a.at[0] * sign - b.at[0] * sign);
  for (const p of [...ol].sort((a, b) => b.at[0] * sign - a.at[0] * sign)) {
    const a = assignments.find((a) => a.player === p.id)!;
    if (a.target) continue;
    const adjacent = assignments
      .filter(
        (a) =>
          base.has(a.player) &&
          a.target &&
          ol.some(
            (q) => q.id === a.player && Math.abs(q.at[0] - p.at[0]) <= 1.5,
          ) &&
          !assignments.some((x) => x.partner === a.player),
      )
      .sort((a, b) => {
        const pa = ol.find((q) => q.id === a.player)!,
          pb = ol.find((q) => q.id === b.player)!;
        return (pa.at[0] - p.at[0]) * sign >= 0 &&
          (pb.at[0] - p.at[0]) * sign < 0
          ? -1
          : Math.abs(pa.at[0] - p.at[0]) - Math.abs(pb.at[0] - p.at[0]);
      })[0];
    const backer = activeLB
      .filter(
        (lb) =>
          !usedLB.has(lb.id) &&
          Math.abs(
            position({ ...s, actions }, lb.id, fit)[0] -
              (projected.find((d) => d.id === adjacent?.target)?.at[0] ??
                p.at[0]),
          ) <= 1.8,
      )
      .sort(
        (x, y) =>
          Math.abs(position({ ...s, actions }, x.id, fit)[0] - p.at[0]) -
          Math.abs(position({ ...s, actions }, y.id, fit)[0] - p.at[0]),
      )[0];
    if (adjacent) {
      a.target = adjacent.target;
      a.partner = adjacent.player;
      a.type = "combo";
      if (backer) {
        a.release = backer.id;
        usedLB.add(backer.id);
      }
    } else if (backer) {
      a.target = backer.id;
      a.type = "climb";
      usedLB.add(backer.id);
    }
  }
  const owns = (id: string) => assignments.filter((a) => a.target === id);
  const endPoints = new Map<string, [number, number]>();
  for (const a of assignments) {
    const p = ol.find((p) => p.id === a.player)!,
      target = projected.find((d) => d.id === a.target);
    const members = owns(a.target ?? "").sort(
      (a, b) =>
        ol.find((p) => p.id === a.player)!.at[0] -
        ol.find((p) => p.id === b.player)!.at[0],
    );
    const offset =
      members.length > 1
        ? (members.findIndex((x) => x.player === p.id) -
            (members.length - 1) / 2) *
          0.7
        : 0;
    endPoints.set(p.id, [
      target ? target.at[0] + offset : p.at[0] + sign * 0.45,
      0.12,
    ]);
    a.note =
      a.type === "combo"
        ? `${a.partner} ile ${a.target} combo. ${a.release ? `DL kontrol altına alınınca ${a.release} için ikinci seviyeye çık.` : "Aktif LB yok; DL’de combo ve bölge kontrolünü sürdür."}`
        : a.type === "climb"
          ? `Önünde DL yok: ${a.target} ikinci seviyesine çık.`
          : a.target
            ? `${alignment(s, s.players.find((q) => q.id === a.target)!.at[0]).technique} hizasındaki ${a.target}: ${a.type === "cutoff" ? "backside cutoff; arkadan takibi kes" : cfg.variant === "outside" ? "playside omuz için reach ve geniş akış" : "field zone adımı, denge ve ileri drive"}.`
            : "Zone bölgeni koru ve LB akışını oku.";
  }
  // Stretch the phase, never a player's speed, for unusually wide manual alignments.
  for (const a of assignments) {
    const p = ol.find((p) => p.id === a.player)!,
      first: [number, number] = [
        p.at[0] + sign * (cfg.variant === "outside" ? 0.55 : 0.3),
        0.25,
      ],
      to = endPoints.get(p.id)!;
    secured = Math.max(
      secured,
      stepEnd +
        travelDuration(Math.hypot(to[0] - first[0], to[1] - first[1]), 1.8),
    );
  }
  for (const a of assignments) {
    const p = ol.find((p) => p.id === a.player)!,
      from = endPoints.get(p.id)!,
      target = a.release ?? (a.type === "climb" ? a.target : undefined),
      at = target ? position({ ...s, actions }, target, fit) : null,
      to = at
        ? [at[0] + (p.at[0] < at[0] ? -0.15 : 0.15), at[1] - 0.55]
        : [from[0] + sign * (cfg.variant === "outside" ? 0.95 : 0.45), 1.35];
    driveEnd = Math.max(
      driveEnd,
      secured +
        travelDuration(Math.hypot(to[0] - from[0], to[1] - from[1]), 2.1),
    );
  }
  finish = Math.max(finish, driveEnd + 2.5);
  const notes: Record<string, string> = Object.fromEntries(
    assignments.map((a) => [a.player, a.note]),
  );
  // Blocking paths and defensive reactions share the same data and timeline.
  for (const a of assignments) {
    const p = ol.find((p) => p.id === a.player)!,
      to = endPoints.get(p.id)!;
    const first: [number, number] = [
      p.at[0] + sign * (cfg.variant === "outside" ? 0.55 : 0.3),
      0.25,
    ];
    actions.push({
      source: "zone",
      player: p.id,
      label: "zone-step",
      assignment: "zone",
      start: snap,
      end: stepEnd,
      to: first,
      target: a.target,
      gaze: a.release ?? a.target,
      phases: [{ name: "zone-step", start: snap, end: stepEnd }],
    });
    actions.push({
      source: "zone",
      player: p.id,
      label:
        a.type === "climb"
          ? "climb"
          : a.type === "combo"
            ? "zone-combo"
            : "reach",
      assignment: a.type === "combo" ? "combo" : "zone",
      start: stepEnd,
      end: secured,
      to,
      target: a.target,
      gaze: a.release ?? a.target,
    });
    if (a.release || a.type === "climb") {
      const target = a.release ?? a.target;
      const at = target
        ? position({ ...s, actions }, target, fit)
        : [p.at[0], 2];
      const toLB: [number, number] = [
        at[0] + (p.at[0] < at[0] ? -0.15 : 0.15),
        at[1] - 0.55,
      ];
      actions.push({
        source: "zone",
        player: p.id,
        label: "climb",
        assignment: "zone",
        start: secured,
        end: driveEnd,
        to: toLB,
        target,
        gaze: target,
      });
      actions.push({
        source: "zone",
        player: p.id,
        label: "zone-seal",
        assignment: "zone",
        start: driveEnd,
        end: finish,
        to: toLB,
        target,
        gaze: target,
      });
    } else {
      const driven: [number, number] = [
        to[0] + sign * (cfg.variant === "outside" ? 0.95 : 0.45),
        1.35,
      ];
      actions.push({
        source: "zone",
        player: p.id,
        label: a.type === "cutoff" ? "cutoff" : "zone-drive",
        assignment: "zone",
        start: secured,
        end: driveEnd,
        to: driven,
        target: a.target,
      });
      actions.push({
        source: "zone",
        player: p.id,
        label: "zone-seal",
        assignment: "zone",
        start: driveEnd,
        end: finish,
        to: driven,
        target: a.target,
      });
    }
  }
  for (const defender of dl) {
    if (
      authored.has(defender.id) ||
      defender.intent === "show" ||
      reaction(defender) === "hold"
    )
      continue;
    const owner =
      assignments.find((a) => a.target === defender.id && a.type !== "combo") ??
      assignments.find((a) => a.target === defender.id);
    if (!owner) continue;
    const at = position({ ...s, actions }, owner.player, driveEnd);
    const from = position({ ...s, actions }, defender.id, fit);
    actions.push({
      source: "zone",
      player: defender.id,
      label: "block-resist",
      start: fit,
      end: secured,
      to: [from[0], 0.65],
    });
    actions.push({
      source: "zone",
      player: defender.id,
      label: "block-resist",
      start: secured,
      end: driveEnd,
      to: [at[0], at[1] + 0.55],
    });
    actions.push({
      source: "zone",
      player: defender.id,
      label: "block-resist",
      start: driveEnd,
      end: finish,
      to: [at[0], at[1] + 0.55],
    });
  }
  const guard = ol.find((p) => p.pos === (sign > 0 ? "RG" : "LG")),
    tackle = ol.find((p) => p.pos === (sign > 0 ? "RT" : "LT"));
  const candidates =
    cfg.variant === "inside"
      ? [
          { read: "bang", x: center + sign * 0.6 },
          { read: "bounce", x: (guard?.at[0] ?? sign * 1.2) + sign * 0.65 },
          { read: "bend", x: center - sign * 0.6 },
        ]
      : [
          { read: "bang", x: (tackle?.at[0] ?? sign * 2.4) + sign * 0.6 },
          { read: "bounce", x: (tackle?.at[0] ?? sign * 2.4) + sign * 1.4 },
          { read: "bend", x: (guard?.at[0] ?? sign * 1.2) + sign * 0.55 },
        ];
  function clearance(x: number) {
    return Math.min(
      ...s.players
        .filter((p) => p.id !== rb?.id && p.id !== qb?.id)
        .map((p) => {
          const at = position({ ...s, actions }, p.id, driveEnd);
          return Math.hypot(at[0] - x, (at[1] - 1) * 0.6);
        }),
      5,
    );
  }
  const mesh: [number, number] = [center + sign * 0.4, -1.6],
    meshEnd = rb
      ? Math.max(
          2.5,
          1.3 +
            travelDuration(
              Math.hypot(mesh[0] - rb.at[0], mesh[1] - rb.at[1]),
              2.6,
            ),
        )
      : 2.5;
  function runActions(x: number): ActionType[] {
    const aim: [number, number] = [x, -0.25],
      cut: ActionType = {
        source: "zone",
        player: rb?.id ?? "RB",
        label: "read-cut",
        start: meshEnd,
        end: Math.max(driveEnd - 0.1, meshEnd + 2.1),
        to: aim,
        path: [
          [center + sign * 0.65, -1.3],
          [x, -1.05],
        ],
      };
    cut.end = Math.max(
      cut.end,
      cut.start + travelDuration(pathLength(mesh, cut), 2.6),
    );
    return [
      {
        source: "zone",
        player: rb?.id ?? "RB",
        label: "mesh",
        start: 1.3,
        end: meshEnd,
        to: mesh,
      },
      cut,
      {
        source: "zone",
        player: rb?.id ?? "RB",
        label: "carry",
        start: cut.end,
        end: cut.end + 2.5,
        to: [x + sign * 0.25, 3.8],
      },
    ];
  }
  // Prefer a clear corridor between the actual moving blockers, near each read's aim point.
  function corridor(x: number) {
    if (!rb) return clearance(x);
    const run = runActions(x),
      sample = { ...s, actions: [...actions, ...run] };
    let room = 5;
    for (let t = meshEnd + 0.7; t <= run.at(-1)!.end; t += 0.1) {
      const at = position(sample, rb.id, t);
      for (const p of ol) {
        const other = position(sample, p.id, t);
        room = Math.min(room, Math.hypot(at[0] - other[0], at[1] - other[1]));
      }
    }
    return room + 0.15 * clearance(x);
  }
  const choices = candidates.flatMap((c) =>
    [-0.3, 0, 0.3].map((offset) => ({ ...c, x: c.x + offset, offset })),
  );
  const scored =
    cfg.rbRead === "auto"
      ? choices.map((c) => ({
          ...c,
          score:
            corridor(c.x) -
            (c.read === "bend" ? 0.1 : 0) -
            Math.abs(c.offset) * 0.1,
        }))
      : [];
  const lane =
    cfg.rbRead === "auto"
      ? scored.sort((a, b) => b.score - a.score)[0]
      : candidates.find((c) => c.read === cfg.rbRead)!;
  const read = `${lane.read.toUpperCase()} · x ${lane.x.toFixed(2)} · ${cfg.variant === "inside" ? "iç zone" : "stretch"} field`;
  if (rb) {
    notes[rb.id] =
      `Field yönüne mesh ve kontrollü yaklaş. ${read}. Otomatik koridor önerisi geometriye dayanır; koç tarafından değiştirilebilir.`;
    assignments.push({ player: rb.id, type: "carry", note: notes[rb.id] });
    const run = runActions(lane.x);
    actions.push(...run);
    finish = Math.max(finish, run.at(-1)!.end);
    for (const a of actions)
      if (
        a.label === "zone-seal" ||
        (a.label === "block-resist" && a.start === driveEnd)
      )
        a.end = finish;
  }
  if (qb) {
    notes[qb.id] =
      "Snap’i al, RB ile mesh yap ve topu ver. RB koşucu; pas korumasındaki pickup görevi uygulanmaz.";
    actions.push(
      {
        source: "zone",
        player: qb.id,
        label: "handoff",
        start: snap,
        end: meshEnd,
        to: [center - sign * 0.35, -1.95],
      },
      {
        source: "zone",
        player: qb.id,
        label: "fake",
        start: meshEnd,
        end: meshEnd + 1.5,
        to: [center - sign * 0.9, -2.2],
      },
    );
    assignments.push({ player: qb.id, type: "handoff", note: notes[qb.id] });
  }
  const end = Math.max(finish, ...actions.map((a) => a.end));
  const unblocked = s.players
    .filter(
      (p) =>
        p.side === "DEF" &&
        p.intent !== "hold" &&
        p.intent !== "show" &&
        !["sail", "bait", "hold"].includes(reaction(p)) &&
        !assignments.some((a) => a.target === p.id || a.release === p.id),
    )
    .map((p) => p.id);
  if (unblocked.length)
    warnings.push(
      `Blok dışı koşu takipçileri: ${unblocked.join(", ")}. RB blokçu sayılmaz; sayı fazlası için TE/ek blok veya koç kuralı gerekebilir.`,
    );
  const coverage: DefenseCoverage[] = s.players
    .filter((p) => p.side === "DEF")
    .map((p) => {
      const blockers = assignments.filter(
        (a) => a.target === p.id || a.release === p.id,
      );
      return {
        defender: p.id,
        position: p.pos,
        technique: p.pos === "DL" ? alignment(s, p.at[0]).technique : null,
        blockers: blockers.map((a) => a.player),
        watchers: [],
        detail: blockers
          .map(
            (a) =>
              `${a.player} · ${a.release === p.id ? "combo sonrası climb" : a.type}`,
          )
          .join(", "),
        status:
          p.intent === "show"
            ? "show"
            : unblocked.includes(p.id)
              ? "free"
              : blockers.length
                ? "blocked"
                : "idle",
      };
    });
  s.actions = actions;
  s.playbook =
    "Standart field zone taslağı · koç kurallarına göre düzenlenebilir";
  s.blitz = "none";
  s.rules = [
    {
      id: "field-zone",
      blitz: "none",
      title: `Field ${cfg.variant} zone`,
      note: "Covered OL DL’sini alır; uygun komşu uncovered OL combo kurar ve kontrol sonrası LB’ye çıkar. Backside cutoff, RB field okuması. Takıma özel kurallar ayrıca düzenlenmelidir.",
      assign: Object.fromEntries(
        assignments
          .filter((a) => a.type !== "carry")
          .map((a) => [
            a.player,
            {
              type:
                a.type === "combo"
                  ? "combo"
                  : a.type === "watch"
                    ? "watch"
                    : "zone",
              target: a.target,
              with: a.partner,
              note: a.note,
            },
          ]),
      ),
    },
  ];
  s.steps = [
    {
      title: "Front / covered–uncovered oku",
      start: 0,
      end: snap,
      description: `${frontLabel(s)}. Field ${sign > 0 ? "sağ" : "sol"}. Standart, koç tarafından düzenlenebilir zone taslağı.`,
      notes,
      focus: dl.map((p) => p.id),
      calls: s.players.some((p) => p.id === "C")
        ? ol
            .filter((p) => p.pos.endsWith("G"))
            .map((p) => ({ from: "C", to: p.id, text: "ZONE ID / LB" }))
        : [],
    },
    {
      title: "Field zone adımı / mesh",
      start: snap,
      end: stepEnd,
      description:
        cfg.variant === "outside"
          ? "Daha geniş ilk adım, playside omuza reach; RB stretch yönüne akar."
          : "İlk adım field’a; kalça ve omuz dengesi, RB mesh.",
      notes,
      focus: ol.map((p) => p.id),
    },
    {
      title: "Temas ve combo",
      start: stepEnd,
      end: secured,
      description: "DL kontrolünü kur. LB fit ve slant hareketlerini takip et.",
      notes,
      focus: assignments.map((a) => a.target).filter((x): x is string => !!x),
    },
    {
      title: "Drive / LB’ye climb / RB okuması",
      start: secured,
      end: driveEnd,
      description: `Covered oyuncu DL’de kalır, uygun yardımcı LB’ye çıkar. RB: ${read}`,
      notes,
      focus: activeLB.map((p) => p.id),
    },
    {
      title: "Koşu koridoru ve son kontrol",
      start: driveEnd,
      end,
      description: `Top taşıyıcı koridoru takip eder. ${warnings.join(" ")}`,
      notes,
      focus: rb ? [rb.id] : [],
    },
  ];
  const fieldThreats = lbs
      .filter((p) => p.intent === "blitz" && (p.at[0] - center) * sign > 2.4)
      .map((p) => p.id),
    boundaryThreats = lbs
      .filter((p) => p.intent === "blitz" && (p.at[0] - center) * sign < -2.4)
      .map((p) => p.id),
    interiorThreats = lbs
      .filter((p) => p.intent === "blitz" && Math.abs(p.at[0] - center) <= 2.4)
      .map((p) => p.id);
  return {
    scenario: Scenario.parse(s),
    mode: cfg.variant === "inside" ? "inside-zone" : "outside-zone",
    frontLabel: frontLabel(s),
    pressureCount: dl.length + activeLB.length,
    assignments,
    warnings,
    coverage,
    unblocked,
    boundaryLocks: [],
    alert: false,
    fieldThreats,
    boundaryThreats,
    interiorThreats,
    read,
  };
}
