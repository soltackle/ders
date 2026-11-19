import { test } from "node:test";
import assert from "node:assert/strict";
import { Scenario, position, type ScenarioType, type PlayerType, type ActionType } from "../src/model.ts";
import { ravensProfile } from "../src/ravens-catalog.ts";
import { ravensPlays, ravensScenario, planRavens } from "../src/ravens.ts";
import { applyOpponentPackage, opponentPackages } from "../src/opponent.ts";
import { passIntent, passState } from "../src/ravens-pass.ts";
import { dynamicsEnabled, dynamicsTiming, fieldBounds, playFrame, worldPosition, worldMotion } from "../src/play-dynamics.ts";

type Point = [number, number];
const player = (id: string, pos: string, side: "OFF" | "DEF", at: Point): PlayerType => ({ id, pos, side, at, stance: "2pt", intent: "auto" });
function fixture(players: PlayerType[], actions: ActionType[], meta: Partial<NonNullable<ScenarioType["ravens"]>> = {}) {
  return Scenario.parse({
    version: 1, name: "Play contact review", scheme: "Ravens", hash: "middle", fieldSide: "right", blitz: "none",
    ravens: { enabled: true, id: ravensProfile(1).id, blocking: "pass", source: "MOST", ...meta },
    players, actions,
    steps: [
      { title: "Read", start: 0, end: 1, description: "Read the alignment.", notes: {}, focus: [] },
      { title: "Play", start: 1, end: 8, description: "Play the called route.", notes: {}, focus: [] },
    ],
  });
}
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test("same-team and opposing bodies separate throughout an approaching contact", () => {
  for (const sides of [["OFF", "OFF"], ["DEF", "DEF"], ["OFF", "DEF"]] as const) {
    const s = fixture([
      player("A", "WR", sides[0], [-2, 3]), player("B", "CB", sides[1], [2, 3]),
    ], [
      { player: "A", label: "route", start: 1, end: 5, to: [2, 3] },
      { player: "B", label: "route", start: 1, end: 5, to: [-2, 3] },
    ]);
    let contacted = false;
    for (let t = 1; t < 6; t += dynamicsTiming.step) {
      const frame = playFrame(s, t);
      assert.ok(distance(frame.positions.A, frame.positions.B) >= .60, `${sides.join("/")} at ${t}`);
      contacted ||= frame.contacts.length > 0;
    }
    if (sides[0] !== sides[1]) assert.ok(contacted);
  }
});

test("crossing teammates yield locally and continue their called routes", () => {
  const s = fixture([player("A", "WR", "OFF", [-2, 3]), player("B", "WR", "OFF", [2, 3])], [
    { player: "A", label: "route", start: 1, end: 5, to: [2, 3] },
    { player: "B", label: "route", start: 1, end: 5, to: [-2, 3] },
  ]);
  assert.ok(worldPosition(s, "A", 7)[0] > 1, "A must get through the crossing");
  assert.ok(worldPosition(s, "B", 7)[0] < -1, "B must get through the crossing");
  for (let t = 1; t < 7; t += .1)
    for (const id of ["A", "B"]) assert.ok(Math.abs(worldPosition(s, id, t)[1] - 3) < 1, "local yielding must remain in the route corridor");
});

test("remote engage references cannot drag a defender without physical contact", () => {
  const s = fixture([player("LG", "LG", "OFF", [0, 0]), player("D", "DL", "DEF", [6, 1])], [
    { player: "LG", source: "protection", label: "punch", start: 1, end: 5, to: [0, 3], target: "D", engage: "D" },
    { player: "D", label: "hold", start: 1, end: 8, to: [6, 1] },
  ]);
  assert.deepEqual(worldPosition(s, "D", 5), [6, 1]);
  assert.ok(!playFrame(s, 5).contacts.some((c) => c.kind === "block"));
  assert.ok(position(s, "D", 5)[1] > 3, "fixture must exercise the older authored engage link");
});

