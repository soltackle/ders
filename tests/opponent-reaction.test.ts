import { test } from "node:test";
import assert from "node:assert/strict";
import { reactOpponent, opponentTiming } from "../src/opponent-reaction.ts";
import {
  position,
  Scenario,
  type ScenarioType,
  type ActionType,
} from "../src/model.ts";
import type { ProtectionResult } from "../src/protection.ts";

function fixture(): ProtectionResult {
  const offense = [
    ...(["LT", "LG", "C", "RG", "RT"] as const).map((id, i) => ({
      id,
      side: "OFF" as const,
      pos: id,
      at: [(i - 2) * 1.2, 0] as [number, number],
      stance: "3pt" as const,
    })),
    {
      id: "Q",
      side: "OFF" as const,
      pos: "QB",
      at: [0, -3] as [number, number],
      stance: "2pt" as const,
    },
    {
      id: "H",
      side: "OFF" as const,
      pos: "RB",
      at: [0.8, -4] as [number, number],
      stance: "2pt" as const,
    },
    ...(
      [
        ["X", -6],
        ["Y", 6],
        ["U", -3.2],
        ["Z", 3.2],
      ] as const
    ).map(([id, x]) => ({
      id,
      pos: id,
      side: "OFF" as const,
      at: [x, -0.3] as [number, number],
      stance: "2pt" as const,
    })),
  ];
  const defense = [
    ...[-2.8, -0.4, 1.6, 2.8].map((x, i) => ({
      id: `D${i + 1}`,
      pos: "DL",
      side: "DEF" as const,
      at: [x, 1.1] as [number, number],
      intent: "auto" as const,
      stance: "3pt" as const,
    })),
    ...(
      [
        ["WILL", -2],
        ["MIKE", 0],
        ["SAM", 2],
      ] as const
    ).map(([id, x]) => ({
      id,
      pos: "LB",
      side: "DEF" as const,
      at: [x, 3.3] as [number, number],
      intent: "auto" as const,
      stance: "2pt" as const,
    })),
    ...(
      [
        ["CBL", "CB", -6, 5],
        ["CBR", "CB", 6, 5],
        ["SS", "SS", -2, 7],
        ["FS", "FS", 2, 9],
      ] as const
    ).map(([id, pos, x, z]) => ({
      id,
      pos,
      side: "DEF" as const,
      at: [x, z] as [number, number],
      intent: "auto" as const,
      stance: "2pt" as const,
    })),
  ];
  const actions: ActionType[] = [
    ...offense
      .filter((p) => ["LT", "LG", "C", "RG", "RT"].includes(p.pos))
      .map((p) => ({
        source: "protection" as const,
        player: p.id,
        label: "pass-set",
        start: 1.1,
        end: 2.6,
        to: [p.at[0], -0.6] as [number, number],
      })),
    {
      source: "ravens",
      player: "Q",
      label: "kaynak-rota",
      start: 1.1,
      end: 3,
      to: [0, -4],
    },
    {
      source: "ravens",
      player: "X",
      label: "kaynak-rota",
      start: 1.1,
      end: 4,
      to: [-6, 6],
    },
    {
      source: "ravens",
      player: "X",
      label: "kaynak-rota",
      start: 4,
      end: 9,
      to: [-2, 14],
    },
    {
      source: "ravens",
      player: "Y",
      label: "kaynak-rota",
      start: 1.1,
      end: 9,
      to: [6, 13],
    },
    {
      source: "ravens",
      player: "U",
      label: "kaynak-rota",
      start: 1.1,
      end: 8,
      to: [-1, 6],
    },
    {
      source: "ravens",
      player: "Z",
      label: "kaynak-rota",
      start: 1.1,
      end: 8,
      to: [3, 9],
    },
    ...defense.map((p) => ({
      source: "opponent" as ActionType["source"],
      player: p.id,
      label: p.pos === "DL" ? "opponent-rush" : "opponent-coverage",
      kind:
        p.pos === "DL"
          ? "opponent-rush"
          : p.pos === "LB"
            ? "opponent-fit"
            : "opponent-coverage",
      start: 1.1,
      end: 3,
      to: [
        p.at[0],
        p.pos === "DL" ? 0.5 : p.pos === "LB" ? 2.3 : p.at[1] + 1.5,
      ] as [number, number],
    })),
  ];
  const scenario = Scenario.parse({
    version: 1,
    name: "Opponent reaction fixture",
    scheme: "Pass",
    hash: "left",
    fieldSide: "right",
    blitz: "none",
    protection: { enabled: true, showDepth: 1.8 },
    opponent: { id: "test-4-3", mode: "adaptive" },
    players: [...offense, ...defense],
    actions,
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
        title: "Episode",
        start: 1.1,
        end: 10,
        description: "",
        notes: {},
        focus: [],
      },
    ],
  });
  const assignments = [
    { player: "LT", target: "D1", type: "man" as const, note: "Boundary man" },
    { player: "C", target: "D2", type: "man" as const, note: "Interior" },
    { player: "RG", target: "D3", type: "man" as const, note: "Interior" },
  ];
  return {
    scenario,
    mode: "base",
    frontLabel: "4–3",
    front: 4,
    pressureCount: 4,
    assignments,
    warnings: [],
    coverage: defense.map((p) => ({
      defender: p.id,
      position: p.pos,
      technique: p.pos === "DL" ? "5" : null,
      blockers: assignments
        .filter((a) => a.target === p.id)
        .map((a) => a.player),
      watchers: [],
      detail: "",
      status:
        p.id === "D4"
          ? ("hot" as const)
          : assignments.some((a) => a.target === p.id)
            ? ("blocked" as const)
            : ("idle" as const),
    })),
    unblocked: ["D4"],
    boundaryLocks: [],
    alert: false,
    fieldThreats: [],
    boundaryThreats: [],
    interiorThreats: [],
  };
}
function offActions(s: ScenarioType) {
  return s.actions.filter(
    (a) => s.players.find((p) => p.id === a.player)?.side === "OFF",
  );
}
function peak(s: ScenarioType, id: string) {
  let speed = 0;
  for (let t = 0; t < s.steps.at(-1)!.end; t += 0.01) {
    const a = position(s, id, t),
      b = position(s, id, t + 0.01);
    speed = Math.max(speed, Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.01);
  }
  return speed;
}

