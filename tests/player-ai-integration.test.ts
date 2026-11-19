import { test } from "node:test";
import assert from "node:assert/strict";
import { Scenario, position, authoredPosition, type ScenarioType, type PlayerType, type ActionType } from "../src/model.ts";
import { ravensProfile } from "../src/ravens-catalog.ts";
import { createFootballAi, decideFootballAi } from "../src/player-ai.ts";
import { playFrame, worldPosition, worldMotion, playerAiEnabled, dynamicsEnabled } from "../src/play-dynamics.ts";
import { ravensPlays, ravensScenario, planRavens } from "../src/ravens.ts";
import { applyOpponentPackage, opponentPackages } from "../src/opponent.ts";
import { passIntent } from "../src/ravens-pass.ts";

type Point = [number, number];
type Positions = Record<string, Point>;
const player = (id: string, pos: string, side: "OFF" | "DEF", at: Point): PlayerType => ({ id, pos, side, at, stance: "2pt", intent: "auto" });
function fixture(actions?: ActionType[]) {
  return Scenario.parse({
    version: 1, name: "Role AI integration", scheme: "Ravens", hash: "middle", fieldSide: "right", blitz: "none",
    ravens: { enabled: true, id: ravensProfile(1).id, blocking: "pass", source: "MOST", passTarget: "X", passReleaseAt: 4 },
    players: [
      player("LG", "LG", "OFF", [-1, 0]), player("Q", "QB", "OFF", [0, -4]), player("H", "RB", "OFF", [1.5, -3]),
      player("X", "WR", "OFF", [0, 1]), player("Y", "WR", "OFF", [6, 1]),
      player("D1", "DL", "DEF", [-1, 1]), player("D2", "DL", "DEF", [3, 1]),
      player("M", "LB", "DEF", [2, 3]), player("C", "CB", "DEF", [0, 4]), player("F", "FS", "DEF", [4, 7]),
    ],
    actions: actions ?? [
      { player: "LG", source: "protection", label: "punch", assignment: "man", target: "D1", start: 1, end: 8, to: [-1, -.5] },
      { player: "Q", source: "ravens", label: "kaynak-rota", start: 1, end: 8, to: [0, -4] },
      { player: "X", source: "ravens", label: "kaynak-rota", start: 1, end: 8, to: [0, 15] },
      { player: "Y", source: "ravens", label: "kaynak-rota", start: 1, end: 8, to: [6, 15] },
      { player: "D1", source: "opponent", label: "opponent-rush", start: 1, end: 8, to: [-1, -1] },
      { player: "D2", source: "opponent", label: "opponent-rush", start: 1, end: 8, to: [3, -1] },
      { player: "M", source: "opponent", label: "opponent-coverage", start: 1, end: 8, to: [2, 3] },
      { player: "C", source: "opponent", label: "opponent-coverage", start: 1, end: 8, to: [0, 4] },
      { player: "F", source: "opponent", label: "opponent-coverage", start: 1, end: 8, to: [4, 7] },
    ],
    steps: [
      { title: "Read", start: 0, end: 1, description: "Read alignment", notes: {}, focus: [] },
      { title: "Play", start: 1, end: 8, description: "Run called assignment", notes: {}, focus: [] },
    ],
  });
}
const positions = (s: ScenarioType): Positions => Object.fromEntries(s.players.map((p) => [p.id, [...p.at] as Point]));
const zeros = (s: ScenarioType): Positions => Object.fromEntries(s.players.map((p) => [p.id, [0, 0] as Point]));
const headings = (s: ScenarioType) => Object.fromEntries(s.players.map((p) => [p.id, p.side === "DEF" ? Math.PI : 0]));
const settings = { enabled: true, reaction: .25, radius: .65, memory: 1.2, fov: 140, decisionInterval: .18 };
function input(s: ScenarioType, time: number, observed: Positions = positions(s)) {
  const calls: number[] = [];
  return {
    calls,
    value: {
      time, dt: 1 / 30, snap: 1, positions: positions(s), velocities: zeros(s), headings: headings(s), routePositions: positions(s), routeVelocities: zeros(s), contacts: [] as { a: string; b: string; kind?: "block" | "body" | "tackle" }[],
      readPast: (t: number) => {
        calls.push(t);
        return { time: t, positions: structuredClone(observed), velocities: zeros(s), headings: headings(s), ball: { at: [0, .84, -4] as [number, number, number], carrier: "Q" as string | undefined, phase: "held" as "held" | "flight" | "complete" | "incomplete" }, contacts: [] };
      },
    },
  };
}

