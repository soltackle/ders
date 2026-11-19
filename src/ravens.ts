import { prepareOpponent, restoreOpponentOwnership, opponentPackages } from "./opponent.ts";
import { reactOpponent } from "./opponent-reaction.ts";
import { eligiblePassTargets, isRavensPass, passWindow } from "./ravens-pass.ts";
import { ravensProfile, RAVENS_PROFILE_REVISION } from "./ravens-catalog.ts";
import { applyRavensSpecial } from "./ravens-special.ts";
import {
  rolloutProtection,
  boundaryWrap,
  fieldGuardLead,
} from "./ravens-variants.ts";
import source from "./data/ravens-most.json" with { type: "json" };
import {
  Scenario,
  fieldSide,
  pathLength,
  position,
  type ScenarioType,
  type ActionType,
} from "./model.ts";
import { defaultProtection } from "./examples.ts";
import {
  planProtection,
  frontLabel,
  type ProtectionResult,
} from "./protection.ts";
import { planZone, type ZoneResult } from "./zone.ts";
import { travelDuration } from "./timing.ts";
export type Blocking = "diagram" | "pass" | "inside" | "outside" | "team";
export type DrawingPlay = {
  id: string;
  name: string;
  players: {
    id: string;
    x: number;
    y: number;
    paths: { d: string; motion: boolean }[];
  }[];
};
export const ravensPlays = source as DrawingPlay[];
export const blockingLabels: Record<Blocking, string> = {
  diagram: "Çizimdeki yollar",
  team: "Takım oyun kuralı",
  pass: "Takım pas koruması",
  inside: "Field inside zone",
  outside: "Field outside / stretch",
};
export function sampleDrawing(d: string): [number, number][] {
  const tokens =
    d.match(/[MLQCHVZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0,
    cmd = "",
    at: [number, number] = [0, 0],
    origin: [number, number] = [0, 0];
  const points: [number, number][] = [];
  const number = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw Error("Geçersiz SVG koordinatı");
    return v;
  };
  const push = (p: [number, number]) => {
    at = p;
    if (
      !points.length ||
      Math.hypot(p[0] - points.at(-1)![0], p[1] - points.at(-1)![1]) > 0.0001
    )
      points.push(p);
  };
  while (i < tokens.length) {
    if (/^[A-Z]$/i.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M" || cmd === "L") {
      push([number(), number()]);
      if (cmd === "M") {
        origin = at;
        cmd = "L";
      }
    } else if (cmd === "H") push([number(), at[1]]);
    else if (cmd === "V") push([at[0], number()]);
    else if (cmd === "Q") {
      const from = at,
        c: [number, number] = [number(), number()],
        to: [number, number] = [number(), number()];
      for (let k = 1; k <= 10; k++) {
        const u = k / 10,
          v = 1 - u;
        push([
          v * v * from[0] + 2 * v * u * c[0] + u * u * to[0],
          v * v * from[1] + 2 * v * u * c[1] + u * u * to[1],
        ]);
      }
    } else if (cmd === "C") {
      const from = at,
        c: [number, number] = [number(), number()],
        b: [number, number] = [number(), number()],
        to: [number, number] = [number(), number()];
      for (let k = 1; k <= 12; k++) {
        const u = k / 12,
          v = 1 - u;
        push([
          v ** 3 * from[0] +
            3 * v * v * u * c[0] +
            3 * v * u * u * b[0] +
            u ** 3 * to[0],
          v ** 3 * from[1] +
            3 * v * v * u * c[1] +
            3 * v * u * u * b[1] +
            u ** 3 * to[1],
        ]);
      }
    } else if (cmd === "Z") {
      push([...origin]);
      cmd = "";
    } else throw Error("Desteklenmeyen SVG yolu: " + cmd);
  }
  return points;
}
export function drawingRoster(play: DrawingPlay) {
  const c = play.players.find((p) => p.id === "C")!;
  const xs = play.players
      .filter((p) => ["LT", "LG", "C", "RG", "RT"].includes(p.id))
      .map((p) => p.x)
      .sort((a, b) => a - b),
    gaps = xs
      .slice(1)
      .map((x, i) => x - xs[i])
      .sort((a, b) => a - b),
    scale = 1.2 / ((gaps[1] + gaps[2]) / 2);
  return play.players.map((p) => ({
    id: p.id,
    at: [(p.x - c.x) * scale, (1152 - p.y) * scale] as [number, number],
    paths: p.paths.map((a) => ({
      ...a,
      points: sampleDrawing(a.d).map(
        ([x, y]) => [x * scale, -y * scale] as [number, number],
      ),
    })),
  }));
}
export function suggestedBlocking(play: DrawingPlay): Blocking {
  return ravensProfile(play.id).defaultBlocking;
}
export function migrateRavensScenario(input: ScenarioType): ScenarioType {
  if (!input.ravens || (input.ravens.revision ?? 0) >= RAVENS_PROFILE_REVISION)
    return input;
  const next = changeRavensBlocking(
    input,
    ravensProfile(input.ravens.id).defaultBlocking,
  );
  next.ravens!.revision = RAVENS_PROFILE_REVISION;
  return next;
}
function runtimeRoster(play: DrawingPlay, s: ScenarioType) {
  let roster = drawingRoster(play);
  const profile = ravensProfile(play.id),
    reflected =
      s.ravens?.blocking !== "diagram" &&
      profile.direction !== "drawing" &&
      fieldSide(s) === "left";
  if (reflected) {
    const mirror: Record<string, string> = {
      LT: "RT",
      RT: "LT",
      LG: "RG",
      RG: "LG",
    };
    roster = roster.map((p) => ({
      ...p,
      id: mirror[p.id] ?? p.id,
      paths: p.paths.map((a) => ({
        ...a,
        points: a.points.map(([x, z]) => [-x, z] as [number, number]),
      })),
    }));
  }
  // The original 32 motion line crosses the stationary QB icon. Keep its endpoints,
  // but let the moving player pass behind the QB's body rather than through it.
  if (profile.number === 32 && s.ravens?.blocking === "team")
    for (const p of roster) {
      const own = s.players.find((q) => q.id === p.id),
        qb = s.players.find((q) => q.pos === "QB");
      if (!own || !qb || own.id === qb.id) continue;
      for (const path of p.paths.filter((a) => a.motion)) {
        const points = path.points,
          extra: [number, number][] = [];
        for (let i = 0; i < points.length - 1; i++) {
          const from = points[i],
            to = points[i + 1],
            dx = to[0] - from[0],
            dz = to[1] - from[1],
            qx = qb.at[0] - own.at[0],
            qz = qb.at[1] - own.at[1],
            u = Math.max(
              0,
              Math.min(
                1,
                ((qx - from[0]) * dx + (qz - from[1]) * dz) /
                  (dx * dx + dz * dz || 1),
              ),
            );
          extra.push(from);
          if (
            Math.abs(dx) > 0.7 &&
            Math.hypot(from[0] + u * dx - qx, from[1] + u * dz - qz) < 0.6
          ) {
            const sign = Math.sign(dx);
            extra.push(
              [qx - sign * 0.75, qz - 0.8],
              [qx + sign * 0.75, qz - 0.8],
            );
          }
        }
        extra.push(points.at(-1)!);
        path.points = extra;
      }
    }
  return roster;
}
export function ravensScenario(id: string, blocking?: Blocking): ScenarioType {
  const play = ravensPlays.find((p) => p.id === id);
  if (!play) throw Error("Ravens oyunu bulunamadı");
  const s: ScenarioType = defaultProtection();
  const roster = drawingRoster(play);
  s.players = s.players.filter((p) => p.side === "DEF");
  for (const p of roster) {
    let pos = p.id === "Q" ? "QB" : p.id;
    if (
      p.id === "H" &&
      !/Empty/i.test(play.name) &&
      (p.at[1] < -1.5 || /HPP/i.test(play.name))
    )
      pos = "RB";
    if (p.id === "F") pos = "FB";
    s.players.push({
      id: p.id,
      pos,
      side: "OFF",
      at: p.at,
      stance: ["LT", "LG", "C", "RG", "RT"].includes(p.id) ? "3pt" : "2pt",
    });
  }
  s.players.sort((a, b) => Number(a.side === "DEF") - Number(b.side === "DEF"));
  s.name = play.name;
  s.scheme = "Ravens · MOST";
  s.ravens = {
    enabled: true,
    revision: RAVENS_PROFILE_REVISION,
    id,
    source: "MOST",
    blocking: blocking ?? suggestedBlocking(play),
  };
  s.protection = {
    enabled:
      s.ravens.blocking === "pass" ||
      (s.ravens.blocking === "team" &&
        ["rollout", "pass-wrap"].includes(ravensProfile(id).kind)),
    showDepth: 1.8,
  };
  s.zone = undefined;
  if (
    s.ravens.blocking === "inside" ||
    s.ravens.blocking === "outside" ||
    (s.ravens.blocking === "team" && ravensProfile(id).kind === "zone-lead")
  )
    s.zone = {
      enabled: true,
      variant: s.ravens.blocking === "outside" ? "outside" : "inside",
      dlReaction: "base",
      lbReaction: "fit",
      rbRead: "auto",
    };
  const cx = play.players.find((p) => p.id === "C")!.x / 1024;
  s.hash = cx < 0.45 ? "left" : cx > 0.55 ? "right" : "middle";
  s.fieldSide = "right";
  s.actions = [];
  s.rules = [];
  s.playbook = "Ravens MOST · kaynak çizimler";
  s.steps = [
    {
      title: "Ravens dizilişi",
      start: 0,
      end: 8,
      description:
        "Kaynak oyuncu yerleşimi ve rotalar. Savunma çalışma için eklenmiştir. Oynat ile hareketleri hesapla.",
      notes: {},
      focus: [],
    },
  ];
  return Scenario.parse(s);
}
export function changeRavensBlocking(input: ScenarioType, blocking: Blocking) {
  const s = structuredClone(input);
  if (!s.ravens) throw Error("Ravens oyunu seçilmeli");
  s.ravens.blocking = blocking;
  s.ravens.revision = RAVENS_PROFILE_REVISION;
  s.protection = {
    enabled:
      blocking === "pass" ||
      (blocking === "team" &&
        ["rollout", "pass-wrap"].includes(ravensProfile(s.ravens.id).kind)),
    showDepth: s.protection?.showDepth ?? 1.8,
  };
  s.zone =
    blocking === "inside" ||
    blocking === "outside" ||
    (blocking === "team" && ravensProfile(s.ravens.id).kind === "zone-lead")
      ? {
          ...s.zone,
          enabled: true,
          variant: blocking === "outside" ? "outside" : "inside",
          dlReaction: s.zone?.dlReaction ?? "base",
          lbReaction: s.zone?.lbReaction ?? "fit",
          rbRead: s.zone?.rbRead ?? "auto",
        }
      : undefined;
  s.actions = s.actions.filter((a) => !a.source || a.source === "manual");
  s.steps = [
    {
      title: "Blok şeması seçildi",
      start: 0,
      end: 8,
      description: blockingLabels[blocking],
      notes: {},
      focus: [],
    },
  ];
  return Scenario.parse(s);
}
function diagramPlan(s: ScenarioType): ProtectionResult {
  return {
    scenario: structuredClone(s),
    mode: "base",
    frontLabel: frontLabel(s),
    front: s.players.filter((p) => p.pos === "DL").length,
    pressureCount: 0,
    assignments: [],
    warnings: [],
    coverage: s.players
      .filter((p) => p.side === "DEF")
      .map((p) => ({
        defender: p.id,
        position: p.pos,
        technique: null,
        blockers: [],
        watchers: [],
        detail: s.opponent ? "Rakip paketindeki kaynak savunma" : "Kaynakta savunma çizilmemiş",
        status: "idle",
      })),
    unblocked: [],
    boundaryLocks: [],
    alert: false,
    fieldThreats: [],
    boundaryThreats: [],
    interiorThreats: [],
  };
}
export function planRavens(input: ScenarioType): ProtectionResult | ZoneResult {
  input = migrateRavensScenario(input);
  const play = ravensPlays.find((p) => p.id === input.ravens!.id);
  if (!play) throw Error("Ravens kaynağı bulunamadı");
  const profile = ravensProfile(input.ravens!.id),
    s = prepareOpponent(structuredClone(input));
  const desired =
    s.ravens!.blocking !== "diagram" && profile.direction !== "drawing"
      ? fieldSide(s)
      : "right";
  if ((s.ravens!.orientation ?? "right") !== desired) {
    const c =
        s.players.find((p) => p.side === "OFF" && p.pos === "C")?.at[0] ?? 0,
      old = structuredClone(s.players),
      map: Record<string, string> = { LT: "RT", RT: "LT", LG: "RG", RG: "LG" };
    for (const p of s.players.filter((p) => p.side === "OFF")) {
      const opposite = old.find(
        (q) => q.side === "OFF" && q.pos === map[p.pos],
      );
      p.at = [2 * c - (opposite ?? p).at[0], (opposite ?? p).at[1]];
    }
  }
  s.ravens!.orientation = desired;
  const meta = s.ravens!,
    roster = runtimeRoster(play, s);
  const special =
    meta.blocking === "team" &&
    !["pass", "zone", "rollout", "pass-wrap", "zone-lead"].includes(
      profile.kind,
    );
  const baseline =
    meta.blocking === "team"
      ? changeRavensBlocking(
          s,
          profile.kind === "zone"
            ? (s.zone?.variant ?? profile.defaultBlocking)
            : profile.kind === "zone-lead"
              ? (s.zone?.variant ?? "inside")
              : ["pass", "rollout", "pass-wrap"].includes(profile.kind)
                ? "pass"
                : "diagram",
        )
      : s;
  baseline.ravens = { ...meta };
  const base =
    meta.blocking === "diagram" || special
      ? diagramPlan(baseline)
      : baseline.zone
        ? planZone(baseline)
        : planProtection(baseline);
  const out = base.scenario;
  const sourcePlayers = roster.filter((p) => {
    const player = out.players.find((q) => q.id === p.id);
    if (!player) return false;
    if (meta.blocking === "diagram" || special) return true;
    if (!p.paths.length) return false;
    if (["LT", "LG", "C", "RG", "RT"].includes(player.pos)) return false;
    if (baseline.zone && ["QB", "RB"].includes(player.pos)) return false;
    if (
      player.pos === "RB" &&
      base.assignments.some(
        (a) => a.player === p.id && a.type !== "watch" && a.target,
      )
    )
      return false;
    return true;
  });
  const motionTime = (p: (typeof roster)[number]) =>
    p.paths
      .filter((a) => a.motion)
      .reduce(
        (n, a) =>
          n +
          Math.max(
            0.5,
            travelDuration(
              a.points
                .slice(1)
                .reduce(
                  (d, x, i) =>
                    d +
                    Math.hypot(x[0] - a.points[i][0], x[1] - a.points[i][1]),
                  0,
                ),
              3,
            ),
          ),
        0,
      );
  const delay = Math.max(0, ...sourcePlayers.map((p) => motionTime(p))),
    snap = 1.1 + delay;
  const authoredDefense = (a: ActionType) =>
    (!a.source || a.source === "manual") &&
    !a.kind?.startsWith("opponent-") &&
    out.players.some((p) => p.id === a.player && p.side === "DEF");
  // Shift the team episode after the imported pre-snap motion.
  out.actions = out.actions.filter(
    (a) => !sourcePlayers.some((p) => p.id === a.player),
  );
  for (const a of out.actions) {
    if (authoredDefense(a)) continue;
    a.start += delay;
    a.end += delay;
    for (const phase of a.phases ?? []) {
      phase.start += delay;
      phase.end += delay;
    }
  }
  const notes: Record<string, string> = {};
  const routeActions: ActionType[] = [];
  for (const p of sourcePlayers) {
    const player = out.players.find((q) => q.id === p.id)!;
    let time = 0.3,
      post = snap,
      last: [number, number] = [...player.at];
    const shift: [number, number] = [player.at[0], player.at[1]];
    for (const segment of p.paths) {
      const points = segment.points.map(
        ([x, z]) => [shift[0] + x, shift[1] + z] as [number, number],
      );
      if (points.length < 2) continue;
      // Chunk long drawings without losing vertices or breaking the schema limit.
      for (let i = 1; i < points.length; i += 95) {
        const chunk = points.slice(i, Math.min(points.length, i + 95));
        const a: ActionType = {
          source: "ravens",
          interpolation: "polyline",
          player: p.id,
          label: segment.motion ? "motion" : "kaynak-rota",
          start: segment.motion ? time : post,
          end: 1,
          to: chunk.at(-1)!,
          path: chunk.slice(0, -1),
        };
        a.end =
          a.start +
          Math.max(
            0.35,
            travelDuration(pathLength(last, a), segment.motion ? 3 : 4),
          );
        if (segment.motion) time = a.end;
        else post = a.end;
        last = a.to;
        const watch = base.assignments.find(
          (x) => x.player === p.id && x.type === "watch",
        );
        if (watch) {
          a.gaze = watch.gaze ?? watch.target;
        }
        routeActions.push(a);
      }
    }
    notes[p.id] = p.paths.length
      ? "Kaynak çizimdeki yol izleniyor. Kesik çizgi motion; hız ve snap zamanı eğitim için ayarlanmıştır."
      : "Kaynak çizimde bu oyuncunun hareketi belirtilmemiş; yerleşimini korur.";
    const responsibility = base.assignments.find((a) => a.player === p.id);
    if (responsibility) notes[p.id] += " " + responsibility.note;
  }
  // Use the actual motion schedule, including chunked paths, to prevent overlap with snap.
  const actualMotionEnd = Math.max(
    0.3,
    ...routeActions.filter((a) => a.label === "motion").map((a) => a.end),
  );
  if (actualMotionEnd > snap) {
    throw Error("Motion zamanlaması snap sınırını aştı");
  }
  out.actions.push(...routeActions);
  const finish = Math.max(8 + delay, ...out.actions.map((a) => a.end));
  for (const a of out.actions)
    if (
      a.source !== "ravens" &&
      !authoredDefense(a) &&
      a.end >=
        Math.max(...base.scenario.steps.map((st) => st.end)) + delay - 0.01
    )
      a.end = finish;
  for (const st of out.steps) {
    st.start = st.start === 0 ? 0 : st.start + delay;
    st.end += delay;
    st.notes = { ...st.notes, ...notes };
    if (st.end > finish) st.end = finish;
  }
  if (meta.blocking === "diagram" || special)
    out.steps = [
      {
        title: "Kaynak dizilişi / motion",
        start: 0,
        end: snap,
        description:
          `MOST çizimindeki 11 ofans oyuncusu. ${out.opponent ? "Rakip savunma seçilen Kocaeli paketinden gelir." : "Eklenen savunma örnek yerleşimdir."} Blok/okuma kuralları kaynakta belirtilmemiştir.`,
        notes,
        focus: sourcePlayers
          .filter((p) => p.paths.some((a) => a.motion))
          .map((p) => p.id),
      },
      {
        title: "Çizilmiş oyun yolları",
        start: snap,
        end: finish,
        description:
          "Çizilmiş rota ve blok yolları oynatılır. Option kararı, top hedefi ve özel devirler otomatik varsayılmaz.",
        notes,
        focus: sourcePlayers.filter((p) => p.paths.length).map((p) => p.id),
      },
    ];
  else {
    out.steps[0].description +=
      ` Ravens çizim rotalarıyla birlikte; ${out.opponent ? "savunma seçilen Kocaeli paketidir." : "savunma örnek çalışma front’udur."}`;
    out.steps.at(-1)!.end = finish;
  }
  if (meta.blocking === "diagram" || special) {
    out.blitz = "none";
    out.rules = [
      {
        id: "ravens-source",
        blitz: "none",
        title: "Kaynak çizim",
        note: `MOST kaynak yerleşimi ve yolları. ${out.opponent ? "Savunma Kocaeli paketidir." : "Savunma çalışma front’udur."} Özel blok devirleri, QB okuması ve top hedefi kaynakta belirtilmemiştir.`,
        assign: {},
      },
    ];
  }
  out.ravens = { ...meta };
  out.name = play.name;
  out.scheme = "Ravens · MOST";
  out.playbook = `Ravens MOST · ${blockingLabels[meta.blocking]}`;
  let result = { ...base, scenario: Scenario.parse(out) };
  const complete = (p: ProtectionResult | ZoneResult) => {
    const meta = p.scenario.ravens!;
    if (!isRavensPass(p.scenario) || !eligiblePassTargets(p.scenario).some((x) => x.id === meta.passTarget)) {
      meta.passTarget = undefined;
      meta.passReleaseAt = undefined;
      meta.passResult = undefined;
    } else {
      const window = passWindow(p.scenario);
      if (window.latest >= window.earliest)
        meta.passReleaseAt = Math.max(window.earliest, Math.min(window.latest, meta.passReleaseAt ?? window.snap + 1.6));
      else {
        meta.passTarget = undefined;
        meta.passReleaseAt = undefined;
        p.warnings.push("QB LOS'u geçmeden bu oyun bölümünde geçerli pas çıkış penceresi yok.");
      }
      if (meta.passTarget) {
        const qb = p.scenario.players.find((x) => x.side === "OFF" && x.pos === "QB");
        if (qb) for (const step of p.scenario.steps)
          step.notes[qb.id] = `${step.notes[qb.id] ?? ""} Pas hedefi ${meta.passTarget}; çıkış ${meta.passReleaseAt!.toFixed(1)} sn. Top sabit bir uçuşla oyun rotasına atılır.`;
      }
    }
    if (!p.scenario.opponent) return p;
    restoreOpponentOwnership(p.scenario);
    if (p.scenario.opponent.mode === "source")
      for (const a of p.scenario.actions)
        if (a.engage && p.scenario.players.some((d) => d.side === "DEF" && d.id === a.engage))
          a.engage = undefined;
    const result = reactOpponent(p), pack = opponentPackages.find((x) => x.id === p.scenario.opponent!.id)!;
    result.scenario.steps[0].description += ` Rakip: ${pack.name}. ${p.scenario.opponent.mode === "source" ? "Kaynak savunma yolları oynatılır; otomatik takip uygulanmaz." : "Coverage eşleşmeleri, koşu okuması ve takip tepkileri eğitim uyarlamasıdır; kaynakta coverage çağrısı belirtilmemiştir."}`;
    return result;
  };
  if (meta.blocking === "team") {
    if (special) return complete(applyRavensSpecial(result.scenario, profile));
    const sourceInput = changeRavensBlocking(s, "diagram");
    sourceInput.opponent = undefined;
    const sourceScenario = planRavens(sourceInput).scenario;
    // Mirror the pure source OL paths for a left-field call, keeping live player positions.
    if (profile.direction !== "drawing" && fieldSide(input) === "left") {
      const map: Record<string, string> = {
        LG: "RG",
        RG: "LG",
        LT: "RT",
        RT: "LT",
      };
      for (const action of sourceScenario.actions) {
        const oldId = action.player,
          newId = map[oldId] ?? oldId,
          old = sourceScenario.players.find((p) => p.id === oldId)!,
          next = s.players.find((p) => p.id === newId);
        if (!next) continue;
        action.player = newId;
        action.to = [next.at[0] - (action.to[0] - old.at[0]), action.to[1]];
        action.path = action.path?.map((p) => [
          next.at[0] - (p[0] - old.at[0]),
          p[1],
        ]);
      }
    }
    if (profile.kind === "rollout")
      return complete(
        rolloutProtection(result as ReturnType<typeof planProtection>),
      );
    if (profile.kind === "pass-wrap")
      return complete(
        boundaryWrap(
          result as ReturnType<typeof planProtection>,
          sourceScenario,
        ),
      );
    if (profile.kind === "zone-lead")
      return complete(
        fieldGuardLead(result as ReturnType<typeof planZone>, sourceScenario),
      );
  }
  return complete(result);
}