test("source modu çağrılmış rakip yollarını ve ofans planını değiştirmez", () => {
  const plan = fixture();
  plan.scenario.opponent!.mode = "source";
  assert.deepEqual(reactOpponent(plan), plan);
});
test("adaptive savunma 11 başlangıç konumunu ve bütün ofans yollarını koruyarak hareket üretir", () => {
  const plan = fixture(),
    before = structuredClone(plan),
    out = reactOpponent(plan);
  assert.deepEqual(plan, before);
  assert.deepEqual(out.scenario.players, before.scenario.players);
  assert.deepEqual(offActions(out.scenario), offActions(before.scenario));
  assert.ok(
    out.scenario.actions.some(
      (a) => a.source === "opponent" && a.kind === "opponent-reactive",
    ),
  );
  assert.ok(Scenario.safeParse(out.scenario).success);
  assert.deepEqual(reactOpponent(plan), out);
});
test("manuel veya kaynaksız yazılmış savunma yolları adaptive tepkiyle ezilmez", () => {
  const plan = fixture();
  for (const a of plan.scenario.actions) {
    if (a.player === "CBL") a.source = "manual";
    if (a.player === "SAM") delete a.source;
  }
  const authored = plan.scenario.actions.filter(
      (a) => a.player === "CBL" || a.player === "SAM",
    ),
    out = reactOpponent(plan);
  assert.deepEqual(
    out.scenario.actions.filter(
      (a) => a.player === "CBL" || a.player === "SAM",
    ),
    authored,
  );
  for (const t of [0, 1.7, 3.6, 9])
    for (const id of ["CBL", "SAM"])
      assert.deepEqual(
        position(out.scenario, id, t),
        position(plan.scenario, id, t),
      );
});
test("savunma gelecekteki rota dönüşünü önceden bilemez; sadece gecikmiş gözleme tepki verir", () => {
  const a = fixture(),
    b = fixture();
  b.scenario.actions.find((x) => x.player === "X" && x.start === 4)!.to = [
    -12, 14,
  ];
  const x = reactOpponent(a).scenario,
    y = reactOpponent(b).scenario;
  for (const t of [0, 1.5, 2.5, 3.9, 4])
    for (const p of a.scenario.players.filter((p) => p.side === "DEF"))
      assert.deepEqual(
        position(x, p.id, t),
        position(y, p.id, t),
        `${p.id}/${t}`,
      );
  assert.ok(
    a.scenario.players
      .filter((p) => p.side === "DEF")
      .some((p) => {
        const xx = position(x, p.id, 9),
          yy = position(y, p.id, 9);
        return Math.hypot(xx[0] - yy[0], xx[1] - yy[1]) > 0.1;
      }),
    "rota dönüşü görüldükten sonra tepki değişmeli",
  );
});
test("serbest pass rusher QB’ye baskı yapar, bloklanan DL ise sorumlu OL’nin temas bölgesinde kalır", () => {
  const plan = fixture(),
    out = reactOpponent(plan).scenario,
    t = out.steps.at(-1)!.end,
    qb = position(out, "Q", t),
    free = position(out, "D4", t),
    blocked = position(out, "D1", t),
    ol = position(out, "LT", t);
  assert.ok(Math.hypot(free[0] - qb[0], free[1] - qb[1]) < 2);
  assert.ok(Math.hypot(blocked[0] - ol[0], blocked[1] - ol[1]) < 1.2);
  assert.ok(Math.hypot(blocked[0] - qb[0], blocked[1] - qb[1]) > 2);
});
test("CB/SS/FS coverage oyuncuları OL blokçusu veya sahte QB hot sayılmaz", () => {
  const plan = fixture();
  plan.unblocked.push("CBL");
  plan.coverage.find((c) => c.defender === "CBL")!.status = "hot";
  const out = reactOpponent(plan);
  for (const id of ["CBL", "CBR", "SS", "FS"]) {
    const c = out.coverage.find((c) => c.defender === id)!;
    assert.deepEqual(c.blockers, []);
    assert.notEqual(c.status, "hot");
    assert.ok(!out.unblocked.includes(id));
    assert.ok(
      out.scenario.actions.some(
        (a) => a.player === id && a.kind === "opponent-reactive",
      ),
    );
  }
});
test("savunmacı hızları role göre sınırlı kalır ve uzun bölümde 300 aksiyon bütçesi aşılmaz", () => {
  const out = reactOpponent(fixture()).scenario;
  for (const p of out.players.filter((p) => p.side === "DEF")) {
    const cap =
      p.pos === "DL"
        ? opponentTiming.dlMaxSpeed
        : p.pos === "LB"
          ? opponentTiming.lbMaxSpeed
          : opponentTiming.dbMaxSpeed;
    assert.ok(peak(out, p.id) <= cap + 0.03, `${p.id} hız sınırı ${cap}`);
  }
  const long = fixture();
  long.scenario.steps.at(-1)!.end = 50;
  const longOut = reactOpponent(long).scenario;
  assert.ok(longOut.actions.length <= 300);
  assert.ok(Scenario.safeParse(longOut).success);
  for (const p of longOut.players)
    assert.ok(position(longOut, p.id, 49).every(Number.isFinite));
});
test("run LB ve secondary koşucunun gözlenen akışına yönelir, ofans rotası aynen kalır", () => {
  const a = fixture(),
    b = fixture();
  for (const plan of [a, b]) {
    plan.scenario.protection = { enabled: false, showDepth: 1.8 };
    plan.scenario.zone = {
      enabled: true,
      variant: "inside",
      dlReaction: "base",
      lbReaction: "fit",
      rbRead: "auto",
    };
    plan.scenario.actions.push({
      source: "ravens",
      player: "H",
      label: "carry",
      start: 2,
      end: 9,
      to: [plan === a ? 5 : -5, 4],
    });
  }
  const x = reactOpponent(a),
    y = reactOpponent(b);
  assert.deepEqual(offActions(x.scenario), offActions(a.scenario));
  assert.ok(
    ["MIKE", "SAM", "CBL", "CBR", "SS", "FS"].some((id) => {
      const xx = position(x.scenario, id, 9),
        yy = position(y.scenario, id, 9);
      return Math.abs(xx[0] - yy[0]) > 0.5;
    }),
  );
});

