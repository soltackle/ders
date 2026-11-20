import { test } from "node:test";
import assert from "node:assert/strict";
import {
  opponentPackages,
  opponentCue,
  opponentSign,
  applyOpponentPackage,
  removeOpponentPackage,
} from "../src/opponent.ts";
import { ravensPlays, ravensScenario, planRavens } from "../src/ravens.ts";
import { Scenario, position } from "../src/model.ts";
import { trainingFront, trainingDefense } from "../src/training.ts";

test("Kocaeli kaynağındaki beş çağrı 4 DL, 3 LB ve 4 DB ile top merkezine göre aktarılır", () => {
  assert.equal(opponentPackages.length, 5);
  assert.equal(new Set(opponentPackages.map((p) => p.id)).size, 5);
  for (const pkg of opponentPackages) {
    assert.equal(pkg.players.length, 11);
    assert.equal(new Set(pkg.players.map((p) => p.id)).size, 11);
    assert.equal(pkg.players.filter((p) => p.pos === "DL").length, 4);
    assert.equal(pkg.players.filter((p) => p.pos === "LB").length, 3);
    assert.equal(pkg.players.filter((p) => ["CB", "SS", "FS"].includes(p.pos)).length, 4);
    assert.equal(pkg.scale, 1.2 / (1024 * 0.04));
    assert.ok(pkg.players.every((p) => p.at[1] > 0));
    for (const d of pkg.players.filter((p) => p.pos === "DL")) {
      assert.ok(d.at[1] + d.paths.at(-1)!.points.at(-1)![1] < 0);
    }
  }
  assert.notEqual(opponentPackages[0].anchor.x, opponentPackages[1].anchor.x);
  assert.equal(opponentPackages[0].anchor.y, 1152);
  const blitz = opponentPackages[2].players.find((p) => p.label === "S")!;
  assert.equal(opponentCue(blitz), "blitz");
  assert.equal(opponentCue(opponentPackages[0].players.find((p) => p.label === "W")!), "fit");
  assert.equal(opponentCue(opponentPackages[4].players.find((p) => p.label === "M")!), "pressure");
});

test("35 Ravens oyunu beş pakete karşı her iki field yönünde ve iki reaksiyon modunda geçerli kalır", () => {
  for (const play of ravensPlays)
    for (const pkg of opponentPackages)
      for (const mode of ["adaptive", "source"] as const)
        for (const hash of ["left", "right"] as const) {
          const input = ravensScenario(play.id, "team");
          input.hash = hash;
          const s = applyOpponentPackage(input, pkg.id);
          s.opponent!.mode = mode;
          const result = planRavens(s), out = result.scenario;
          const label = `${play.name}/${pkg.name}/${mode}/${hash}`;
          assert.ok(Scenario.safeParse(out).success, label);
          assert.equal(out.players.length, 22, label);
          assert.equal(out.players.filter((p) => p.side === "OFF").length, 11, label);
          assert.equal(out.players.filter((p) => p.side === "DEF").length, 11, label);
          assert.ok(out.actions.length <= 300, label);
          assert.equal(out.opponent!.id, pkg.id, label);
          const db = out.players.filter((p) => p.side === "DEF" && p.pos !== "DL" && p.pos !== "LB");
          for (const d of db) {
            assert.ok(!result.unblocked.includes(d.id), label + "/false DB rusher");
            assert.ok(!result.assignments.some((a) => a.target === d.id || a.release === d.id), label + "/false DB block");
          }
          if (mode === "source") {
            const end = Math.max(...out.steps.map((st) => st.end));
            for (const original of pkg.players) {
              const current = out.players.find((p) => p.id === original.id)!, delta = original.paths.at(-1)?.points.at(-1) ?? [0, 0];
              const actual = position(out, current.id, end);
              assert.ok(Math.hypot(actual[0] - current.at[0] - opponentSign(out)*delta[0], actual[1] - current.at[1] - delta[1]) < 1e-5, label + "/source " + current.id);
            }
          }
        }
});

test("paketlerde tekrar hesaplama ve JSON dönüşü aynı hareketleri üretir", () => {
  for (const n of [1, 6, 10, 11, 12, 14, 19, 21, 28, 31, 32, 34, 35])
    for (const pkg of opponentPackages) {
      const s = applyOpponentPackage(ravensScenario(ravensPlays[n - 1].id, "team"), pkg.id);
      const first = planRavens(s), second = planRavens(Scenario.parse(JSON.parse(JSON.stringify(first.scenario))));
      assert.deepEqual(second.scenario.actions, first.scenario.actions, `${n}/${pkg.name}`);
      assert.deepEqual(second.assignments, first.assignments, `${n}/${pkg.name}`);
      assert.deepEqual(second.coverage, first.coverage, `${n}/${pkg.name}`);
    }
});

test("elle yazılmış savunma yolu adaptif paketten önceliklidir; kaldırma ve hazır front önceki savunmaya döner", () => {
  const original = ravensScenario(ravensPlays[0].id, "team");
  const defender = original.players.find((p) => p.id === "DL1")!;
  defender.at = [-3.17, 1.27];
  const authored = { player: defender.id, label: "manual-slant", start: 1.1, end: 3.4, to: [-2, -1] as [number, number] };
  original.actions = [authored];
  let s = applyOpponentPackage(original, opponentPackages[0].id);
  s = applyOpponentPackage(s, opponentPackages[4].id);
  const p = s.players.find((p) => p.side === "DEF" && p.pos === "CB")!;
  const custom = { player: p.id, source: "manual" as const, label: "coach-path", start: 1.1, end: 6, to: [2, 8] as [number, number] };
  s.actions.push(custom);
  const planned = planRavens(s).scenario;
  assert.deepEqual(planned.actions.filter((a) => a.player === p.id), [custom]);
  assert.deepEqual(planRavens(planned).scenario.actions.filter((a) => a.player === p.id), [custom]);
  const restored = removeOpponentPackage(planned);
  assert.deepEqual(restored.players.filter((p) => p.side === "DEF"), original.players.filter((p) => p.side === "DEF"));
  assert.deepEqual(restored.actions, [authored]);
  assert.equal(restored.opponent, undefined);
  assert.equal(trainingFront(planned, 6).opponent, undefined);
  assert.equal(trainingFront(planned, 6).players.filter((p) => p.side === "DEF" && p.pos === "DL").length, 6);
  assert.equal(trainingDefense(planned, "right", "blitz").opponent, undefined);
});

test("paket kaldırılırken sonradan silinen RB'ye ait yedek referanslar temizlenir", () => {
  const original = ravensScenario(ravensPlays[1].id, "team"), rb = original.players.find((p) => p.side === "OFF" && p.pos === "RB")!;
  assert.ok(rb);
  original.actions = [{player:"DL1",label:"manual-rush",start:1.1,end:5,to:[0,-2],target:rb.id,gaze:rb.id,engage:rb.id}];
  const s = applyOpponentPackage(original, opponentPackages[0].id);
  s.players = s.players.filter((p) => p.id !== rb.id);
  const restored = removeOpponentPackage(s);
  assert.ok(Scenario.safeParse(restored).success);
  assert.equal(restored.actions[0].target, undefined);
  assert.equal(restored.actions[0].gaze, undefined);
  assert.equal(restored.actions[0].engage, undefined);
  assert.deepEqual(restored.actions[0].to, [0,-2]);
});
