import {
  position,
  type ScenarioType,
  type PlayerType,
} from "./model.ts";
import { ravensProfile } from "./ravens-catalog.ts";
export type PositionAccessor = (
  s: ScenarioType,
  id: string,
  t: number,
) => [number, number];
export type PassWindow = { snap: number; earliest: number; latest: number };
export type PassIntent = {
  target: string;
  qb: string;
  snap: number;
  releaseAt: number;
  catchAt: number;
  flightDuration: number;
  from: [number, number, number];
  to: [number, number, number];
  requestedResult: "auto" | "complete" | "incomplete";
};
export type PassTimeline = PassIntent & {
  outcome: "complete" | "incomplete";
  reason: string;
  defender?: string;
  stoppedAt?: number;
  failureAt?: [number, number, number];
};
export type PassState = {
  phase: "held" | "flight" | "complete" | "incomplete";
  carrier: string;
  possession?: string;
  blend: number;
  at: [number, number, number];
  target: string;
  releaseAt: number;
  catchAt: number;
  outcome: "pending" | "complete" | "incomplete";
  reason: string;
  defender?: string;
};
export const passTiming = {
  ballSpeed: 16,
  minimumFlight: 0.22,
  maximumFlight: 3.5,
  minimumSet: 0.35,
  catchRadius: 0.85,
  contestRadius: 0.85,
  deflectionRadius: 0.4,
  defenderReach: 1.9,
};
const line = ["LT", "LG", "C", "RG", "RT"];
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
const distance = (a: [number, number], b: [number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
export function isRavensPass(s: ScenarioType) {
  if (!s.ravens) return false;
  if (
    s.ravens.blocking === "inside" ||
    s.ravens.blocking === "outside" ||
    s.zone?.enabled
  )
    return false;
  if (s.ravens.blocking === "pass") return true;
  try {
    return ["pass", "rollout", "pass-wrap", "screen"].includes(
      ravensProfile(s.ravens.id).kind,
    );
  } catch {
    return false;
  }
}
/** Eligibility comes from an actual receiving route, not merely the player's letter. */
export function eligiblePassTargets(s: ScenarioType): PlayerType[] {
  if (!isRavensPass(s)) return [];
  const snap = s.steps[0]?.end ?? 1.1;
  const eligible = s.players.filter(
    (p) =>
      p.side === "OFF" &&
      !line.includes(p.pos) &&
      p.pos !== "QB" &&
      s.actions.some(
        (a) =>
          a.player === p.id &&
          a.end > snap &&
          a.label !== "motion" &&
          a.assignment !== "watch" &&
          (/rota|route|receive|screen/.test(a.label) ||
            (a.source === "ravens" &&
              a.target === undefined &&
              a.assignment === undefined)),
      ) &&
      !s.actions.some(
        (a) =>
          a.player === p.id &&
          a.end > snap &&
          (a.assignment === "pickup" ||
            a.assignment === "man" ||
            a.assignment === "combo" ||
            a.assignment === "slide" ||
            a.assignment === "gap" ||
            /pickup|pass-set|punch|special-hold|source-pull/.test(a.label)),
      ),
  );
  let screen = false;
  try {
    screen = ravensProfile(s.ravens!.id).kind === "screen";
  } catch {}
  if (!screen) return eligible;
  // Team call: Yüzük E7 is the screen to U.
  return eligible.filter((p) => p.id === "U");
}

function episodeEnd(s: ScenarioType) {
  return Math.max(0, ...s.steps.map((st) => st.end));
}
function qbCrossesLOS(
  s: ScenarioType,
  qb: PlayerType,
  snap: number,
  end: number,
) {
  let previous = snap;
  if (position(s, qb.id, snap)[1] > 0.03) return snap;
  for (let t = snap + 0.05; t <= end + 0.05; t += 0.05) {
    const at = Math.min(t, end);
    if (position(s, qb.id, at)[1] > 0.03) {
      let lo = previous,
        hi = at;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (position(s, qb.id, mid)[1] > 0.03) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    previous = at;
    if (at >= end) break;
  }
  return Infinity;
}
/** QB leads the authored play route. This is a fixed release solution, never homing. */
function solveFlight(
  s: ScenarioType,
  qb: string,
  target: string,
  releaseAt: number,
) {
  const from = position(s, qb, releaseAt);
  let duration = 0.5;
  for (let i = 0; i < 16; i++) {
    const to = position(s, target, releaseAt + duration),
      next = clamp(
        distance(from, to) / passTiming.ballSpeed,
        passTiming.minimumFlight,
        passTiming.maximumFlight,
      );
    if (Math.abs(next - duration) < 0.0001) {
      duration = next;
      break;
    }
    duration = (duration + next) / 2;
  }
  const to = position(s, target, releaseAt + duration);
  return {
    flightDuration: duration,
    from: [from[0], 0.84, from[1] + 0.25] as [number, number, number],
    to: [to[0], 1.02, to[1] + 0.25] as [number, number, number],
  };
}
export function passWindow(s: ScenarioType): PassWindow {
  const snap = s.steps[0]?.end ?? 1.1,
    earliest = snap + passTiming.minimumSet,
    end = episodeEnd(s),
    qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB");
  let latest = Math.min(
    end - passTiming.minimumFlight - 0.04,
    qb ? qbCrossesLOS(s, qb, snap, end) - 0.04 : end,
  );
  const target = eligiblePassTargets(s).find(
    (p) => p.id === s.ravens?.passTarget,
  );
  if (qb && target)
    for (let i = 0; i < 6; i++) {
      if (latest < earliest) break;
      const flight = solveFlight(s, qb.id, target.id, latest).flightDuration;
      const next = Math.min(latest, end - flight - 0.04);
      if (Math.abs(next - latest) < 0.001) break;
      latest = next;
    }
  return { snap, earliest, latest };
}
export function validatePassSelection(s: ScenarioType) {
  const window = passWindow(s),
    target = eligiblePassTargets(s).find((p) => p.id === s.ravens?.passTarget),
    releaseAt =
      s.ravens?.passReleaseAt ??
      clamp(
        window.snap + 1.6,
        window.earliest,
        Math.max(window.earliest, window.latest),
      );
  const invalid = (reason: string) => ({
    valid: false,
    reason,
    target,
    releaseAt,
    window,
  });
  if (!isRavensPass(s))
    return invalid("Bu oyun veya seçili blok şeması pas oyunu değil.");
  if (!s.ravens?.passTarget)
    return invalid("Pas hedefi seçilmedi; top QB’de kalır.");
  if (!target)
    return invalid(
      "Seçilen oyuncunun uygun bir pas rotası yok veya oyuncu blok görevinde.",
    );
  if (!Number.isFinite(releaseAt))
    return invalid("Pas çıkış zamanı sonlu bir sayı olmalı.");
  if (window.latest < window.earliest)
    return invalid(
      "Bu bölümde snap sonrası ve QB LOS’u geçmeden önce geçerli pas penceresi yok.",
    );
  if (releaseAt < window.earliest - 1e-6 || releaseAt > window.latest + 1e-6)
    return invalid(
      "Pas çıkışı snap sonrası hazırlık ile QB’nin LOS öncesi pas penceresi içinde olmalı.",
    );
  return {
    valid: true,
    reason: undefined as string | undefined,
    target,
    releaseAt,
    window,
  };
}
const intentCache = new WeakMap<
  ScenarioType,
  {
    key: string;
    actions: ScenarioType["actions"];
    players: ScenarioType["players"];
    value: PassIntent | null;
  }
>();
/** Only authored OFF route data participates in the launch. Live contact accessors never do. */
export function passIntent(s: ScenarioType): PassIntent | null {
  const key = JSON.stringify([
      s.ravens?.passTarget,
      s.ravens?.passReleaseAt,
      s.ravens?.passResult,
      s.ravens?.blocking,
      s.zone?.enabled,
      s.steps.map((x) => [x.start, x.end]),
    ]),
    cached = intentCache.get(s);
  if (
    cached?.key === key &&
    cached.actions === s.actions &&
    cached.players === s.players
  )
    return cached.value;
  const selection = validatePassSelection(s),
    qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB");
  let value: PassIntent | null = null;
  if (selection.valid && selection.target && qb) {
    const flight = solveFlight(
        s,
        qb.id,
        selection.target.id,
        selection.releaseAt,
      ),
      catchAt = selection.releaseAt + flight.flightDuration;
    if (catchAt <= episodeEnd(s) + 0.001)
      value = {
        ...flight,
        target: selection.target.id,
        qb: qb.id,
        snap: selection.window.snap,
        releaseAt: selection.releaseAt,
        catchAt,
        requestedResult: s.ravens?.passResult ?? "auto",
      };
  }
  intentCache.set(s, { key, actions: s.actions, players: s.players, value });
  return value;
}
function flightAt(intent: PassIntent, t: number): [number, number, number] {
  const u = clamp((t - intent.releaseAt) / intent.flightDuration, 0, 1),
    length = Math.hypot(
      intent.to[0] - intent.from[0],
      intent.to[2] - intent.from[2],
    ),
    arc = clamp(length * 0.11, 0.45, 2.7);
  return [
    intent.from[0] + (intent.to[0] - intent.from[0]) * u,
    intent.from[1] +
      (intent.to[1] - intent.from[1]) * u +
      4 * arc * u * (1 - u),
    intent.from[2] + (intent.to[2] - intent.from[2]) * u,
  ];
}
function evaluate(
  s: ScenarioType,
  intent: PassIntent,
  get: PositionAccessor,
  until: number,
): {
  outcome: "pending" | "complete" | "incomplete";
  reason: string;
  defender?: string;
  stoppedAt?: number;
  failureAt?: [number, number, number];
} {
  if (intent.requestedResult === "incomplete")
    return until < intent.catchAt
      ? { outcome: "pending", reason: "Eğitim dalı: eksik pas seçildi." }
      : {
          outcome: "incomplete",
          reason: "Eğitim dalı: eksik pas seçildi.",
          stoppedAt: intent.catchAt,
          failureAt: [...intent.to],
        };
  const defenders = s.players.filter((p) => p.side === "DEF");
  // Only the elapsed portion of the ball flight can be batted. No future DEF positions
  // affect the release or the visible ball before those instants happen.
  for (
    let t = intent.releaseAt + 0.07;
    intent.requestedResult !== "complete" &&
    t <= Math.min(until, intent.catchAt - 0.04) + 1e-6;
    t += 0.07
  ) {
    const ball = flightAt(intent, t);
    if (ball[1] > passTiming.defenderReach) continue;
    for (const d of defenders) {
      const at = get(s, d.id, t);
      if (
        Math.hypot(at[0] - ball[0], at[1] - ball[2]) <
        passTiming.deflectionRadius
      )
        return {
          outcome: "incomplete",
          reason: `${d.id} pas yoluna temas etti.`,
          defender: d.id,
          stoppedAt: t,
          failureAt: ball,
        };
    }
  }
  if (until < intent.catchAt)
    return {
      outcome: "pending",
      reason: "Top uçuşta; pas sonucu henüz oluşmadı.",
    };
  const receiver = get(s, intent.target, intent.catchAt),
    catchPoint: [number, number] = [intent.to[0], intent.to[2] - 0.25];
  if (distance(receiver, catchPoint) > passTiming.catchRadius)
    return {
      outcome: "incomplete",
      reason:
        "Alıcı temas veya yön değişimi nedeniyle sabit pas noktasına yetişemedi.",
      stoppedAt: intent.catchAt,
      failureAt: [...intent.to],
    };
  if (intent.requestedResult === "complete")
    return {
      outcome: "complete",
      reason:
        "Eğitim tercihi: alıcı pas noktasına ulaştığında tamamlanan dal gösterilir.",
    };
  const contest = defenders.find(
    (d) =>
      distance(get(s, d.id, intent.catchAt), receiver) <
      passTiming.contestRadius,
  );
  if (contest)
    return {
      outcome: "incomplete",
      reason: `${contest.id} alıcıyı yakın savunarak pası bozdu.`,
      defender: contest.id,
      stoppedAt: intent.catchAt,
      failureAt: [...intent.to],
    };
  return {
    outcome: "complete",
    reason: "Alıcı pas noktasına ulaştı; yakın savunma teması yok.",
  };
}
function releasedIntent(
  s: ScenarioType,
  intent: PassIntent,
  get: PositionAccessor,
): PassIntent {
  if (get === position) return intent;
  const actual = get(s, intent.qb, intent.releaseAt);
  return { ...intent, from: [actual[0], intent.from[1], actual[1] + 0.25] };
}
export function passTimeline(
  s: ScenarioType,
  get: PositionAccessor = position,
): PassTimeline | null {
  const planned = passIntent(s);
  if (!planned) return null;
  const intent = releasedIntent(s, planned, get);
  const outcome = evaluate(s, intent, get, intent.catchAt);
  return {
    ...intent,
    ...outcome,
    outcome: outcome.outcome === "complete" ? "complete" : "incomplete",
  };
}
export function passState(
  s: ScenarioType,
  t: number,
  get: PositionAccessor = position,
): PassState | null {
  const planned = passIntent(s);
  if (!planned || t < planned.snap) return null;
  const intent =
    t >= planned.releaseAt ? releasedIntent(s, planned, get) : planned;
  const common = {
    target: intent.target,
    releaseAt: intent.releaseAt,
    catchAt: intent.catchAt,
  };
  if (t < intent.releaseAt) {
    const at = get(s, intent.qb, t);
    return {
      ...common,
      phase: "held",
      carrier: intent.qb,
      possession: intent.qb,
      blend: 1,
      at: [at[0], 0.84, at[1] + 0.25],
      outcome: "pending",
      reason: "QB seçili pas çıkışını bekliyor.",
    };
  }
  const outcome = evaluate(s, intent, get, Math.min(t, intent.catchAt));
  if (outcome.outcome === "incomplete") {
    const stopped = outcome.stoppedAt ?? intent.catchAt,
      from = outcome.failureAt ?? intent.to,
      drop = clamp((t - stopped) / 0.5, 0, 1);
    return {
      ...common,
      ...outcome,
      phase: "incomplete",
      carrier: "",
      blend: 0,
      at: [from[0], from[1] + (0.12 - from[1]) * drop, from[2]],
      outcome: "incomplete",
    };
  }
  if (t < intent.catchAt)
    return {
      ...common,
      phase: "flight",
      carrier: "",
      blend: 0,
      at: flightAt(intent, t),
      outcome: "pending",
      reason: outcome.reason,
    };
  const at = get(s, intent.target, t);
  return {
    ...common,
    ...outcome,
    phase: "complete",
    carrier: intent.target,
    possession: intent.target,
    blend: 1,
    at: [at[0] + 0.22, 0.84, at[1] + 0.32],
    outcome: "complete",
  };
}