test("DEF decisions depend on delayed observations rather than other players' current or future route positions", () => {
  const s = fixture(), left = input(s, 2), right = input(s, 2);
  left.value.positions.X = [-10, 2];
  right.value.positions.X = [10, 2];
  left.value.routePositions.X = [-20, 20];
  right.value.routePositions.X = [20, 20];
  left.value.routeVelocities.X = [-4, 0];
  right.value.routeVelocities.X = [4, 0];
  const a = decideFootballAi(createFootballAi(s, settings), left.value), b = decideFootballAi(createFootballAi(s, settings), right.value);
  for (const id of ["D1", "D2", "M", "C", "F"]) assert.deepEqual(a[id], b[id], id + " leaked a current/future OFF route");
  assert.ok(left.calls.length);
  assert.ok([...left.calls, ...right.calls].every((t) => t <= 1.75 + 1e-6), "DEF cannot sample a future or reaction-free frame");
});

test("hidden chosen pass target and option metadata cannot reveal the offense's decision to DEF", () => {
  const a = fixture(), b = structuredClone(a);
  b.ravens!.passTarget = "Y";
  b.ravens!.optionRead = "keep";
  b.ravens!.carrier = "Y";
  b.actions.find((x) => x.player === "X")!.to = [-14, 25];
  const beforeA = JSON.stringify(a), beforeB = JSON.stringify(b), x = input(a, 2), y = input(b, 2);
  y.value.routePositions = structuredClone(x.value.routePositions);
  y.value.routeVelocities = structuredClone(x.value.routeVelocities);
  const da = decideFootballAi(createFootballAi(a, settings), x.value), db = decideFootballAi(createFootballAi(b, settings), y.value);
  for (const id of ["D1", "D2", "M", "C", "F"]) assert.deepEqual(da[id], db[id], id + " read hidden offensive metadata");
  assert.equal(JSON.stringify(a), beforeA);
  assert.equal(JSON.stringify(b), beforeB);
});

test("DEF steering changes when the delayed visible carrier really changes position", () => {
  const s = fixture(), pastA = positions(s), pastB = positions(s);
  pastA.H = [-1, 2]; pastB.H = [1, 2];
  const a = input(s, 3, pastA), b = input(s, 3, pastB);
  for (const x of [a, b]) {
    const read = x.value.readPast;
    x.value.readPast = (t) => ({ ...read(t), ball: { at: [...(x === a ? pastA.H : pastB.H).slice(0, 1), .84, (x === a ? pastA.H : pastB.H)[1]] as [number, number, number], carrier: "H", phase: "held" as const } });
    x.value.positions.H = [12, 20];
    x.value.routePositions.H = [12, 20];
  }
  const da = decideFootballAi(createFootballAi(s, settings), a.value), db = decideFootballAi(createFootballAi(s, settings), b.value);
  assert.ok(da.C.aim[0] < db.C.aim[0], "a corner must pursue observed contact-world movement, not the raw ghost route");
});

test("covered OL keeps the coach's assigned defender when an unrelated defender is closer", () => {
  const s = fixture(), sensed = positions(s), x = input(s, 2, sensed);
  sensed.D1 = [-1, .8]; sensed.D2 = [-.9, .3];
  x.value.positions.LG = [-1, 0];
  const result = decideFootballAi(createFootballAi(s, settings), x.value);
  assert.equal(result.LG.gaze, "D1");
  assert.equal(s.actions.find((a) => a.player === "LG")!.target, "D1");
});

