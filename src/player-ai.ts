import { isRavensPass } from "./ravens-pass.ts";
import {
  type ScenarioType,
  type PlayerType,
  type ActionType,
} from "./model.ts";
export type AiPoint = [number, number];
export type AiBall = {
  at: [number, number, number];
  carrier?: string;
  phase?: "held" | "flight" | "complete" | "incomplete";
};
export type AiContact = { a: string; b: string; kind?: string };
export type AiObservation = {
  time: number;
  positions: Record<string, AiPoint>;
  velocities?: Record<string, AiPoint>;
  headings?: Record<string, number>;
  ball?: AiBall;
  contacts?: AiContact[];
};
export type AiSettings = {
  enabled: boolean;
  reaction: number;
  radius: number;
  memory: number;
  fov: number;
  decisionInterval: number;
};
export type AiFrameInput = {
  time: number;
  dt: number;
  snap?: number;
  positions: Record<string, AiPoint>;
  velocities?: Record<string, AiPoint>;
  headings?: Record<string, number>;
  routePositions: Record<string, AiPoint>;
  routeVelocities: Record<string, AiPoint>;
  contacts?: AiContact[];
  carrier?: string;
  callLandmarks?: Record<string, AiPoint>;
  readPast: (time: number) => AiObservation | undefined;
};
export type AiDecision = {
  velocityDelta: AiPoint;
  desiredVelocity?: AiPoint;
  aim: AiPoint;
  gaze?: string;
  lookAt?: AiPoint;
  phase: string;
  reason: string;
  seen: string[];
  remembered: string[];
  decisionAt: number;
  speedLimit: number;
};
type Seen = { id: string; at: AiPoint; velocity: AiPoint; time: number };
type Memory = {
  players: Map<string, Seen>;
  ball?: { value: AiBall; time: number; velocity: AiPoint };
  next: number;
  choiceUntil: number;
  lane: number;
  focus?: string;
  focusUntil?: number;
  offset: AiPoint;
  decision?: AiDecision;
  contactSince?: number;
};
export type FootballAi = {
  scenario: ScenarioType;
  settings: AiSettings;
  players: Map<string, PlayerType>;
  actions: Map<string, ActionType[]>;
  states: Map<string, Memory>;
  landmarks: Map<string, AiPoint>;
  manual: Set<string>;
  lastTime: number;
};
const line = ["LT", "LG", "C", "RG", "RT"];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const length = (p: AiPoint) => Math.hypot(p[0], p[1]);
const distance = (a: AiPoint, b: AiPoint) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
const add = (a: AiPoint, b: AiPoint): AiPoint => [a[0] + b[0], a[1] + b[1]];
const sub = (a: AiPoint, b: AiPoint): AiPoint => [a[0] - b[0], a[1] - b[1]];
const mul = (p: AiPoint, k: number): AiPoint => [p[0] * k, p[1] * k];
const finite = (p: AiPoint | undefined): p is AiPoint =>
  !!p && p.every(Number.isFinite);