test("pas katalog oyununa açıkça inside seçilirse rakip koşu fit/force tepkisi verir", async () => {
  const { ravensCatalog } = await import("../src/ravens-catalog.ts");
  const plan = fixture();
  plan.scenario.ravens = {
    id: ravensCatalog[0].id,
    source: "MOST",
    blocking: "inside",
    enabled: true,
  };
  plan.scenario.protection = { enabled: false, showDepth: 1.8 };
  plan.scenario.zone = {
    enabled: true,
    variant: "inside",
    dlReaction: "base",
    lbReaction: "fit",
    rbRead: "auto",
  };
  plan.scenario.actions.push({
    source: "ravens",
    player: "H",
    label: "carry",
    start: 2,
    end: 9,
    to: [5, 4],
  });
  const out = reactOpponent(plan);
  assert.ok(
    out.scenario.actions.some(
      (a) => a.player === "CBR" && /opponent-react-(force|rally)/.test(a.label),
    ),
  );
  assert.ok(
    out.scenario.actions.some(
      (a) => a.player === "MIKE" && /opponent-react-(fit|rally)/.test(a.label),
    ),
  );
});

test("combo LB’si gerçek climb başlamadan blokçuya bağlanmaz; DL asıl guard’da kalır", () => {
  const plan = fixture(),
    c = plan.assignments.find((a) => a.player === "C")!;
  c.type = "combo";
  c.release = "MIKE";
  plan.assignments.push({
    player: "LG",
    target: "D2",
    type: "man",
    note: "Asıl guard DL’de kalır",
  });
  plan.scenario.actions.find((a) => a.player === "C")!.target = "D2";
  plan.scenario.actions.push({
    source: "zone",
    player: "C",
    label: "climb",
    assignment: "zone",
    start: 4,
    end: 5,
    to: [-1.5, 2.15],
    target: "MIKE",
  });
  const out = reactOpponent(plan).scenario;
  const early = out.actions.filter(
    (a) => a.player === "MIKE" && a.label === "opponent-react-pressure",
  );
  assert.ok(early.every((a) => a.start >= 4));
  assert.ok(
    position(out, "MIKE", 3.6)[1] > 1,
    "MIKE ilk combo sırasında içeri çekilmemeli",
  );
  const dl = position(out, "D2", 9),
    guard = position(out, "LG", 9),
    helper = position(out, "C", 9);
  assert.ok(Math.hypot(dl[0] - guard[0], dl[1] - guard[1]) < 1.2);
  assert.ok(
    Math.hypot(dl[0] - helper[0], dl[1] - helper[1]) > 1.7,
    "DL çıkan center’ı izlememeli",
  );
});