test("pull open/run phases and a WR's route remain under the called play's authority", () => {
  const s = fixture();
  s.actions[0] = { player: "LG", source: "ravens", label: "source-pull", assignment: "pull", target: "D2", start: 1, end: 5, to: [4, 1], phases: [
    { name: "open", start: 1, end: 2 }, { name: "run", start: 2, end: 4 }, { name: "gather", start: 4, end: 4.5 }, { name: "strike", start: 4.5, end: 5 },
  ] };
  const before = JSON.stringify(s), brain = createFootballAi(s, settings);
  for (const time of [1.5, 2.5, 3.5]) {
    const x = input(s, time), d = decideFootballAi(brain, x.value);
    assert.deepEqual(d.LG.velocityDelta, [0, 0], "AI must not cancel or retarget a pull before gather");
    assert.ok(Math.hypot(d.X.aim[0] - x.value.routePositions.X[0], d.X.aim[1] - x.value.routePositions.X[1]) <= .65001);
  }
  assert.equal(JSON.stringify(s), before, "steering must not rewrite the authored source play");
});

test("another pair's current contact does not reveal an unseen carrier", () => {
  const s = fixture(), hidden = positions(s);
  hidden.H = [0, 8];
  const a = input(s, 2, hidden), b = input(s, 2, hidden);
  for (const x of [a, b]) {
    x.value.positions.H = [0, 4.5];
    x.value.routePositions.H = [0, 4.5];
  }
  b.value.contacts = [{ a: "D2", b: "H", kind: "tackle" }];
  const da = decideFootballAi(createFootballAi(s, settings), a.value), db = decideFootballAi(createFootballAi(s, settings), b.value);
  assert.deepEqual(da.C, db.C, "a corner cannot inherit a teammate's unsensed contact information");
  assert.ok(!db.C.seen.includes("H"));
});

test("a target leaving the historical field of view is remembered briefly and then forgotten", () => {
  const s = fixture(), brain = createFootballAi(s, settings), first = input(s, 2), seen = decideFootballAi(brain, first.value);
  assert.ok(seen.C.seen.includes("X"));
  const hidden = positions(s);
  hidden.X = [0, 8];
  const next = input(s, 2.6, hidden);
  next.value.positions.X = [0, 8];
  const remembered = decideFootballAi(brain, next.value);
  assert.ok(!remembered.C.seen.includes("X"));
  assert.ok(remembered.C.remembered.includes("X"));
  const later = input(s, 3.6, hidden);
  later.value.positions.X = [0, 8];
  const forgotten = decideFootballAi(brain, later.value);
  assert.ok(!forgotten.C.remembered.includes("X"));
});

test("a LB distinguishes a backward pass kick from a pull and prioritizes a visible thrown ball", () => {
  const s = fixture(), observable = positions(s);
  observable.X = [8, 8];
  observable.D1 = [-6, 1];
  observable.D2 = [7, 1];
  const held = input(s, 2.5, observable), flight = input(s, 2.5, observable);
  for (const x of [held, flight]) {
    const previous = x.value.readPast;
    x.value.readPast = (t) => {
      const frame = previous(t);
      frame.velocities.LG = [0, -.8];
      return frame;
    };
  }
  const heldDecision = decideFootballAi(createFootballAi(s, settings), held.value);
  assert.ok(heldDecision.M.seen.includes("LG"), "the fixture must expose the backward pass kick to the LB");
  assert.ok(!/guard-read|run-fit/.test(heldDecision.M.phase), "a centered backward pass set is not a pulling guard cue");
  const read = flight.value.readPast;
  flight.value.readPast = (t) => ({ ...read(t), ball: { at: [1, 1.2, -1] as [number, number, number], carrier: undefined, phase: "flight" } });
  const thrownDecision = decideFootballAi(createFootballAi(s, settings), flight.value);
  assert.equal(thrownDecision.M.phase, "ball-break", "a guard's old movement cannot suppress a visible ball in flight");
});

test("an explicitly authored DEF path keeps priority over a hold/show stance hint", () => {
  for (const intent of ["hold", "show"] as const) {
    const s = fixture();
    s.players.find((p) => p.id === "D1")!.intent = intent;
    const action = s.actions.find((a) => a.player === "D1")!;
    action.source = "manual";
    action.label = "coach-specific-path";
    action.to = [-2, -2];
    const x = input(s, 2), d = decideFootballAi(createFootballAi(s, settings), x.value);
    assert.equal(d.D1.desiredVelocity, undefined, "manual route ownership must not be replaced by a stationary AI command");
    assert.deepEqual(d.D1.velocityDelta, [0, 0]);
    assert.deepEqual(action.to, [-2, -2]);
  }
});

