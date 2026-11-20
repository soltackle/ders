import { authoredPosition as position, position as legacyPosition, motion, type ScenarioType, type PlayerType, type ActionType } from "./model.ts";
import { isRavensPass, passIntent, passState, type PassIntent } from "./ravens-pass.ts";
import { ravensBall,tossWindow } from "./ravens-ball.ts";
import { opponentPackages } from "./opponent.ts";
import { createFootballAi, decideFootballAi, type FootballAi, type AiDecision, type AiObservation } from "./player-ai.ts";

type Point = [number, number];
export type PlayContact = { a: string; b: string; kind: "block" | "body" | "tackle"; at: Point };
export type PlayEvent = { type: "tackle" | "sack" | "incomplete" | "out"; time: number; player: string; defender?: string; at: Point };
export type PlayFrame = { time: number; positions: Record<string, Point>; contacts: PlayContact[]; event?: PlayEvent; carrier?: string; decisions?: Record<string, AiDecision> };
type Frame = PlayFrame & { velocity: Point[]; distance: number[]; headings: Record<string, number>; bodyHeadings: Record<string, number> };
type Simulation = { frames: Frame[]; players: PlayerType[]; index: Map<string, number>; actions: Map<string, ActionType[]>; intent: PassIntent | null; pass: boolean; snap: number; end: number; dwell: Map<string, number>; caught?: boolean; ai?: FootballAi; callLandmarks: Record<string, Point> };
export const dynamicsTiming = { step: 1 / 30, bodyRadius: .32, tackleDwell: .22, acceleration: 9 };
const cache = new WeakMap<ScenarioType, Simulation>();
const line = ["LT", "LG", "C", "RG", "RT"];
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Point, n: number): Point => [a[0] * n, a[1] * n];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
function limit(p: Point, max: number): Point { const length = Math.hypot(...p); return length > max ? mul(p, max / length) : p; }
export const dynamicsEnabled = (s: ScenarioType) => !!s.ravens && s.ravens.enabled !== false && s.ravens.blocking !== "diagram" && s.opponent?.mode !== "source";
export const playerAiEnabled = (s: ScenarioType) => dynamicsEnabled(s) && s.playerAI?.enabled !== false;
export function fieldBounds(s: ScenarioType) {
  const center = s.hash === "left" ? 5 : s.hash === "right" ? -5 : 0;
  return { left: center - 24.4, right: center + 24.4, back: -30, front: 70 };
}
function speed(p: PlayerType) {
  if (p.side === "DEF") return p.pos === "DL" ? 2.6 : p.pos === "LB" ? 3.5 : 4.1;
  return line.includes(p.pos) ? 3.1 : p.pos === "QB" ? 4.2 : 4.8;
}
function mass(p: PlayerType) { return line.includes(p.pos) || p.pos === "DL" ? 120 : p.pos === "LB" ? 100 : p.pos === "RB" || p.pos === "FB" ? 92 : 82; }
function actionAt(sim: Simulation, id: string, t: number) { return sim.actions.get(id)?.find((a) => t >= a.start && t <= a.end); }
function blockPair(sim: Simulation, a: PlayerType, b: PlayerType, t: number) {
  if (a.side === b.side) return false;
  const off = a.side === "OFF" ? a : b, def = off === a ? b : a, action = actionAt(sim, off.id, t);
  if (!action || action.assignment === "watch" || (action.target !== def.id && action.engage !== def.id)) return false;
  const phase = action.phases?.find((p) => t >= p.start && t <= p.end)?.name;
  if (action.assignment === "pull" && ["open", "run"].includes(phase ?? "")) return false;
  return line.includes(off.pos) || ["RB", "FB", "TE"].includes(off.pos) || /block|down|punch|hold/.test(action.label);
}
function scriptedCarrier(s: ScenarioType, sim: Simulation, t: number) {
  if (t < sim.snap) return undefined;
  const qb = sim.players.find((p) => p.side === "OFF" && p.pos === "QB");
  if (sim.pass) {
    if (!sim.intent || t < sim.intent.releaseAt) return qb?.id;
    if (t < sim.intent.catchAt || !sim.caught) return undefined;
    return sim.intent.target;
  }
  const rb = sim.players.find((p) => p.side === "OFF" && p.pos === "RB"),
    transfer = s.zone?.enabled ? (s.actions.find((a) => a.player === rb?.id && a.label === "mesh")?.end ?? sim.snap + .8) : (s.ravens?.transferAt ?? sim.snap + .8);
  const toss=tossWindow(s);if(toss&&t>=toss.releaseAt&&t<toss.catchAt)return undefined;
  return t < transfer ? qb?.id : s.zone?.enabled ? rb?.id : (s.ravens?.carrier ?? qb?.id);
}
function initialize(s: ScenarioType) {
  let sim = cache.get(s);
  if (sim) return sim;
  const players = s.players, actions = new Map<string, ActionType[]>();
  for (const p of players) actions.set(p.id, s.actions.filter((a) => a.player === p.id).sort((a, b) => a.start - b.start));
  const pack = opponentPackages.find((p) => p.id === s.opponent?.id), callLandmarks: Record<string, Point> = {};
  for (const p of players.filter((p) => p.side === "DEF")) {
    const original = pack?.players.find((d) => d.id === p.id), end = original?.paths.at(-1)?.points.at(-1);
    const anchor=s.defenseEdits?.[p.id]?.preSnap??p.at;
    if (end) callLandmarks[p.id] = [anchor[0] + end[0], anchor[1] + end[1]];
  }
  const headings = Object.fromEntries(players.map((p) => [p.id, p.side === "DEF" ? Math.PI : 0]));
  sim = { players, actions, index: new Map(players.map((p, i) => [p.id, i])), frames: [{ time: 0, positions: Object.fromEntries(players.map((p) => [p.id, [...p.at] as Point])), velocity: players.map(() => [0, 0]), distance: players.map(() => 0), contacts: [], headings, bodyHeadings: {...headings} }], intent: passIntent(s), pass: isRavensPass(s), snap: s.steps[0]?.end ?? 1.1, end: Math.max(...s.steps.map((st) => st.end)), dwell: new Map(), ai: playerAiEnabled(s) ? createFootballAi(s) : undefined, callLandmarks };
  cache.set(s, sim);
  return sim;
}
function stored(sim: Simulation, id: string, time: number): Point {
  const sample = clamp(time / dynamicsTiming.step, 0, sim.frames.length - 1), index = Math.floor(sample), a = sim.frames[index].positions[id] ?? [0, 0], b = sim.frames[Math.min(index + 1, sim.frames.length - 1)].positions[id] ?? a, f = sample - index;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
function observation(s: ScenarioType, sim: Simulation, time: number): AiObservation {
  const t = clamp(time, 0, sim.frames.at(-1)!.time), index = Math.min(sim.frames.length - 1, Math.floor(t / dynamicsTiming.step + 1e-8)), frame = sim.frames[index],
    get = (_s: ScenarioType, id: string, at: number) => stored(sim, id, Math.min(at, t)),
    ballTime = frame.event && frame.event.type !== "incomplete" ? Math.min(t, frame.event.time) : t,
    possession = ravensBall(s, ballTime, get),
    holder = frame.carrier ? get(s, frame.carrier, t) : undefined,
    ball = possession ? { at: possession.at, carrier: possession.blend === 1 ? possession.carrier : undefined, phase: "phase" in possession ? possession.phase : "held" as const }
      : holder ? {at: [holder[0], .84, holder[1] + .2] as [number,number,number], carrier:frame.carrier, phase:"held" as const}
      : {at: [s.players.find((p) => p.pos === "C")?.at[0] ?? 0, .12, 0] as [number,number,number], phase:"held" as const};
  return { time:t, positions:Object.fromEntries(sim.players.map((p) => [p.id, stored(sim,p.id,t)])), velocities:Object.fromEntries(sim.players.map((p,i) => [p.id, [...frame.velocity[i]] as Point])), headings:{...frame.headings}, contacts:frame.contacts.map((c)=>({...c})), ball };
}
const turnToward = (from: number, to: number, max: number) => from + clamp(Math.atan2(Math.sin(to - from), Math.cos(to - from)), -max, max);
function advance(s: ScenarioType, sim: Simulation) {
  const dt = dynamicsTiming.step, previous = sim.frames.at(-1)!, t = previous.time + dt,
    old = sim.players.map((p) => previous.positions[p.id]), route = sim.players.map((p) => position(s, p.id, t)),
    bounds = fieldBounds(s), terminal = previous.event, carrier = terminal ? undefined : scriptedCarrier(s, sim, t),
    moving = sim.players.map((p) => (sim.actions.get(p.id) ?? []).some((a) => a.start <= t)),
    inverse = sim.players.map((p, i) => (!moving[i] && t < sim.snap) || (terminal?.type !== 'incomplete' && p.id === terminal?.player) ? 0 : 1 / mass(p));
  const runCarrier = s.zone?.enabled ? sim.players.find((p) => p.side === "OFF" && p.pos === "RB")?.id : s.ravens?.carrier,
    quarterback = sim.players.find((p) => p.side === "OFF" && p.pos === "QB")?.id,
    meshAt = s.zone?.enabled ? s.actions.find((a) => a.player === runCarrier && a.label === "mesh")?.end : s.ravens?.transferAt,
    mesh = !sim.pass && meshAt !== undefined && t >= meshAt - .8 && t <= meshAt + .2 && runCarrier !== quarterback ? new Set([runCarrier, quarterback]) : new Set<string | undefined>();
  let decisions = previous.decisions;
  if (sim.ai && !terminal && t >= sim.snap) {
    const next = decideFootballAi(sim.ai, {time:t,dt,snap:sim.snap,positions:previous.positions,velocities:Object.fromEntries(sim.players.map((p,i)=>[p.id,previous.velocity[i]])),headings:previous.headings,contacts:previous.contacts,carrier,
      routePositions:Object.fromEntries(sim.players.map((p,i)=>[p.id,p.side==='DEF'&&!sim.ai!.manual.has(p.id)?old[i]:route[i]])),
      routeVelocities:Object.fromEntries(sim.players.map((p,i)=>[p.id,p.side==='DEF'&&!sim.ai!.manual.has(p.id)?[0,0] as Point:mul(sub(route[i],position(s,p.id,previous.time)),1/dt)])),
      callLandmarks:sim.callLandmarks,readPast:(at)=>observation(s,sim,at)});
    // Each sampled frame owns its decision record. Later memory updates cannot
    // rewrite the past when scrubbing or replaying the episode.
    decisions = Object.fromEntries(Object.entries(next).map(([id,d])=>[id,{...d,aim:[...d.aim] as Point,lookAt:d.lookAt?[...d.lookAt] as Point:undefined,velocityDelta:[...d.velocityDelta] as Point,desiredVelocity:d.desiredVelocity?[...d.desiredVelocity] as Point:undefined,seen:[...d.seen],remembered:[...d.remembered]}]));
  }
  let velocity = sim.players.map((p, i): Point => {
    if (terminal) return terminal.type !== 'incomplete' && p.id === terminal.player ? [0, 0] : mul(previous.velocity[i], Math.exp(-dt * 8));
    if (!moving[i] && !decisions?.[p.id]?.desiredVelocity) return [0, 0];
    const before = position(s, p.id, previous.time), delta = mul(sub(route[i], before), 1 / dt), decision = decisions?.[p.id],
      steer = decision && p.side === 'OFF' && !mesh.has(p.id) && !['mesh','pull-route','coach-route'].includes(decision.phase),
      offset = steer ? limit(sub(decision.aim,route[i]),.65) : [0,0] as Point,
      anchor = add(before,offset), correction = limit(mul(sub(anchor, old[i]), steer ? 1.6 : 1.2), steer ? .8 : .55),
      controlled = decision && p.side === "DEF" && decision.desiredVelocity ? decision.desiredVelocity : add(delta, correction),
      intended = limit(controlled, speed(p)),
      acceleration = limit(sub(intended, previous.velocity[i]), dynamicsTiming.acceleration * dt);
    return limit(add(previous.velocity[i], acceleration), speed(p));
  });
  // Teammates yield locally instead of locking face-to-face at a route crossing.
  // The correction is lateral and limited to a narrow corridor around the play.
  if (!terminal) for (let i = 0; i < sim.players.length; i++) for (let j = i + 1; j < sim.players.length; j++) {
    if (sim.players[i].side !== sim.players[j].side) continue;
    if (mesh.has(sim.players[i].id) && mesh.has(sim.players[j].id)) continue;
    const d = sub(old[j], old[i]), length = Math.hypot(...d), relative = sub(velocity[j], velocity[i]);
    if (length > 1.25 || length < .001 || dot(d, relative) >= -.01) continue;
    for (const k of [i, j]) {
      const v = velocity[k], lengthV = Math.hypot(...v);
      if (lengthV < .12 || dist(old[k], route[k]) > .85) continue;
      const other = k === i ? j : i, tangent: Point = [-v[1] / lengthV, v[0] / lengthV], toward = sub(old[other], old[k]), across = dot(toward, tangent), side = Math.abs(across) > .05 ? -Math.sign(across) : 1;
      if (mesh.has(sim.players[k].id) && !mesh.has(sim.players[other].id)) continue;
      velocity[k] = limit(add(v, mul(tangent, side * Math.min(1.1, (1.25 - length) * 2))), speed(sim.players[k]));
    }
  }
  // A contacted OL/DL pair advances together. Drive is limited; an arrow cannot
  // drag a defender across the field or establish contact from several yards away.
  if (!terminal && t >= sim.snap)
    for (let i = 0; i < sim.players.length; i++) for (let j = i + 1; j < sim.players.length; j++) {
      if (dist(old[i], old[j]) > .81 || !blockPair(sim, sim.players[i], sim.players[j], t)) continue;
      const d = sub(old[j], old[i]), length = Math.hypot(...d); if (length < 1e-6) continue;
      const normal = mul(d, 1 / length), vi = dot(velocity[i], normal), vj = dot(velocity[j], normal);
      if (vj >= vi) continue;
      const common = clamp((vi * mass(sim.players[i]) + vj * mass(sim.players[j])) / (mass(sim.players[i]) + mass(sim.players[j])), sim.pass ? -.32 : -.45, sim.pass ? .22 : .7);
      velocity[i] = add(velocity[i], mul(normal, common - vi));
      velocity[j] = add(velocity[j], mul(normal, common - vj));
    }
  const at = old.map((p, i) => add(p, mul(velocity[i], dt))), contacts = new Map<string, PlayContact>();
  // Small fixed steps prevent tunnelling; repeated local projections handle piles.
  // Before snap, only the moving player yields to a stationary teammate's alignment.
  for (let iteration = 0; iteration < 6; iteration++)
    for (let i = 0; i < sim.players.length; i++) for (let j = i + 1; j < sim.players.length; j++) {
      if (t < sim.snap && !moving[i] && !moving[j]) continue;
      const a = sim.players[i], b = sim.players[j], d = sub(at[j], at[i]), length = Math.hypot(...d), separation = dynamicsTiming.bodyRadius * 2,
        block = blockPair(sim, a, b, t);
      if (length > separation + (block ? .2 : .075)) continue;
      const hasCarrier = a.id === carrier || b.id === carrier,
        kind = block ? "block" : a.side !== b.side && hasCarrier ? "tackle" : "body";
      contacts.set(`${i}/${j}`, { a: a.id, b: b.id, kind, at: mul(add(at[i], at[j]), .5) });
      if (length >= separation || inverse[i] + inverse[j] === 0) continue;
      const fallback = sub(old[j], old[i]), norm = length > 1e-8 ? mul(d, 1 / length) : Math.hypot(...fallback) > 1e-8 ? mul(fallback, 1 / Math.hypot(...fallback)) : ([i % 2 ? 1 : -1, 0] as Point),
        penetration = separation - length + .0001,
        wi = inverse[i] * (a.side === "OFF" && b.side === "OFF" && mesh.has(a.id) && !mesh.has(b.id) ? .15 : 1),
        wj = inverse[j] * (a.side === "OFF" && b.side === "OFF" && mesh.has(b.id) && !mesh.has(a.id) ? .15 : 1), total = wi + wj;
      at[i] = add(at[i], mul(norm, -penetration * wi / total));
      at[j] = add(at[j], mul(norm, penetration * wj / total));
    }
  let event = terminal;
  for (let i = 0; i < at.length; i++) {
    const outside = at[i][0] <= bounds.left + dynamicsTiming.bodyRadius || at[i][0] >= bounds.right - dynamicsTiming.bodyRadius || at[i][1] <= bounds.back + dynamicsTiming.bodyRadius || at[i][1] >= bounds.front - dynamicsTiming.bodyRadius;
    at[i] = [clamp(at[i][0], bounds.left + dynamicsTiming.bodyRadius, bounds.right - dynamicsTiming.bodyRadius), clamp(at[i][1], bounds.back + dynamicsTiming.bodyRadius, bounds.front - dynamicsTiming.bodyRadius)];
    if (!event && outside && sim.players[i].id === carrier) event = { type: "out", time: t, player: carrier, at: [...at[i]] };
  }
  const headings:Record<string,number> = {}, bodyHeadings:Record<string,number> = {};
  for (let i=0;i<sim.players.length;i++) {
    const p=sim.players[i], d=decisions?.[p.id],
      look=d?.lookAt??d?.aim, direction=look&&dist(look,at[i])>.015?Math.atan2(look[0]-at[i][0],look[1]-at[i][1]):previous.headings[p.id],
      v=sub(at[i],old[i]), moveHeading=Math.hypot(...v)>.004?Math.atan2(v[0],v[1]):previous.bodyHeadings[p.id],
      action=actionAt(sim,p.id,t),phase=action?.phases?.find((ph)=>t>=ph.start&&t<=ph.end)?.name,
      pulling=action?.assignment==='pull'&&['open','run'].includes(phase??''),
      readingQuarterback=p.side==='OFF'&&p.pos==='QB'&&sim.pass&&(!sim.intent||t<=sim.intent.releaseAt+.2),
      desired=p.side==='DEF'&&d&&d.phase!=='coach-route'?direction:(line.includes(p.pos)&&!pulling)||readingQuarterback?clamp(Math.atan2(Math.sin(direction),Math.cos(direction)),-1.15,1.15):moveHeading,
      body=turnToward(previous.bodyHeadings[p.id],desired,dt*5.5),headOffset=clamp(Math.atan2(Math.sin(direction-body),Math.cos(direction-body)),-.65,.65);
    bodyHeadings[p.id]=body;headings[p.id]=body+headOffset;
  }
  const frame: Frame = { time: t, positions: Object.fromEntries(sim.players.map((p, i) => [p.id, at[i]])), velocity: at.map((p, i) => limit(mul(sub(p, old[i]), 1 / dt), speed(sim.players[i]) + .4)), distance: at.map((p, i) => previous.distance[i] + dist(p, old[i])), contacts: [...contacts.values()], carrier, event, decisions, headings, bodyHeadings };
  sim.frames.push(frame);
  // The throw is fixed at release. The catch is evaluated only once the simulated
  // timeline actually reaches it, using the positions already observed in this cache.
  if (!event && sim.intent && !sim.caught && t >= sim.intent.releaseAt) {
    const result = passState(s, t, (_s, id, time) => stored(sim, id, time));
    if (result?.outcome === "incomplete") event = { type: "incomplete", time: t, player: sim.intent.target, defender: result.defender, at: stored(sim, sim.intent.target, t) };
    else if (result?.outcome === "complete") {
      sim.caught = true;
      frame.carrier = sim.intent.target;
    }
  }
  if (!event && t >= sim.snap + .15) {
    const holder = frame.carrier;
    if (holder) for (const p of sim.players.filter((p) => p.side === "DEF" && p.intent !== "show" && p.intent !== "hold")) {
      const holderAt = frame.positions[holder], defAt = frame.positions[p.id], key = `${holder}/${p.id}`, close = dist(holderAt, defAt) <= .73,
        dwell = close ? (sim.dwell.get(key) ?? 0) + dt : 0;
      sim.dwell.set(key, dwell);
      if (dwell + 1e-6 < dynamicsTiming.tackleDwell) continue;
      const qb = sim.players.find((p) => p.id === holder)?.pos === "QB", behindLOS = holderAt[1] < 0;
      event = { type: qb && behindLOS && sim.pass ? "sack" : "tackle", time: t, player: holder, defender: p.id, at: [...holderAt] };
      break;
    }
  }
  frame.event = event;
}
export function playFrame(s: ScenarioType, time: number): PlayFrame {
  const t = Math.max(0, time);
  if (!dynamicsEnabled(s)) return { time: t, positions: Object.fromEntries(s.players.map((p) => [p.id, legacyPosition(s, p.id, t)])), contacts: [] };
  const sim = initialize(s), target = Math.min(Math.max(t, 0), sim.end + 1);
  while (sim.frames.at(-1)!.time < target - 1e-7) advance(s, sim);
  const index = Math.min(sim.frames.length - 1, Math.floor(target / dynamicsTiming.step + 1e-8)), lower = sim.frames[index], upper = sim.frames[Math.min(index + 1, sim.frames.length - 1)], event = upper.event && upper.event.time <= t + 1e-7 ? upper.event : lower.event;
  return { time: t, positions: Object.fromEntries(sim.players.map((p) => [p.id, stored(sim, p.id, target)])), contacts: lower.contacts, carrier: lower.carrier, event, decisions:lower.decisions };
}
export function worldPosition(s: ScenarioType, id: string, time: number): Point {
  if (!dynamicsEnabled(s)) return legacyPosition(s, id, time);
  const sim = initialize(s), target = clamp(time, 0, sim.end + 1);
  while (sim.frames.at(-1)!.time < target - 1e-7) advance(s, sim);
  return stored(sim, id, target);
}
export function worldMotion(s: ScenarioType, id: string, time: number) {
  const raw = motion(s, id, time);
  if (!dynamicsEnabled(s)) return raw;
  const at = worldPosition(s, id, time), before = worldPosition(s, id, Math.max(0, time - .025)), after = worldPosition(s, id, time + .025),
    dx = after[0] - before[0], dz = after[1] - before[1], moving = Math.hypot(dx, dz) > .0001,
    sim = initialize(s), samples = Math.min(sim.frames.length - 1, Math.floor(time / dynamicsTiming.step)), ai=sim.frames[samples]?.decisions?.[id],
    target = raw.action?.gaze ?? raw.action?.target, aim = !ai && target ? worldPosition(s, target, time) : after;
  // Arc length of the resolved track drives the stride, so a stopped player does
  // not keep running in place just because the authored arrow continues forward.
  let distance = sim.frames[samples]?.distance[sim.index.get(id) ?? 0] ?? 0;
  if (samples >= 0) distance += dist(sim.frames[samples].positions[id], at);
  return { ...raw, at, distance, speed: Math.hypot(dx, dz) / .05, heading: ai?sim.frames[samples].bodyHeadings[id]:moving ? Math.atan2(dx, dz) : raw.heading, gaze:ai?sim.frames[samples].headings[id]:target ? Math.atan2(aim[0] - at[0], aim[1] - at[1]) : moving ? Math.atan2(dx, dz) : raw.gaze };
}