test("a contacted run block advances under resistance instead of dragging through the defender", () => {
  const s = fixture([
    player("LG", "LG", "OFF", [0, 0]), player("D", "DL", "DEF", [0, .69]), player("Q", "QB", "OFF", [-5, -5]),
  ], [
    { player: "LG", label: "zone-drive", assignment: "man", target: "D", start: 1, end: 5, to: [0, 5] },
    { player: "D", label: "hold", start: 1, end: 8, to: [0, .69] },
  ], { id: ravensProfile(8).id, blocking: "team", carrier: "Q" });
  const initial = worldPosition(s, "D", 1), end = worldPosition(s, "D", 5);
  assert.ok(end[1] > initial[1] + .03, "the defender should yield to a real advancing block");
  assert.ok(end[1] < 3, "the authored five-unit arrow is not an unrestricted drive");
  assert.ok(distance(worldPosition(s, "LG", 5), end) >= .60);
  assert.ok(playFrame(s, 3).contacts.some((c) => c.kind === "block"));
});

test("open-field movement respects role speeds and accelerates into a long route", () => {
  const s = fixture([
    player("W", "WR", "OFF", [0, 3]), player("L", "LB", "DEF", [10, 3]), player("D", "DL", "DEF", [-10, 3]),
  ], [
    { player: "W", label: "route", start: 1, end: 2, to: [0, 40] },
    { player: "L", label: "flow", start: 1, end: 2, to: [10, 40] },
    { player: "D", label: "rush", start: 1, end: 2, to: [-10, 40] },
  ]);
  for (const [id, max] of [["W", 4.8], ["L", 3.5], ["D", 2.6]] as const) {
    let before = worldPosition(s, id, 1);
    for (let t = 1 + 1 / 60; t < 4; t += 1 / 60) {
      const after = worldPosition(s, id, t);
      assert.ok(distance(before, after) * 60 <= max + .02, `${id} exceeded its speed limit at ${t}`);
      before = after;
    }
    assert.ok(distance(worldPosition(s, id, 1), worldPosition(s, id, 1.05)) < .04, "the first frames cannot instantly jump to running speed");
  }
});

test("a sustained sack/tackle ends the carrier's progress and resolved stride", () => {
  for (const run of [false, true]) {
    const holder = run ? "H" : "Q", s = fixture([
      player(holder, run ? "RB" : "QB", "OFF", [0, -3]), player("D", "DL", "DEF", [0, -2.3]),
    ], [
      { player: holder, label: run ? "special-carry" : "QB-hold", start: 1, end: 7, to: run ? [0, 4] : [0, -3] },
      { player: "D", label: "rush", start: 1, end: 7, to: [0, -5] },
    ], run ? { id: ravensProfile(12).id, blocking: "team", carrier: holder, transferAt: 1 } : {});
    const frame = playFrame(s, 7);
    assert.ok(frame.event, "contact must eventually stop the holder");
    assert.equal(frame.event.type, run ? "tackle" : "sack");
    const stopped = worldPosition(s, holder, frame.event.time + .1);
    assert.deepEqual(worldPosition(s, holder, 7), stopped);
    assert.ok(worldMotion(s, holder, 7).speed < .01, "a stopped holder must stop the run animation");
  }
});

test("rewinding and querying late frames first produces the same physical play", () => {
  const make = () => fixture([player("Q", "QB", "OFF", [0, -3]), player("D", "DL", "DEF", [0, -2.3])], [
    { player: "Q", label: "QB-hold", start: 1, end: 8, to: [0, -3] }, { player: "D", label: "rush", start: 1, end: 8, to: [0, -5] },
  ]);
  const forward = make(), lateFirst = make(), samples = [.2, 1, 1.2, 1.5, 3, 7];
  const expected = samples.map((t) => playFrame(forward, t));
  playFrame(lateFirst, 7);
  for (let i = samples.length - 1; i >= 0; i--) assert.deepEqual(playFrame(lateFirst, samples[i]), expected[i]);
  assert.equal(playFrame(lateFirst, 1.1).event, undefined, "a future cached sack must not leak into the past");
});