test("a pass QB with no selected receiver keeps the pocket/read role without inventing a target", () => {
  const s = fixture();
  s.ravens!.passTarget = undefined;
  s.ravens!.passReleaseAt = undefined;
  const x = input(s, 2);
  const frameInput = { ...x.value, carrier: "Q" };
  const decision = decideFootballAi(createFootballAi(s, settings), frameInput);
  assert.equal(decision.Q.phase, "qb-read");
  assert.equal(s.ravens!.passTarget, undefined);
  assert.ok(!["X", "Y"].includes(decision.Q.gaze ?? ""), "receiver choice remains with the user");
});

test("runtime DEF movement cannot inherit an old reactive route's hidden offensive target", () => {
  const a = fixture(), b = structuredClone(a);
  for (const s of [a, b]) {
    s.playerAI = { enabled: true, showDecisions: true };
    const corner = s.actions.find((x) => x.player === "C")!;
    corner.kind = "opponent-reactive";
    corner.label = "opponent-react-match";
  }
  a.actions.find((x) => x.player === "C")!.to = [-5, 10];
  b.actions.find((x) => x.player === "C")!.to = [5, 10];
  b.ravens!.passTarget = "Y";
  const beforeA = JSON.stringify(a), beforeB = JSON.stringify(b);
  for (const t of [.5, 1.5, 2, 3]) {
    const x = playFrame(a, t), y = playFrame(b, t);
    for (const id of ["D1", "D2", "M", "C", "F"])
      assert.deepEqual(x.positions[id], y.positions[id], `${id} inherited old route knowledge at ${t}`);
  }
  assert.equal(JSON.stringify(a), beforeA);
  assert.equal(JSON.stringify(b), beforeB);
  assert.equal(passIntent(a)?.target, "X");
  assert.equal(passIntent(b)?.target, "Y");
  const offA = structuredClone(a), offB = structuredClone(b);
  offA.playerAI!.enabled = false; offB.playerAI!.enabled = false;
  assert.notDeepEqual(worldPosition(offA, "C", 3), worldPosition(offB, "C", 3), "the control must actually contain different old routes");
});

test("an automatic LB without an authored action still reacts on the actual field", () => {
  const s = fixture();
  s.players = [player("Q", "QB", "OFF", [0, -4]), player("X", "WR", "OFF", [0, 2]), player("M", "LB", "DEF", [2, 4])];
  s.actions = [
    { player: "Q", source: "ravens", label: "kaynak-rota", start: 1, end: 8, to: [0, -4] },
    { player: "X", source: "ravens", label: "kaynak-rota", start: 1, end: 8, to: [0, 12] },
  ];
  s.ravens!.passReleaseAt = 2.5;
  s.playerAI = { enabled: true, showDecisions: true };
  const off = structuredClone(s); off.playerAI!.enabled = false;
  assert.deepEqual(worldPosition(off, "M", 3.3), [2, 4]);
  const frame = playFrame(s, 3.3);
  assert.ok(Math.hypot(frame.positions.M[0] - 2, frame.positions.M[1] - 4) > .1, "a missing route must not discard the LB's AI velocity");
  assert.ok(frame.decisions?.M);
  assert.ok(!s.actions.some((a) => a.player === "M"), "AI must not create a replacement authored route");
});

test("a DB dropping to a landmark keeps looking into the field rather than blinding its own sensors", () => {
  const s = fixture();
  s.ravens = { enabled: true, id: ravensProfile(12).id, blocking: "team", source: "MOST", carrier: "H", transferAt: 1 };
  s.players = [player("Q", "QB", "OFF", [-6, -6]), player("H", "RB", "OFF", [0, 0]), player("C", "CB", "DEF", [4, 4])];
  s.actions = [{ player: "H", source: "ravens", label: "special-carry", start: 1, end: 8, to: [0, 10] }];
  s.playerAI = { enabled: true };
  const frame = playFrame(s, 1.5), gaze = worldMotion(s, "C", 1.5).gaze,
    fieldAngle = Math.abs(Math.atan2(Math.sin(gaze - Math.PI), Math.cos(gaze - Math.PI)));
  assert.ok(fieldAngle < 1.4, "backpedal steering must not turn the DB's view away from the offense");
  assert.ok(frame.decisions?.C.seen.includes("H"), "a visible nearby handoff must not disappear because of backpedal heading");
});

