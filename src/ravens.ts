import source from "./data/ravens-most.json" with { type: "json" };
import {
  Scenario,
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
import { planZone } from "./zone.ts";
import { travelDuration } from "./timing.ts";
export type Blocking = "diagram" | "pass" | "inside" | "outside";
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
  if (/OUTZONE/i.test(play.name)) return "outside";
  if (/ZONE/i.test(play.name)) return "inside";
  if (
    !/PERDE/i.test(play.name) &&
    play.players
      .filter((p) => ["LT", "LG", "C", "RG", "RT"].includes(p.id))
      .every((p) => !p.paths.length)
  )
    return "pass";
  return "diagram";
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
    id,
    source: "MOST",
    blocking: blocking ?? suggestedBlocking(play),
  };
  s.protection = { enabled: s.ravens.blocking === "pass", showDepth: 1.8 };
  s.zone = undefined;
  if (s.ravens.blocking === "inside" || s.ravens.blocking === "outside")
    s.zone = {
      enabled: true,
      variant: s.ravens.blocking,
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
  s.protection = {
    enabled: blocking === "pass",
    showDepth: s.protection?.showDepth ?? 1.8,
  };
  s.zone =
    blocking === "inside" || blocking === "outside"
      ? {
          ...s.zone,
          enabled: true,
          variant: blocking,
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
        detail: "Kaynakta savunma çizilmemiş",
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
export function planRavens(input: ScenarioType) {
  const meta = input.ravens!,
    play = ravensPlays.find((p) => p.id === meta.id);
  if (!play) throw Error("Ravens kaynağı bulunamadı");
  const roster = drawingRoster(play),
    s = structuredClone(input);
  const base =
    meta.blocking === "diagram"
      ? diagramPlan(s)
      : s.zone
        ? planZone(s)
        : planProtection(s);
  const out = base.scenario;
  const sourcePlayers = roster.filter((p) => {
    const player = out.players.find((q) => q.id === p.id);
    if (!player) return false;
    if (meta.blocking === "diagram") return true;
    if (!p.paths.length) return false;
    if (["LT", "LG", "C", "RG", "RT"].includes(player.pos)) return false;
    if (s.zone && ["QB", "RB"].includes(player.pos)) return false;
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
  // Shift the team episode after the imported pre-snap motion.
  out.actions = out.actions.filter(
    (a) => !sourcePlayers.some((p) => p.id === a.player),
  );
  for (const a of out.actions) {
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
  if (meta.blocking === "diagram")
    out.steps = [
      {
        title: "Kaynak dizilişi / motion",
        start: 0,
        end: snap,
        description:
          "MOST çizimindeki 11 ofans oyuncusu. Eklenen savunma örnek yerleşimdir; blok/okuma kuralları kaynakta belirtilmemiştir.",
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
      " Ravens çizim rotalarıyla birlikte; savunma örnek çalışma front’udur.";
    out.steps.at(-1)!.end = finish;
  }
  if (meta.blocking === "diagram") {
    out.blitz = "none";
    out.rules = [
      {
        id: "ravens-source",
        blitz: "none",
        title: "Kaynak çizim",
        note: "MOST kaynak yerleşimi ve yolları. Savunma çalışma front’udur; özel blok devirleri, QB okuması ve top hedefi kaynakta belirtilmemiştir.",
        assign: {},
      },
    ];
  }
  out.ravens = { ...meta };
  out.name = play.name;
  out.scheme = "Ravens · MOST";
  out.playbook = `Ravens MOST · ${blockingLabels[meta.blocking]}`;
  return { ...base, scenario: Scenario.parse(out) };
}