test("pull yapan guard’a atanmış DL open/run sırasında yakın olsa da guard’a mıknatıs gibi bağlanmaz", () => {
  const plan = fixture();
  const d = plan.scenario.players.find((p) => p.id === "D4")!;
  d.at = [-0.9, 0.6];
  plan.scenario.actions.find((a) => a.player === "D4")!.to = [-0.9, 0.5];
  plan.scenario.actions = plan.scenario.actions.filter(
    (a) => a.player !== "LG",
  );
  plan.scenario.actions.push({
    source: "ravens",
    player: "LG",
    label: "source-pull",
    kind: "pull",
    assignment: "pull",
    start: 1.1,
    end: 5,
    to: [4, 0.6],
    path: [
      [-1.2, -0.8],
      [2, -0.8],
    ],
    phases: [
      { name: "open", start: 1.1, end: 2 },
      { name: "run", start: 2, end: 4 },
      { name: "gather", start: 4, end: 5 },
    ],
  });
  plan.assignments.push({
    player: "LG",
    target: "D4",
    type: "pickup",
    note: "Pull sonrası kenar blok",
  });
  plan.coverage.find((c) => c.defender === "D4")!.blockers = ["LG"];
  plan.coverage.find((c) => c.defender === "D4")!.status = "blocked";
  plan.unblocked = [];
  const out = reactOpponent(plan).scenario;
  assert.ok(
    out.actions
      .filter((a) => a.player === "D4" && a.label === "opponent-react-pressure")
      .every((a) => a.start >= 4),
    "gather öncesinde DL henüz pull blokçusuna bağlanmamalı",
  );
  assert.ok(
    out.actions.some(
      (a) =>
        a.player === "D4" && a.start < 4 && a.label === "opponent-react-rush",
    ),
  );
});

test("açık blitz niyetindeki DB coverage sayılmaz; QB’ye rush eder ve gerçek hot olarak kalır", () => {
  const plan = fixture();
  const cb = plan.scenario.players.find((p) => p.id === "CBL")!;
  cb.intent = "blitz";
  cb.at = [-3.2, 1.5];
  const rush = plan.scenario.actions.find((a) => a.player === "CBL")!;
  rush.kind = "opponent-rush";
  rush.label = "opponent-rush";
  rush.to = [-3.2, -0.2];
  plan.unblocked.push("CBL");
  plan.coverage.find((c) => c.defender === "CBL")!.status = "hot";
  const out = reactOpponent(plan);
  assert.equal(out.coverage.find((c) => c.defender === "CBL")!.status, "hot");
  assert.ok(out.unblocked.includes("CBL"));
  assert.ok(
    out.scenario.actions.some(
      (a) =>
        a.player === "CBL" &&
        a.label === "opponent-react-rush" &&
        a.target === "Q",
    ),
  );
  const qb = position(out.scenario, "Q", 9),
    cbAt = position(out.scenario, "CBL", 9);
  assert.ok(Math.hypot(qb[0] - cbAt[0], qb[1] - cbAt[1]) < 2);
  assert.notEqual(
    out.coverage.find((c) => c.defender === "CBR")!.status,
    "hot",
  );
});