test("a bypassed manual DEF runner faces its movement instead of the previous frame's position", () => {
  const s = fixture();
  s.players = [player("D", "DL", "DEF", [0, 4])];
  s.actions = [{ player: "D", source: "manual", label: "coach-run", start: 1, end: 5, to: [2, 2] }];
  s.ravens!.passTarget = undefined;
  s.playerAI = { enabled: true };
  const t = 3, m = worldMotion(s, "D", t), a = worldPosition(s, "D", t - .05), b = worldPosition(s, "D", t + .05),
    travel = Math.atan2(b[0] - a[0], b[1] - a[1]), difference = Math.abs(Math.atan2(Math.sin(m.heading - travel), Math.cos(m.heading - travel)));
  assert.ok(difference < .4, "manual route bypass must not reverse the model's body orientation");
  assert.equal(playFrame(s, t).decisions?.D.phase, "coach-route");
});

test("a defender reacts to the carrier's resolved contact-world path rather than the untouched route", () => {
  const make = (blocked: boolean) => {
    const s = fixture();
    s.ravens = { enabled: true, id: ravensProfile(12).id, blocking: "team", source: "MOST", carrier: "H", transferAt: 1 };
    s.players = [player("Q", "QB", "OFF", [-6, -6]), player("H", "RB", "OFF", [0, 0]), player("C", "CB", "DEF", [4, 4]), player("D", "DL", "DEF", blocked ? [0, 2] : [10, 2])];
    s.players[3].intent = "hold";
    s.actions = [
      { player: "H", source: "ravens", label: "special-carry", start: 1, end: 8, to: [0, 10] },
      { player: "D", source: "opponent", label: "opponent-hold", start: 1, end: 8, to: blocked ? [0, 2] : [10, 2] },
    ];
    s.playerAI = { enabled: true };
    return s;
  };
  const blocked = make(true), open = make(false);
  assert.deepEqual(playFrame(blocked, 1.5).positions.C, playFrame(open, 1.5).positions.C, "the defender cannot anticipate the later contact");
  assert.deepEqual(authoredPosition(blocked, "H", 3), authoredPosition(open, "H", 3));
  const a = playFrame(blocked, 3), b = playFrame(open, 3);
  assert.ok(a.contacts.some((c) => [c.a, c.b].includes("H") && [c.a, c.b].includes("D")));
  assert.ok(Math.hypot(a.positions.H[0] - b.positions.H[0], a.positions.H[1] - b.positions.H[1]) > .4);
  assert.ok(Math.hypot(a.positions.C[0] - b.positions.C[0], a.positions.C[1] - b.positions.C[1]) > .1, "contact-world carrier movement must feed back into pursuit");
  assert.equal(a.decisions?.C.phase, "contain");
  assert.equal(b.decisions?.C.phase, "contain");
});

test("sustained carrier steering stays inside the called route corridor without contact", () => {
  const s = fixture();
  s.ravens = { enabled: true, id: ravensProfile(8).id, blocking: "team", source: "MOST", carrier: "H", transferAt: 1 };
  s.players = [player("H", "RB", "OFF", [0, 0]), ...Array.from({ length: 9 }, (_, i) => player(`W${i}`, "WR", "OFF", [-2, i * 2]))];
  s.actions = [{ player: "H", source: "ravens", label: "carry", start: 1, end: 8, to: [0, 12] }];
  s.playerAI = { enabled: true };
  for (let t = 1; t <= 8; t += .1) {
    const frame = playFrame(s, t), route = authoredPosition(s, "H", t);
    assert.ok(Math.abs(frame.positions.H[0] - route[0]) <= .70, `local steering drifted outside the play at ${t}`);
    assert.ok(frame.contacts.every((c) => c.a !== "H" && c.b !== "H"), "the fixture must measure steering rather than collision displacement");
  }
});

