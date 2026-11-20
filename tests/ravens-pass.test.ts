import { test } from "node:test";
import assert from "node:assert/strict";
import { Scenario, position, type ScenarioType } from "../src/model.ts";
import {
  eligiblePassTargets,
  isRavensPass,
  passWindow,
  validatePassSelection,
  passIntent,
  passTimeline,
  passState,
} from "../src/ravens-pass.ts";
import { ravensBall } from "../src/ravens-ball.ts";
import { ravensProfile } from "../src/ravens-catalog.ts";
import { ravensScenario, planRavens } from "../src/ravens.ts";
function fixture() {
  return Scenario.parse({
    version: 1,
    name: "Pass fixture",
    scheme: "Ravens pass",
    hash: "middle",
    fieldSide: "right",
    blitz: "none",
    ravens: {
      id: "custom",
      source: "MOST",
      blocking: "pass",
      passTarget: "X",
      passReleaseAt: 2.2,
    },
    players: [
      { id: "C", pos: "C", side: "OFF", at: [0, 0] },
      { id: "Q", pos: "QB", side: "OFF", at: [0, -3] },
      { id: "X", pos: "WR", side: "OFF", at: [-4, 0] },
      { id: "Y", pos: "TE", side: "OFF", at: [4, 0] },
      { id: "H", pos: "RB", side: "OFF", at: [1, -2] },
    ],
    actions: [
      {
        source: "ravens",
        player: "X",
        label: "kaynak-rota",
        start: 1.1,
        end: 7,
        to: [-4, 12],
      },
      {
        source: "ravens",
        player: "Y",
        label: "kaynak-rota",
        start: 1.1,
        end: 7,
        to: [7, 8],
      },
      {
        source: "protection",
        player: "H",
        label: "pickup",
        assignment: "pickup",
        start: 1.1,
        end: 8,
        to: [1, -1],
      },
    ],
    steps: [
      {
        title: "Read",
        start: 0,
        end: 1.1,
        description: "",
        notes: {},
        focus: [],
      },
      {
        title: "Play",
        start: 1.1,
        end: 8,
        description: "",
        notes: {},
        focus: [],
      },
    ],
  }) as ScenarioType;
}
test("hedefler yalnız gerçek alıcı rotalarıdır; OL/QB ve korumadaki RB pas hedefi olmaz", () => {
  const s = fixture();
  assert.deepEqual(
    eligiblePassTargets(s).map((p) => p.id),
    ["X", "Y"],
  );
  s.ravens!.passTarget = "H";
  assert.equal(validatePassSelection(s).valid, false);
  assert.equal(passIntent(s), null);
  s.ravens!.passTarget = undefined;
  assert.equal(passState(s, 3), null);
  assert.equal(ravensBall(s, 3), null);
});
test("pas penceresi snap sonrası ve QB LOS öncesidir; geçersiz zaman JSON dışında da yakalanır", () => {
  const s = fixture(),
    w = passWindow(s);
  assert.ok(w.earliest > 1.1);
  for (const t of [0, 1.1, 20, NaN]) {
    s.ravens!.passReleaseAt = t;
    assert.equal(validatePassSelection(s).valid, false);
  }
  s.ravens!.passReleaseAt = 2.2;
  s.actions.push({
    source: "ravens",
    player: "Q",
    label: "rollout",
    start: 1.1,
    end: 3,
    to: [3, 2],
  });
  const after = passWindow(s);
  assert.ok(after.latest < 3);
  s.ravens!.passReleaseAt = after.latest + 0.1;
  assert.equal(passIntent(s), null);
});
test("hareketli alıcıya sabit ve sonlu bir uçuş atılır; top uçuşta alıcıya yapışmaz", () => {
  const s = fixture(),
    intent = passIntent(s)!;
  assert.ok(intent.catchAt > intent.releaseAt);
  const target = position(s, "X", intent.catchAt);
  assert.ok(
    Math.hypot(intent.to[0] - target[0], intent.to[2] - target[1] - 0.25) <
      1e-6,
  );
  const held = passState(s, intent.releaseAt - 0.0001)!,
    launch = passState(s, intent.releaseAt)!;
  assert.ok(Math.hypot(...held.at.map((v, i) => v - launch.at[i])) < 0.001);
  const flight = passState(s, (intent.catchAt + intent.releaseAt) / 2)!;
  assert.equal(flight.phase, "flight");
  assert.equal(flight.carrier, "");
  assert.ok(flight.at[1] > intent.from[1]);
  assert.ok(flight.at.every(Number.isFinite));
  assert.equal(passState(s, intent.catchAt + 0.1)!.carrier, "X");
  assert.equal(passTimeline(s)!.outcome, "complete");
});
test("auto savunulan alıcıya garantili completion vermez; açık pas tamamlanır", () => {
  const s = fixture(),
    intent = passIntent(s)!,
    at = position(s, "X", intent.catchAt);
  s.players.push({ id: "CB", pos: "CB", side: "DEF", at });
  const timeline = passTimeline(s)!;
  assert.equal(timeline.outcome, "incomplete");
  assert.equal(timeline.defender, "CB");
  assert.equal(passState(s, intent.catchAt + 0.6)!.phase, "incomplete");
  assert.equal(passState(s, intent.catchAt + 0.6)!.at[1], 0.12);
});
test("eğitim complete dalı savunma contestini aşabilir ama uzaklaşmış alıcıya topu ışınlamaz", () => {
  const s = fixture();
  s.ravens!.passResult = "complete";
  const intent = passIntent(s)!,
    at = position(s, "X", intent.catchAt);
  s.players.push({ id: "CB", pos: "CB", side: "DEF", at });
  assert.equal(passTimeline(s)!.outcome, "complete");
  const moved = (sc: ScenarioType, id: string, t: number): [number, number] => {
    const p = position(sc, id, t);
    return id === "X" && t >= intent.catchAt ? [p[0] + 3, p[1]] : p;
  };
  assert.equal(passTimeline(s, moved)!.outcome, "incomplete");
  assert.equal(passState(s, intent.catchAt + 0.1, moved)!.carrier, "");
  s.ravens!.passResult = "incomplete";
  assert.equal(passTimeline(s)!.outcome, "incomplete");
});
test("gerçek QB temasla kaydıysa uçuş o konumdan başlar; release öncesi gelecek accessor okunmaz", () => {
  const s = fixture(),
    intent = passIntent(s)!,
    queries: { id: string; t: number }[] = [];
  const shifted = (
    sc: ScenarioType,
    id: string,
    t: number,
  ): [number, number] => {
    queries.push({ id, t });
    const p = position(sc, id, t);
    return id === "Q" ? [p[0] + 1.4, p[1] - 0.6] : p;
  };
  const before = passState(s, intent.releaseAt - 0.2, shifted)!;
  assert.ok(queries.every((q) => q.t <= intent.releaseAt - 0.2));
  queries.length = 0;
  const launch = passState(s, intent.releaseAt, shifted)!;
  assert.equal(launch.at[0], intent.from[0] + 1.4);
  assert.equal(launch.at[2], intent.from[2] - 0.6);
  const actual = passTimeline(s, shifted)!;
  assert.deepEqual(actual.to, intent.to);
  assert.equal(actual.from[0], intent.from[0] + 1.4);
});
test("gelecekteki savunma rotası niyet edilen pası veya release/catch zamanını değiştirmez", () => {
  const s = fixture(),
    before = structuredClone(passIntent(s));
  s.players.push({ id: "FS", pos: "FS", side: "DEF", at: [20, 20] });
  s.actions.push({
    source: "opponent",
    player: "FS",
    label: "coverage",
    start: 4,
    end: 8,
    to: [-4, 5],
  });
  assert.deepEqual(passIntent(s), before);
  const state = passState(s, 2.3)!;
  assert.equal(state.outcome, "pending");
});
test("Yüzük E7 alıcısı serbest seçilir, yeniden hesaplama kilitlemez ve QB tutma korunur", () => {
  let s=planRavens(ravensScenario(ravensProfile(21).id)).scenario;
  assert.equal(s.ravens!.passTarget,undefined);
  const ids=eligiblePassTargets(s).map(p=>p.id);
  assert.ok(ids.includes("X")&&ids.includes("Y")&&ids.includes("U")&&ids.includes("H"));
  assert.ok(!ids.includes("Q")&&!ids.includes("RG"));
  for(const id of ids){
    s.ravens!.passTarget=id;
    s=planRavens(s).scenario;
    assert.equal(s.ravens!.passTarget,id);
    assert.equal(s.ravens!.carrier,id);
    assert.equal(passIntent(s)!.target,id);
    assert.equal(planRavens(s).scenario.ravens!.passTarget,id);
  }
  s.ravens!.passTarget=undefined;
  s=planRavens(s).scenario;
  assert.equal(s.ravens!.carrier,undefined);
  assert.equal(passIntent(s),null);
  assert.ok(!s.actions.some(a=>a.label==="special-screen-carry"));
});