function limited(p: AiPoint, max: number): AiPoint {
  const d = length(p);
  return d > max && d > 0 ? mul(p, max / d) : p;
}
function toward(from: AiPoint, to: AiPoint, speed: number): AiPoint {
  return limited(mul(sub(to, from), 7), speed);
}
function roleSpeed(p: PlayerType) {
  return p.side === "DEF"
    ? p.pos === "DL"
      ? 2.6
      : p.pos === "LB"
        ? 3.5
        : 4.1
    : line.includes(p.pos)
      ? 3.1
      : p.pos === "QB"
        ? 4.2
        : 4.8;
}
function deltaLimit(p: PlayerType) {
  return p.side === "DEF"
    ? p.pos === "DL"
      ? 0.7
      : p.pos === "LB"
        ? 1
        : 1.1
    : line.includes(p.pos)
      ? 0.4
      : p.pos === "QB"
        ? 0.45
        : 0.8;
}
function radius(p: PlayerType) {
  return p.side === "DEF"
    ? p.pos === "DL"
      ? 8
      : p.pos === "LB"
        ? 14
        : 22
    : 16;
}
const isDB = (p: PlayerType) => ["CB", "SS", "FS", "DB", "S"].includes(p.pos);
/** Deterministic football controllers. No learned model, randomness or external service. */
export function createFootballAi(
  s: ScenarioType,
  options: Partial<AiSettings> = {},
): FootballAi {
  const settings: AiSettings = {
    enabled: options.enabled ?? true,
    reaction: clamp(options.reaction ?? 0.25, 0.1, 0.8),
    radius: clamp(options.radius ?? 0.65, 0, 0.65),
    memory: clamp(options.memory ?? 1.2, 0.4, 2),
    fov: clamp(options.fov ?? 140, 80, 170),
    decisionInterval: clamp(options.decisionInterval ?? 0.18, 0.1, 0.5),
  };
  const players = new Map(s.players.map((p) => [p.id, p])),
    actions = new Map(
      s.players.map((p) => [
        p.id,
        s.actions
          .filter((a) => a.player === p.id)
          .sort((a, b) => a.start - b.start),
      ]),
    );
  const manual = new Set(
    s.actions
      .filter(
        (a) =>
          (!a.source || a.source === "manual") &&
          players.get(a.player)?.side === "DEF",
      )
      .map((a) => a.player),
  );
  const landmarks = new Map<string, AiPoint>();
  for (const p of s.players.filter((p) => p.side === "DEF")) {
    const called = (actions.get(p.id) ?? [])
      .filter(
        (a) =>
          a.source === "opponent" &&
          ["opponent-rush", "opponent-fit", "opponent-coverage"].includes(
            a.kind ?? "",
          ),
      )
      .at(-1);
    const anchor=s.defenseEdits?.[p.id]?.preSnap??p.at;
    const fallback: AiPoint =
      p.pos === "DL"
        ? [anchor[0], Math.min(-1.5, anchor[1] - 2)]
        : p.pos === "LB"
          ? [anchor[0], Math.max(0.65, anchor[1] - 1.2)]
          : [anchor[0], Math.max(6, anchor[1])];
    landmarks.set(p.id, called ? [...called.to] : fallback);
  }
  return {
    scenario: s,
    settings,
    players,
    actions,
    manual,
    landmarks,
    states: new Map(),
    lastTime: -Infinity,
  };
}
function initialMemory(): Memory {
  return {
    players: new Map(),
    next: -Infinity,
    choiceUntil: -Infinity,
    lane: 0,
    offset: [0, 0],
  };
}
function inSight(
  observer: PlayerType,
  point: AiPoint,
  frame: AiObservation,
  brain: FootballAi,
  high = false,
) {
  const origin = frame.positions[observer.id];
  if (!finite(origin)) return false;
  const d = distance(origin, point);
  if (d > radius(observer)) return false;
  if (d < 0.8) return true;
  const heading =
      frame.headings?.[observer.id] ?? (observer.side === "DEF" ? Math.PI : 0),
    bearing = Math.atan2(point[0] - origin[0], point[1] - origin[1]),
    angle = Math.abs(
      Math.atan2(Math.sin(bearing - heading), Math.cos(bearing - heading)),
    );
  if (angle > (brain.settings.fov * Math.PI) / 360) return false;
  if (high) return true;
  const ray = sub(point, origin),
    squared = ray[0] ** 2 + ray[1] ** 2;
  for (const [id, body] of Object.entries(frame.positions)) {
    if (
      id === observer.id ||
      !finite(body) ||
      distance(body, point) < 0.45 ||
      distance(body, origin) < 0.45
    )
      continue;
    const u =
      ((body[0] - origin[0]) * ray[0] + (body[1] - origin[1]) * ray[1]) /
      squared;
    if (u <= 0.05 || u >= 0.94) continue;
    const closest: AiPoint = [origin[0] + ray[0] * u, origin[1] + ray[1] * u];
    if (distance(body, closest) < 0.29) return false;
  }
  return true;
}
function perceive(
  brain: FootballAi,
  p: PlayerType,
  input: AiFrameInput,
  memory: Memory,
) {
  const delay =
      brain.settings.reaction +
      (p.side === "DEF" ? (isDB(p) ? 0.08 : p.pos === "LB" ? 0.04 : 0) : 0),
    readTime = Math.max(0, input.time - delay),
    frame = input.readPast(readTime),
    seen = new Set<string>();
  // Future or wrong-timestamp history callbacks cannot become a knowledge channel.
  if (frame && frame.time <= readTime + 1e-6 && frame.time <= input.time) {
    for (const [id, at] of Object.entries(frame.positions)) {
      if (
        id === p.id ||
        !brain.players.has(id) ||
        !finite(at) ||
        !inSight(p, at, frame, brain)
      )
        continue;
      const old = memory.players.get(id);
      if (old && old.time > frame.time) {
        seen.add(id);
        continue;
      }
      const dt = old ? frame.time - old.time : 0,
        velocity = finite(frame.velocities?.[id])
          ? frame.velocities![id]
          : dt > 0.001
            ? mul(sub(at, old!.at), 1 / dt)
            : ([0, 0] as AiPoint);
      memory.players.set(id, {
        id,
        at: [...at],
        velocity: limited(velocity, roleSpeed(brain.players.get(id)!)),
        time: frame.time,
      });
      seen.add(id);
    }
    const ball = frame.ball;
    if (
      ball &&
      ball.at.every(Number.isFinite) &&
      inSight(p, [ball.at[0], ball.at[2]], frame, brain, ball.at[1] > 1.8)
    ) {
      const previous = memory.ball,
        dt = previous ? frame.time - previous.time : 0;
      memory.ball = {
        value: {
          ...ball,
          at: [...ball.at],
          carrier:
            ball.carrier && seen.has(ball.carrier) ? ball.carrier : undefined,
        },
        time: frame.time,
        velocity:
          previous && dt > 0.001
            ? limited(
                [
                  (ball.at[0] - previous.value.at[0]) / dt,
                  (ball.at[2] - previous.value.at[2]) / dt,
                ],
                20,
              )
            : [0, 0],
      };
    }
  }
  // Tactile knowledge is immediate, participant-only and local. Global contact lists
  // cannot reveal remote opponents or an unseen carrier to everybody on the field.
  const own = finite(input.positions[p.id]) ? input.positions[p.id] : p.at;
  for (const c of input.contacts ?? []) {
    const id = c.a === p.id ? c.b : c.b === p.id ? c.a : undefined;
    if (!id) continue;
    const at = input.positions[id];
    if (!finite(at) || distance(own, at) > 1.15 || !brain.players.has(id))
      continue;
    memory.players.set(id, {
      id,
      at: [...at],
      velocity: [0, 0],
      time: input.time,
    });
    seen.add(id);
  }
  for (const [id, sighting] of memory.players)
    if (input.time - sighting.time > brain.settings.memory)
      memory.players.delete(id);
  if (memory.ball && input.time - memory.ball.time > brain.settings.memory)
    memory.ball = undefined;
  return {
    seen: [...seen].sort(),
    remembered: [...memory.players.keys()].filter((id) => !seen.has(id)).sort(),
  };
}
function predicted(seen: Seen, time: number): AiPoint {
  return add(
    seen.at,
    mul(seen.velocity, Math.min(0.35, Math.max(0, time - seen.time))),
  );
}
/** All foreign players below are sensory memory, never current input positions/routes. */
export function decideFootballAi(
  brain: FootballAi,
  input: AiFrameInput,
): Record<string, AiDecision> {
  if (input.time < brain.lastTime - 1e-6) brain.states.clear();
  brain.lastTime = input.time;
  const output: Record<string, AiDecision> = {};
  const bypass =
      !brain.settings.enabled ||
      brain.scenario.opponent?.mode === "source" ||
      brain.scenario.ravens?.blocking === "diagram",
    snap = input.snap ?? brain.scenario.steps[0]?.end ?? 1.1,
    center =
      brain.scenario.players.find((p) => p.side === "OFF" && p.pos === "C")
        ?.at[0] ?? 0;
  for (const p of brain.players.values()) {
    const own = finite(input.positions[p.id]) ? input.positions[p.id] : p.at,
      route = finite(input.routePositions[p.id])
        ? input.routePositions[p.id]
        : own,
      routeV = finite(input.routeVelocities[p.id])
        ? input.routeVelocities[p.id]
        : ([0, 0] as AiPoint),
      speed = roleSpeed(p),
      limit = deltaLimit(p);
    const disabled =
      bypass ||
      input.time < snap ||
      brain.manual.has(p.id) ||
      p.intent === "hold" ||
      p.intent === "show" ||
      p.reaction === "hold";
    if (disabled) {
      output[p.id] = {
        velocityDelta: [0, 0],
        desiredVelocity:
          p.side === "DEF" &&
          !bypass &&
          !brain.manual.has(p.id) &&
          (p.intent === "hold" || p.intent === "show" || p.reaction === "hold")
            ? [0, 0]
            : undefined,
        aim: [...route],
        phase: input.time < snap ? "pre-snap" : "coach-route",
        reason: "Çağrılan veya manuel yol korunuyor.",
        seen: [],
        remembered: [],
        decisionAt: input.time,
        speedLimit: speed,
      };
      continue;
    }
    let memory = brain.states.get(p.id);
    if (!memory) {
      memory = initialMemory();
      brain.states.set(p.id, memory);
    }
    for (const [id, item] of memory.players)
      if (input.time - item.time > brain.settings.memory)
        memory.players.delete(id);
    if (memory.ball && input.time - memory.ball.time > brain.settings.memory)
      memory.ball = undefined;
    if (input.time + 1e-8 >= memory.next) {
      const knowledge = perceive(brain, p, input, memory),
        visible = [...memory.players.values()],
        opponents = visible.filter(
          (o) => brain.players.get(o.id)!.side !== p.side,
        ),
        friends = visible.filter(
          (o) => brain.players.get(o.id)!.side === p.side,
        );
      const nearest = (list: Seen[], at: AiPoint = own) =>
        [...list].sort(
          (a, b) =>
            distance(predicted(a, input.time), at) -
              distance(predicted(b, input.time), at) ||
            a.id.localeCompare(b.id),
        )[0];
      const ownAction =
          p.side === "OFF"
            ? (brain.actions.get(p.id) ?? []).find(
                (a) => input.time >= a.start && input.time <= a.end,
              )
            : undefined,
        ownPhase = ownAction?.phases?.find(
          (ph) => input.time >= ph.start && input.time <= ph.end,
        )?.name;
      let aim: AiPoint = [...route],
        gaze: string | undefined,
        phase = "route",
        reason = "Çağrılan rota koridorunu sürdür.";
      const assigned =
          ownAction?.assignment !== "watch"
            ? (ownAction?.target ?? ownAction?.engage)
            : undefined,
        target = assigned ? memory.players.get(assigned) : undefined;
      const contact = (input.contacts ?? [])
        .filter((c) => c.a === p.id || c.b === p.id)
        .map((c) => memory!.players.get(c.a === p.id ? c.b : c.a))
        .find(
          (x): x is Seen =>
            !!x &&
            brain.players.get(x.id)?.side !== p.side &&
            distance(x.at, own) <= 1.15,
        );
      if (p.side === "OFF") {
        const offensivePass = isRavensPass(brain.scenario);
        const qb = brain.scenario.players.find(
            (q) => q.side === "OFF" && q.pos === "QB",
          ),
          meshCarrier = brain.scenario.zone?.enabled
            ? brain.scenario.players.find(
                (q) => q.side === "OFF" && q.pos === "RB",
              )?.id
            : brain.scenario.ravens?.carrier,
          meshAt = brain.scenario.zone?.enabled
            ? brain.scenario.actions.find(
                (a) => a.player === meshCarrier && a.label === "mesh",
              )?.end
            : brain.scenario.ravens?.transferAt,
          meshPair =
            !offensivePass &&
            meshCarrier &&
            meshCarrier !== qb?.id &&
            (p.id === qb?.id || p.id === meshCarrier) &&
            meshAt !== undefined &&
            input.time >= meshAt - 0.8 &&
            input.time <= meshAt + 0.2;
        const pullOpen =
          ownAction?.assignment === "pull" &&
          (["open", "run"].includes(ownPhase ?? "") ||
            (/source-pull/.test(ownAction.label) &&
              ownPhase !== "gather" &&
              ownPhase !== "strike"));
        if (
          pullOpen ||
          /screen-set|screen-delay/.test(ownAction?.label ?? "")
        ) {
          phase = "pull-route";
          reason = "Pull open/run: çağrılan arka hat yolu aynen korunur.";
          aim = [...route];
          gaze = assigned;
        } else if (
          meshPair ||
          /mesh|handoff|fake|follow-push/.test(ownAction?.label ?? "")
        ) {
          phase = "mesh";
          reason = "Mesh, fake veya destek zamanı değiştirilmez.";
          gaze = assigned;
        } else if (
          (line.includes(p.pos) || ["RB", "FB", "TE"].includes(p.pos)) &&
          assigned &&
          brain.players.get(assigned)?.side === "DEF"
        ) {
          phase = /climb|release/.test(ownAction?.label ?? "")
            ? "release"
            : "block";
          gaze = assigned;
          reason =
            "Yalnız mevcut atanmış adamın kaldıraç ve temasını aynala; başka adama geçme.";
          if (target) {
            const at = predicted(target, input.time);
            if (distance(own, at) <= 2.2) aim = [at[0], at[1] - 0.55];
          }
        } else if (line.includes(p.pos)) {
          phase = "line-route";
          reason = "Henüz adam ataması yok: çağrılan hat, yardım veya çıkış koridorunu koru.";
          aim = [...route];
        } else if (p.pos === "QB" && offensivePass) {
          phase = "qb-read";
          gaze = brain.scenario.ravens?.passTarget;
          reason =
            "Seçili pas hedefini koru; görülen baskıya küçük pocket düzeltmesi yap.";
          const rush = nearest(opponents);
          if (rush) {
            const at = predicted(rush, input.time);
            if (distance(own, at) < 2.2) {
              aim = add(route, mul(limited(sub(own, at), 1), 0.3));
              aim[1] = Math.min(-0.08, aim[1]);
            }
          }
        } else if (
          input.carrier === p.id ||
          memory.ball?.value.carrier === p.id
        ) {
          phase = "carrier-gap";
          reason =
            "Görülen savunma ve arkadaşlara göre çağrılan koridorda küçük boşluk seç.";
          const forward =
              length(routeV) > 0.1
                ? mul(routeV, 1 / length(routeV))
                : ([0, 1] as AiPoint),
            lateral: AiPoint = [forward[1], -forward[0]],
            candidate = (lane: number) =>
              add(route, mul(lateral, lane * brain.settings.radius * 0.8));
          const score = (lane: number) => {
            const test = add(candidate(lane), mul(forward, 0.7));
            let room = 3;
            for (const o of opponents)
              room = Math.min(room, distance(test, predicted(o, input.time)));
            for (const f of friends)
              room = Math.min(
                room,
                distance(test, predicted(f, input.time)) + 0.25,
              );
            return (
              room -
              Math.abs(lane) * 0.06 -
              Math.abs(lane - memory!.lane) * 0.07
            );
          };
          const choices = [0, -1, 1].sort(
              (a, b) => score(b) - score(a) || a - b,
            ),
            best = choices[0];
          if (
            input.time >= memory.choiceUntil ||
            score(best) > score(memory.lane) + 0.4
          ) {
            memory.lane = best;
            memory.choiceUntil = input.time + 0.45;
          }
          aim = candidate(memory.lane);
          gaze = nearest(opponents)?.id;
        } else {
          const obstacle = nearest(opponents);
          if (obstacle) {
            const at = predicted(obstacle, input.time);
            if (distance(at, own) < 1.15) {
              const tangent =
                  length(routeV) > 0.1
                    ? ([routeV[1], -routeV[0]] as AiPoint)
                    : ([1, 0] as AiPoint),
                side =
                  (at[0] - own[0]) * tangent[0] +
                    (at[1] - own[1]) * tangent[1] >=
                  0
                    ? -1
                    : 1;
              aim = add(route, mul(limited(tangent, 1), side * 0.28));
              phase = "route-release";
              gaze = obstacle.id;
              reason =
                "Rota ve derinlik korunarak görülen jam temasından küçük ayrılma.";
            }
          }
        }
      } else {
        // No offensive play metadata, selected pass target or other players' current
        // route/action targets are read in this defensive branch.
        const ball = memory.ball?.value,
          observedCarrier = ball?.carrier
            ? memory.players.get(ball.carrier)
            : undefined,
          quarterbacks = opponents.filter(
            (o) => brain.players.get(o.id)?.pos === "QB",
          ),
          qb = nearest(quarterbacks),
          ballPoint: AiPoint | undefined = ball
            ? add(
                [ball.at[0], ball.at[2]],
                mul(
                  memory.ball!.velocity,
                  Math.min(0.2, Math.max(0, input.time - memory.ball!.time)),
                ),
              )
            : undefined;
        const landmark = finite(input.callLandmarks?.[p.id])
          ? input.callLandmarks![p.id]
          : (brain.landmarks.get(p.id) ?? p.at);
        const edit=brain.scenario.defenseEdits?.[p.id];
        if(edit?.coverage==='man'){
          const mark=edit.target?memory.players.get(edit.target):undefined;
          phase='route-match';reason='Koçun seçtiği adamı görülen veya hatırlanan konumundan takip et.';
          aim=mark?add(predicted(mark,input.time),[0,.65]):landmark;gaze=mark?.id;
        } else if(edit?.coverage==='zone'){
          aim=edit.zone??landmark;phase='zone-landmark';reason='Koçun seçtiği coverage bölgesini koru.';
        } else if (p.pos === "DL" || p.intent === "blitz") {
          if (contact) {
            phase = "hand-fight";
            gaze = contact.id;
            reason =
              "Yalnız hissedilen blok teması üzerinden küçük kaldıraç/ayrılma.";
            memory.contactSince ??= input.time;
            const towardBall = observedCarrier
                ? predicted(observedCarrier, input.time)
                : qb
                  ? predicted(qb, input.time)
                  : landmark,
              side = Math.sign(towardBall[0] - own[0] || p.at[0] - center || 1);
            const shed = input.time - memory.contactSince > 0.45;
            aim = add(own, [side * (shed ? 0.16 : 0.05), shed ? -0.06 : -0.03]);
          } else {
            memory.contactSince = undefined;
            const known = observedCarrier ?? qb;
            gaze = known?.id;
            const laneFirst = input.time < snap + 0.65 || own[1] > 0.15,
              edge = Math.abs(p.at[0] - center) > 1.8;
            const pursuit = known ? predicted(known, input.time) : landmark;
            aim = laneFirst
              ? landmark
              : known
                ? [
                    pursuit[0] + (edge ? Math.sign(p.at[0] - center) * 0.5 : 0),
                    pursuit[1] + (edge ? 0.2 : 0),
                  ]
                : landmark;
            phase = laneFirst ? "rush-lane" : known ? "rush" : "rush-lane";
            reason = laneFirst
              ? "Önce çağrılan rush/slant koridorunu geç; erken içe çökme."
              : known
                ? "Görülen taşıyıcıya/QB’ye baskı; görünmeyen pas hedefi bilinmez."
                : "QB görülmüyor: yalnız çağrılan rush hattını sürdür.";
          }
        } else if (p.pos === "LB") {
          const guards = opponents.filter((o) =>
            ["LG", "RG", "LT", "RT"].includes(
              brain.players.get(o.id)?.pos ?? "",
            ),
          );
          const keys = guards.filter(
              (o) =>
                (Math.abs(o.velocity[0]) > 0.45 &&
                  Math.abs(o.velocity[0]) > Math.abs(o.velocity[1]) * 1.2 &&
                  o.at[1] < 0.6) ||
                o.velocity[1] > 0.25,
            ),
            key = nearest(keys),
            passSet = guards.some(
              (o) =>
                o.velocity[1] < -0.15 &&
                Math.abs(o.velocity[0]) <= Math.abs(o.velocity[1]) * 1.2,
            );
          const carrierPos = observedCarrier
            ? predicted(observedCarrier, input.time)
            : undefined;
          if (ball?.phase === "flight" && ballPoint) {
            phase = "ball-break";
            aim = ballPoint;
            reason =
              "Görülen uçuşa gecikmeli kırılma; guard hafızası uçan pası bastırmaz.";
          } else if (
            observedCarrier &&
            carrierPos &&
            (brain.players.get(observedCarrier.id)?.pos !== "QB" ||
              carrierPos[1] > 0.1)
          ) {
            phase = "rally";
            gaze = observedCarrier.id;
            aim = carrierPos;
            reason = "Gerçek görülen possession sonrası taşıyıcıya fit/rally.";
          } else if (key) {
            phase = "guard-read";
            gaze = key.id;
            const at = predicted(key, input.time);
            aim = [
              clamp(at[0], p.at[0] - 1.5, p.at[0] + 1.5),
              Math.max(0.6, Math.min(p.at[1] - 1, 1.8)),
            ];
            reason =
              "Görülen lateral pull/ileri drive anahtarını oku; mesh sonucunu varsayma.";
          } else if (passSet) {
            phase = "hook-read";
            aim = [landmark[0], Math.max(p.at[1], landmark[1])];
            gaze = qb?.id;
            reason =
              "Geri pas kick adımı görülüyor; downhill koşmak yerine hook derinliğini koru.";
          } else {
            phase = "gap-fit";
            aim = landmark;
            gaze = qb?.id;
            reason =
              "Top/guard anahtarı görülmüyor; çağrılan iç gap sorumluluğunu koru.";
          }
        } else if (isDB(p)) {
          const carrierPos = observedCarrier
            ? predicted(observedCarrier, input.time)
            : undefined;
          if (ball?.phase === "flight" && ballPoint) {
            phase = "ball-break";
            aim = ballPoint;
            reason = "Uçuş görüldükten sonra topa kırıl; hedef adı bilinmez.";
          } else if (
            observedCarrier &&
            carrierPos &&
            (brain.players.get(observedCarrier.id)?.pos !== "QB" ||
              carrierPos[1] > 0.1)
          ) {
            const side = Math.sign(p.at[0] - center || 1);
            phase = p.pos === "CB" || p.pos === "SS" ? "contain" : "rally";
            aim = [
              carrierPos[0] + (phase === "contain" ? side * 0.65 : 0),
              carrierPos[1] + 0.4,
            ];
            gaze = observedCarrier.id;
            reason =
              "Görülen koşu possession’ına dış kaldıraç/contain ile rally.";
          } else {
            const receivers = opponents.filter(
              (o) =>
                !line.includes(brain.players.get(o.id)?.pos ?? "") &&
                brain.players.get(o.id)?.pos !== "QB",
            );
            const closest = nearest(receivers, landmark),
              oldFocus = receivers.find((r) => r.id === memory!.focus);
            const match =
              oldFocus &&
              input.time < (memory.focusUntil ?? 0) &&
              distance(predicted(oldFocus, input.time), landmark) < 6.5 &&
              (!closest ||
                distance(predicted(oldFocus, input.time), landmark) <=
                  distance(predicted(closest, input.time), landmark) + 1)
                ? oldFocus
                : closest;
            if (match && match.id !== memory.focus) {
              memory.focus = match.id;
              memory.focusUntil = input.time + 0.45;
            }
            if (match && distance(predicted(match, input.time), landmark) < 6) {
              gaze = match.id;
              const at = predicted(match, input.time);
              aim = [
                clamp(at[0], landmark[0] - 3, landmark[0] + 3),
                Math.max(landmark[1] - 0.8, at[1] + 0.65),
              ];
              phase = "route-match";
              reason =
                "Kendi çağrılan drop bölgesinde yalnız görülen rota akışını izle.";
            } else {
              aim = landmark;
              phase = "zone-landmark";
              reason =
                "Rota veya top görülmüyor; kendi drop landmark’ını koru.";
            }
          }
        } else {
          phase = "defensive-read";
          aim = observedCarrier
            ? predicted(observedCarrier, input.time)
            : landmark;
          gaze = observedCarrier?.id;
          reason = "Yalnız görülen possession ve kendi çağrılan alanına tepki.";
        }
      }
      const offset = limited(sub(aim, route), brain.settings.radius);
      memory.offset = offset;
      memory.next = input.time + brain.settings.decisionInterval;
      const delta =
          phase === "pull-route" || phase === "mesh"
            ? ([0, 0] as AiPoint)
            : limited(mul(offset, 1.8), limit),
        safeAim = add(route, offset);
      memory.decision = {
        velocityDelta: delta,
        desiredVelocity:
          p.side === "DEF" ? toward(own, safeAim, speed) : undefined,
        aim: safeAim,
        gaze,
        lookAt:
          gaze && memory.players.has(gaze)
            ? predicted(memory.players.get(gaze)!, input.time)
            : phase === "qb-read" || (p.side === "OFF" && line.includes(p.pos) && !["pull-route", "mesh"].includes(phase))
              ? [own[0], own[1] + 5]
              : p.side === "DEF" && memory.ball
                ? [
                    memory.ball.value.at[0] + memory.ball.velocity[0] * 0.15,
                    memory.ball.value.at[2] + memory.ball.velocity[1] * 0.15,
                  ]
                : p.side === "DEF"
                  ? [own[0], own[1] - 5]
                  : undefined,
        phase,
        reason,
        ...knowledge,
        decisionAt: input.time,
        speedLimit: speed,
      };
    }
    const last = memory.decision!;
    const aim = add(route, limited(memory.offset, brain.settings.radius)),
      delta =
        last.phase === "pull-route" || last.phase === "mesh"
          ? ([0, 0] as AiPoint)
          : limited(mul(sub(aim, route), 1.8), limit);
    output[p.id] = {
      ...last,
      velocityDelta: delta,
      desiredVelocity: p.side === "DEF" ? toward(own, aim, speed) : undefined,
      aim,
      remembered: last.remembered.filter((id) => memory!.players.has(id)),
      seen: last.seen.filter((id) => memory!.players.has(id)),
    };
  }
  return output;
}