test("AI replay keeps historical decisions and physical frames deterministic", () => {
  const s = planRavens(applyOpponentPackage(ravensScenario(ravensProfile(6).id), opponentPackages[2].id)).scenario;
  s.playerAI = { enabled: true, showDecisions: true };
  const late = structuredClone(s), samples = [0, s.steps[0].end + .35, s.steps[0].end + .9, s.steps[0].end + 2.0];
  const expected = samples.map((t) => structuredClone(playFrame(s, t)));
  playFrame(s, samples.at(-1)! + .5);
  playFrame(late, samples.at(-1)! + .5);
  for (let i = samples.length - 1; i >= 0; i--) {
    assert.deepEqual(playFrame(s, samples[i]), expected[i], "later observations must not rewrite cached decisions");
    assert.deepEqual(playFrame(late, samples[i]), expected[i], "late-first evaluation must replay the same decisions");
  }
});

test("source/diagram bypass is exact and disabling AI keeps the authored physical baseline", () => {
  const base = fixture();
  for (const mode of ["source", "diagram", "disabled"] as const) {
    const s = structuredClone(base);
    s.playerAI = { enabled: true, showDecisions: true };
    if (mode === "source") s.opponent = { id: opponentPackages[0].id, mode: "source" };
    else if (mode === "diagram") s.ravens!.blocking = "diagram";
    else s.playerAI.enabled = false;
    assert.equal(playerAiEnabled(s), false);
    for (const t of [0, 1.5, 3]) {
      const frame = playFrame(s, t);
      assert.equal(frame.decisions, undefined);
      if (mode !== "disabled") {
        for (const p of s.players) assert.deepEqual(frame.positions[p.id], position(s, p.id, t));
      } else {
        const replay = structuredClone(s);
        assert.deepEqual(playFrame(replay, t), frame);
      }
    }
  }
});

test("AI preserves the intended early mesh on the special running calls", () => {
  for (const n of [12, 13, 14, 19, 26, 28, 29, 30, 34]) {
    const s = planRavens(applyOpponentPackage(ravensScenario(ravensProfile(n).id), opponentPackages[2].id)).scenario;
    s.playerAI = { enabled: true };
    const at = s.ravens!.transferAt!, carrier = s.ravens!.carrier!, qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB")!.id;
    const q = worldPosition(s, qb, at), r = worldPosition(s, carrier, at);
    assert.ok(Math.hypot(q[0] - r[0], q[1] - r[1]) <= 1.35, `AI broke the ${n} mesh`);
    assert.equal(playFrame(s, at + .12).carrier, carrier);
  }
});

test("35 Ravens calls against five packages keep bounded and finite first live decisions", () => {
  for (const play of ravensPlays) for (const pack of opponentPackages) {
    const s = planRavens(applyOpponentPackage(ravensScenario(play.id), pack.id)).scenario;
    s.playerAI = { enabled: true, showDecisions: true };
    if (!dynamicsEnabled(s)) continue;
    const snap = s.steps[0].end, before = playFrame(s, Math.max(0, snap - .1)), frame = playFrame(s, snap + .85);
    for (const p of s.players.filter((p) => p.side === "DEF")) assert.deepEqual(before.positions[p.id], p.at, `${play.name}/${pack.name} moved DEF before snap`);
    assert.equal(Object.keys(frame.decisions ?? {}).length, s.players.length);
    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[i], at = frame.positions[p.id], d = frame.decisions![p.id];
      assert.ok([...at, ...d.aim, ...d.velocityDelta, ...(d.desiredVelocity ?? [])].every(Number.isFinite));
      assert.ok(d.decisionAt <= frame.time + 1e-7);
      for (let j = i + 1; j < s.players.length; j++) {
        const other = frame.positions[s.players[j].id];
        assert.ok(Math.hypot(at[0] - other[0], at[1] - other[1]) >= .58, `${play.name}/${pack.name} overlapped bodies`);
      }
    }
  }
});
