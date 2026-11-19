import { test } from "node:test";
import assert from "node:assert/strict";
import { Scenario, type ScenarioType } from "../src/model.ts";
import {
  createFootballAi,
  decideFootballAi,
  type AiFrameInput,
  type AiObservation,
  type AiPoint,
} from "../src/player-ai.ts";
function fixture(): ScenarioType {
  return Scenario.parse({
    version: 1,
    name: "AI",
    scheme: "AI roles",
    hash: "middle",
    fieldSide: "right",
    blitz: "none",
    ravens: { id: "custom", blocking: "pass", source: "MOST" },
    players: [
      { id: "C", side: "OFF", pos: "C", at: [0, 0] },
      { id: "RG", side: "OFF", pos: "RG", at: [1.2, 0] },
      { id: "Q", side: "OFF", pos: "QB", at: [0, -3] },
      { id: "X", side: "OFF", pos: "WR", at: [2, 1] },
      { id: "Y", side: "OFF", pos: "WR", at: [0, 9] },
      { id: "H", side: "OFF", pos: "RB", at: [0.8, -2] },
      { id: "D", side: "DEF", pos: "DL", at: [2.8, 1.1] },
      { id: "LB", side: "DEF", pos: "LB", at: [0, 3] },
      { id: "CB", side: "DEF", pos: "CB", at: [0, 5] },
    ],
    actions: [
      {
        source: "protection",
        player: "C",
        label: "pass-set",
        assignment: "man",
        target: "D",
        start: 1.1,
        end: 8,
        to: [0, -0.6],
      },
      {
        source: "ravens",
        player: "RG",
        label: "source-pull",
        assignment: "pull",
        target: "D",
        start: 1.1,
        end: 5,
        to: [4, 0.5],
        path: [
          [1.2, -1],
          [3, -1],
        ],
        phases: [
          { name: "open", start: 1.1, end: 2 },
          { name: "run", start: 2, end: 4 },
          { name: "gather", start: 4, end: 5 },
        ],
      },
    ],
    steps: [
      {
        title: "snap",
        start: 0,
        end: 1.1,
        description: "",
        notes: {},
        focus: [],
      },
      {
        title: "play",
        start: 1.1,
        end: 8,
        description: "",
        notes: {},
        focus: [],
      },
    ],
  });
}
function input(
  s: ScenarioType,
  time = 3,
  change: (frame: AiObservation) => void = () => {},
): AiFrameInput {
  const positions = Object.fromEntries(
      s.players.map((p) => [p.id, [...p.at] as AiPoint]),
    ),
    headings = Object.fromEntries(
      s.players.map((p) => [p.id, p.side === "DEF" ? Math.PI : 0]),
    );
  const historical = structuredClone(positions);
  return {
    time,
    dt: 1 / 30,
    positions,
    routePositions: structuredClone(positions),
    routeVelocities: Object.fromEntries(
      s.players.map((p) => [p.id, [0, 1] as AiPoint]),
    ),
    contacts: [],
    readPast: (t) => {
      const frame: AiObservation = {
        time: t,
        positions: structuredClone(historical),
        headings: { ...headings },
        velocities: {},
      };
      change(frame);
      return frame;
    },
  };
}
test("görüş geçmiş gözlem yönünden hesaplanır; arkadaki ve gövde arkasındaki oyuncu bilinmez", () => {
  const s = fixture(),
    i = input(s);
  i.headings = { CB: 0 };
  let b = createFootballAi(s),
    d = decideFootballAi(b, i).CB;
  assert.ok(d.seen.includes("X"));
  assert.ok(!d.seen.includes("Y"));
  const blocked = input(s, 3, (f) => {
    f.positions.C = [1, 3];
  });
  d = decideFootballAi(createFootballAi(s), blocked).CB;
  assert.ok(!d.seen.includes("X"));
  const airborne = input(s, 3, (f) => {
    f.positions.C = [0.25, 3];
    f.ball = { at: [0.5, 2.2, 1], phase: "flight" };
  });
  d = decideFootballAi(createFootballAi(s), airborne).CB;
  assert.equal(d.phase, "ball-break");
});
test("gelecek tarihli history reddedilir ve sonlu görsel hafıza söner", () => {
  const s = fixture(),
    b = createFootballAi(s),
    i = input(s);
  assert.ok(decideFootballAi(b, i).CB.seen.includes("X"));
  const absent = input(s, 3.3);
  absent.readPast = () => undefined;
  const memory = decideFootballAi(b, absent).CB;
  assert.ok(memory.remembered.includes("X"));
  absent.time = 4.6;
  assert.ok(!decideFootballAi(b, absent).CB.remembered.includes("X"));
  const future = input(s);
  future.readPast = (t) => ({ time: t + 1, positions: i.positions });
  assert.deepEqual(decideFootballAi(createFootballAi(s), future).CB.seen, []);
});
test("aynı gecikmiş görünür bilgiyle DEF gizli güncel pozisyon, rota ve pas hedefinden etkilenmez", () => {
  const a = fixture(),
    b = structuredClone(a);
  a.ravens!.passTarget = "X";
  b.ravens!.passTarget = "Y";
  b.ravens!.carrier = "Y";
  b.actions.push({
    player: "Y",
    label: "route",
    source: "ravens",
    start: 3,
    end: 8,
    to: [-20, 40],
  });
  const ia = input(a),
    ib = input(b);
  ib.positions.X = [99, 99];
  ib.routePositions.X = [-100, 100];
  ib.carrier = "Y";
  for (const id of ["D", "LB", "CB"])
    assert.deepEqual(
      decideFootballAi(createFootballAi(a), ia)[id],
      decideFootballAi(createFootballAi(b), ib)[id],
    );
});
test("covered blokçu yalnız kendi adamını aynalar; pull open/run koridoru sıfır sapmayla korunur", () => {
  const s = fixture(),
    i = input(s, 3, (f) => {
      f.positions.D = [0.5, 0.65];
    });
  let d = decideFootballAi(createFootballAi(s), i);
  assert.equal(d.C.gaze, "D");
  assert.equal(d.C.phase, "block");
  assert.equal(d.RG.phase, "pull-route");
  assert.deepEqual(d.RG.velocityDelta, [0, 0]);
  assert.deepEqual(d.RG.aim, i.routePositions.RG);
  i.time = 4.5;
  d = decideFootballAi(createFootballAi(s), i);
  assert.equal(d.RG.gaze, "D");
  assert.ok(Math.hypot(...d.RG.velocityDelta) <= 0.40001);
});
test("mesh sırasında hem QB hem RB taşıyıcı olsa bile koridordan kaçış yapmaz", () => {
  const s = fixture();
  s.ravens!.blocking = "team";
  s.ravens!.id = "run-custom";
  s.ravens!.carrier = "H";
  s.ravens!.transferAt = 3;
  for (const time of [2.5, 3.1]) {
    const i = input(s, time, (f) => {
      f.positions.D = [0.4, -2.7];
    });
    i.carrier = time < 3 ? "Q" : "H";
    const decisions = decideFootballAi(createFootballAi(s), i);
    for (const id of ["Q", "H"]) {
      assert.equal(decisions[id].phase, "mesh");
      assert.deepEqual(decisions[id].velocityDelta, [0, 0]);
    }
  }
});
test("LB görülen geri kick ile hook derinliğini tutar ve görülen uçuş guard anahtarını bastırır", () => {
  const s = fixture(),
    read = input(s, 3, (f) => {
      f.positions.RG = [0.8, 1];
      f.velocities = { RG: [0.1, -0.6] };
    });
  let d = decideFootballAi(createFootballAi(s), read).LB;
  assert.equal(d.phase, "hook-read");
  assert.ok(d.aim[1] >= read.routePositions.LB[1]);
  const fly = input(s, 3, (f) => {
    f.positions.RG = [0.8, 1];
    f.velocities = { RG: [1.1, 0.1] };
    f.ball = { at: [0.5, 2.1, 1.8], phase: "flight" };
  });
  d = decideFootballAi(createFootballAi(s), fly).LB;
  assert.equal(d.phase, "ball-break");
  assert.ok(d.lookAt);
});
test("DL önce çağrılan rush hattını kullanır; çizgiyi geçince yalnız görülen QB’ye baskı yapar", () => {
  const s = fixture(),
    early = input(s, 1.6, (f) => {
      f.positions.C = [-8, 0];
      f.positions.RG = [-8, 1];
    });
  let d = decideFootballAi(createFootballAi(s), early).D;
  assert.equal(d.phase, "rush-lane");
  const late = input(s, 3, (f) => {
    f.positions.D = [2.8, -0.3];
    f.positions.H = [-8, -2];
    f.positions.C = [-8, 0];
    f.positions.RG = [-8, 1];
  });
  late.positions.D = [2.8, -0.3];
  late.routePositions.D = [2.8, -0.3];
  d = decideFootballAi(createFootballAi(s), late).D;
  assert.equal(d.phase, "rush");
  assert.equal(d.gaze, "Q");
  assert.ok(d.desiredVelocity![0] < 0);
});
test("yerel düzeltmeler sınırlı, cooldown tutarlı ve yeni beyinle sonuçlar deterministiktir", () => {
  const s = fixture(),
    i = input(s, 3, (f) => {
      f.positions.D = [0.5, 0.7];
    });
  i.carrier = "X";
  const a = createFootballAi(s),
    first = decideFootballAi(a, i),
    again = decideFootballAi(createFootballAi(s), i);
  assert.deepEqual(first, again);
  i.time = 3.03;
  const cached = decideFootballAi(a, i);
  assert.equal(cached.C.decisionAt, first.C.decisionAt);
  for (const [id, d] of Object.entries(cached)) {
    assert.ok(
      Math.hypot(
        d.aim[0] - i.routePositions[id][0],
        d.aim[1] - i.routePositions[id][1],
      ) <= 0.650001,
    );
    assert.ok(d.aim.every(Number.isFinite));
    if (d.desiredVelocity)
      assert.ok(Math.hypot(...d.desiredVelocity) <= d.speedLimit + 0.0001);
  }
});

test("QB pas hedefi seçilmeden de pocket/read rolünde kalır, RB gibi koridor değiştirmez", () => {
  const s = fixture(),
    i = input(s, 3);
  i.carrier = "Q";
  const d = decideFootballAi(createFootballAi(s), i).Q;
  assert.equal(d.phase, "qb-read");
  assert.equal(d.gaze, undefined);
  assert.ok(d.lookAt && d.lookAt[1] > i.positions.Q[1]);
  assert.ok(Math.hypot(...d.velocityDelta) <= 0.45001);
});

test("DB drop landmark'a geri giderken görünmeyen hedef aramaz ve hücum tarafına bakmayı korur", () => {
  const s = fixture(),
    i = input(s, 3, (f) => {
      for (const player of s.players)
        if (player.id !== "CB") f.positions[player.id] = [90, 90];
    });
  i.callLandmarks = { CB: [0, 8] };
  const d = decideFootballAi(createFootballAi(s), i).CB;
  assert.equal(d.phase, "zone-landmark");
  assert.ok(d.aim[1] > i.positions.CB[1]);
  assert.equal(d.gaze, undefined);
  assert.deepEqual(d.seen, []);
  assert.ok(d.lookAt && d.lookAt[1] < i.positions.CB[1]);
});