test("source and diagram modes preserve exact drawn positions without generated contacts", () => {
  const original = fixture([player("A", "WR", "OFF", [-2, 3]), player("B", "CB", "DEF", [2, 3])], [
    { player: "A", label: "route", start: 1, end: 5, to: [2, 3] }, { player: "B", label: "route", start: 1, end: 5, to: [-2, 3] },
  ]);
  for (const mode of ["diagram", "source", "disabled"]) {
    const s = structuredClone(original);
    if (mode === "diagram") s.ravens!.blocking = "diagram";
    else if (mode === "source") s.opponent = { id: "source-review", mode: "source" };
    else s.ravens!.enabled = false;
    assert.equal(dynamicsEnabled(s), false);
    for (const t of [0, 1, 2, 3, 5, 7]) {
      const frame = playFrame(s, t);
      assert.deepEqual(frame.positions.A, position(s, "A", t));
      assert.deepEqual(frame.positions.B, position(s, "B", t));
      assert.deepEqual(frame.contacts, []);
      assert.equal(frame.event, undefined);
    }
  }
});

test("a carrier reaching the sideline stops with the whole body inside the field", () => {
  for (const hash of ["left", "middle", "right"] as const) {
    const s = fixture([player("Q", "QB", "OFF", [0, -3])], [{ player: "Q", label: "QB-run", start: 1, end: 8, to: [50, -3] }]);
    s.hash = hash;
    s.players[0].at[0] = fieldBounds(s).right - 1.2;
    s.actions[0].to[0] = fieldBounds(s).right + 5;
    const end = playFrame(s, 8), bounds = fieldBounds(s);
    assert.equal(end.event?.type, "out");
    assert.ok(end.positions.Q[0] + dynamicsTiming.bodyRadius <= bounds.right + .001);
    assert.ok(end.positions.Q[0] - dynamicsTiming.bodyRadius >= bounds.left - .001);
    assert.deepEqual(worldPosition(s, "Q", 8), worldPosition(s, "Q", end.event!.time + .1));
  }
});

test("pass possession leaves QB during flight and reaches only the selected routed receiver", () => {
  const s = fixture([player("Q", "QB", "OFF", [0, -3]), player("X", "WR", "OFF", [-4, 2])], [
    { player: "Q", label: "QB-hold", start: 1, end: 8, to: [0, -3] },
    { player: "X", source: "ravens", label: "receiving-route", start: 1, end: 8, to: [-4, 15] },
  ], { passTarget: "X", passReleaseAt: 2.3, passResult: "complete" });
  const intent = passIntent(s)!;
  assert.ok(intent);
  assert.equal(playFrame(s, intent.releaseAt - .1).carrier, "Q");
  const time = (intent.releaseAt + intent.catchAt) / 2;
  assert.equal(playFrame(s, time).carrier, undefined);
  assert.equal(passState(s, time, worldPosition)?.phase, "flight");
  assert.equal(playFrame(s, intent.catchAt + .1).carrier, "X");
  assert.equal(passState(s, intent.catchAt + .1, worldPosition)?.carrier, "X");
});

test("all active Ravens calls against a Kocaeli package keep bodies separated and states finite", () => {
  for (let i = 0; i < ravensPlays.length; i++) {
    const s = planRavens(applyOpponentPackage(ravensScenario(ravensPlays[i].id), opponentPackages[2].id)).scenario;
    if (!dynamicsEnabled(s)) continue;
    for (let t = 0; t <= s.steps.at(-1)!.end; t += .15) {
      const frame = playFrame(s, t);
      for (let a = 0; a < s.players.length; a++) {
        const p = frame.positions[s.players[a].id];
        assert.ok(p.every(Number.isFinite), `${i + 1}/${s.players[a].id}/${t}`);
        for (let b = a + 1; b < s.players.length; b++)
          assert.ok(distance(p, frame.positions[s.players[b].id]) >= .59, `${i + 1}: ${s.players[a].id}/${s.players[b].id} overlap at ${t}`);
      }
    }
  }
});
