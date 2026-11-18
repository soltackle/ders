import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  ravensPlays,
  drawingRoster,
  ravensScenario,
  planRavens,
  changeRavensBlocking,
  sampleDrawing,
  type Blocking,
} from "../src/ravens.ts";
import { Scenario, position, samplePath, pathLength } from "../src/model.ts";
import {
  trainingFront,
  trainingDefense,
  planTraining,
  automaticTraining,
} from "../src/training.ts";
import { placeTechnique } from "../src/techniques.ts";
import {
  initializeProtectionStorage,
  saveCase,
  savedCases,
} from "../src/library.ts";
import { sceneFit } from "../src/scene-fit.ts";
test("MOST’taki 35 oyun, 385 oyuncu ve kaynak isimleri kayıpsız taşınır", () => {
  assert.equal(ravensPlays.length, 35);
  assert.equal(new Set(ravensPlays.map((p) => p.id)).size, 35);
  assert.equal(
    ravensPlays.reduce((n, p) => n + p.players.length, 0),
    385,
  );
  for (const p of ravensPlays) {
    const s = ravensScenario(p.id, "diagram");
    assert.equal(s.name, p.name);
    assert.deepEqual(
      s.players
        .filter((p) => p.side === "OFF")
        .map((p) => p.id)
        .sort(),
      p.players.map((p) => p.id).sort(),
    );
    assert.equal(s.players.find((p) => p.id === "Q")!.pos, "QB");
    assert.ok(Scenario.safeParse(s).success);
  }
  assert.ok(ravensPlays.some((p) => p.name === "BUNCH CLOSE-C3-NKU SPECIAL"));
});
test("kaynak yolları SVG çizgisini, quadratic eğriyi ve keskin dönüşü korur", () => {
  assert.deepEqual(sampleDrawing("M 0 0 L 0 -10 L 10 -10"), [
    [0, 0],
    [0, -10],
    [10, -10],
  ]);
  const q = sampleDrawing("M 0 0 Q 10 0 10 -10");
  assert.deepEqual(q.at(-1), [10, -10]);
  assert.ok(q.some((p) => p[0] === 7.5 && p[1] === -2.5));
  const a = {
    player: "X",
    label: "route",
    interpolation: "polyline" as const,
    start: 0,
    end: 2,
    to: [10, 10] as [number, number],
    path: [[0, 10]] as [number, number][],
  };
  assert.deepEqual(samplePath([0, 0], a, 0.5), [0, 10]);
  assert.equal(pathLength([0, 0], a), 20);
});
test("çizim modunda bütün oyuncuların rota sonları ve motion konumları kaynak koordinatlarıyla aynı kalır", () => {
  for (const p of ravensPlays) {
    const s = planRavens(ravensScenario(p.id, "diagram")).scenario;
    for (const source of drawingRoster(p)) {
      const last = source.paths.at(-1)?.points.at(-1);
      const expected = last
        ? [source.at[0] + last[0], source.at[1] + last[1]]
        : source.at;
      const actual = position(s, source.id, s.steps.at(-1)!.end);
      assert.ok(
        Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-6,
        p.name + "/" + source.id,
      );
    }
    assert.ok(
      !s.actions.some(
        (a) => s.players.find((p) => p.id === a.player)?.side === "DEF",
      ),
    );
  }
});
test("35 oyunun dört blok seçeneği geçerlidir; motion snap’ten önce, rotalar sonrasında oynar ve tekrar hesaplama tutarlıdır", () => {
  for (const p of ravensPlays)
    for (const mode of ["diagram", "pass", "inside", "outside"] as Blocking[]) {
      const s = planTraining(ravensScenario(p.id, mode)).scenario;
      assert.ok(Scenario.safeParse(s).success, p.name + "/" + mode);
      assert.ok(automaticTraining(s));
      const motion = s.actions.filter((a) => a.label === "motion"),
        routes = s.actions.filter(
          (a) => a.source === "ravens" && a.label !== "motion",
        );
      if (motion.length && routes.length)
        assert.ok(
          Math.max(...motion.map((a) => a.end)) <=
            Math.min(...routes.map((a) => a.start)),
        );
      assert.ok(s.actions.every((a) => a.end <= s.steps.at(-1)!.end));
      const again = planRavens(s).scenario;
      assert.deepEqual(again.actions, s.actions, p.name + "/" + mode);
      if (mode === "pass")
        assert.ok(s.actions.some((a) => a.label === "pass-set"));
      if (mode === "inside" || mode === "outside") {
        assert.ok(s.actions.some((a) => a.label === "zone-step"));
        const rb = s.players.find((p) => p.pos === "RB");
        if (rb)
          assert.ok(
            !s.actions.some((a) => a.player === rb.id && a.label === "pickup"),
          );
      }
    }
});
test("Ravens front, blitz ve teknik değişimlerinde oyun kimliği, 11 ofans ve rotalar korunur", () => {
  let s = ravensScenario(ravensPlays[0].id, "pass");
  for (const n of [3, 4, 5, 6] as const) {
    s = trainingFront(s, n);
    s = trainingDefense(s, "both", "blitz");
    s = placeTechnique(s, "DL1", "5", "left");
    const p = planRavens(s);
    assert.equal(p.scenario.name, ravensPlays[0].name);
    assert.equal(p.scenario.ravens!.id, ravensPlays[0].id);
    assert.equal(p.scenario.players.filter((p) => p.side === "OFF").length, 11);
    assert.ok(
      p.scenario.actions.some((a) => a.player === "X" && a.source === "ravens"),
    );
    assert.equal(p.scenario.players.filter((p) => p.pos === "DL").length, n);
  }
});
test("Empty’de H RB yapılmaz; HPP’de RB pickup rotadan önceliklidir; çizim özel oyunları otomatik zone yapılmaz", () => {
  const empty = ravensScenario(ravensPlays[0].id);
  assert.ok(!empty.players.some((p) => p.pos === "RB"));
  const hpp = ravensScenario(
    ravensPlays.find((p) => p.name.includes("HPP"))!.id,
    "pass",
  );
  assert.equal(hpp.players.find((p) => p.id === "H")!.pos, "RB");
  const s = planRavens(trainingDefense(hpp, "left", "blitz")).scenario;
  assert.ok(
    s.actions.some((a) => a.player === "H" && a.label === "pickup-approach"),
  );
  assert.ok(!s.actions.some((a) => a.player === "H" && a.source === "ravens"));
  const counter = ravensScenario(
    ravensPlays.find((p) => p.name.includes("GTCOUNTER"))!.id,
  );
  assert.equal(counter.ravens!.blocking, "diagram");
  assert.equal(counter.zone, undefined);
});
test("Ravens Case kaydı ve yeniden açılış seçilen blok modunu değiştirmez", () => {
  const dom = new JSDOM("", { url: "https://example.com" });
  Object.assign(globalThis, { localStorage: dom.window.localStorage });
  const s = ravensScenario(ravensPlays[8].id, "diagram");
  saveCase(s);
  localStorage.setItem("ol-trainer", JSON.stringify(s));
  const active = initializeProtectionStorage();
  assert.equal(active.ravens!.id, s.ravens!.id);
  assert.equal(active.ravens!.blocking, "diagram");
  assert.equal(active.protection!.enabled, false);
  assert.ok(
    Object.values(savedCases()).some((p) => p.ravens?.id === s.ravens!.id),
  );
});
test("geniş Ravens çizimleri ve rotaların tamamı hem mobil hem masaüstü tahta sınırlarına sığar", () => {
  for (const play of ravensPlays) {
    const s = planRavens(ravensScenario(play.id, "diagram")).scenario;
    for (const ratio of [0.6, 1.7]) {
      const fit = sceneFit(s, ratio),
        points = s.players
          .map((p) => p.at)
          .concat(s.actions.flatMap((a) => [...(a.path ?? []), a.to]));
      for (const [x, z] of points) {
        assert.ok(Math.abs(x - fit.x) < fit.span * ratio);
        assert.ok(Math.abs(z - fit.z) < fit.span);
      }
    }
  }
});

test("Ravens pas korumasında kaynakta rotası olmayan QB hot gözetimini korur", () => {
  const s = trainingDefense(
      ravensScenario(ravensPlays[0].id, "pass"),
      "both",
      "blitz",
    ),
    p = planRavens(s);
  const watch = p.assignments.find(
    (a) => a.player === "Q" && a.type === "watch",
  )!;
  assert.ok(watch);
  assert.ok(
    p.scenario.actions.some(
      (a) => a.player === "Q" && a.assignment === "watch",
    ),
  );
  assert.match(p.scenario.steps[0].notes.Q, /HOT|hot/);
});
