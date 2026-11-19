import { test } from "node:test";
import assert from "node:assert/strict";
import { ravensScenario, planRavens } from "../src/ravens.ts";
import { ravensCatalog, ravensProfile } from "../src/ravens-catalog.ts";
import { opponentPackages, applyOpponentPackage } from "../src/opponent.ts";
import { eligiblePassTargets, passIntent, passState, isRavensPass } from "../src/ravens-pass.ts";
import { worldPosition, playFrame } from "../src/play-dynamics.ts";
import { Scenario } from "../src/model.ts";

test("dokuz özel koşunun fiziksel top devri bütün rakip paketlerinde gerçek kol mesafesinde kalır", () => {
  for (const n of [12, 13, 14, 19, 26, 28, 29, 30, 34])
    for (const pkg of opponentPackages)
      for (const hash of ["left", "right"] as const) {
        const input = applyOpponentPackage(ravensScenario(ravensProfile(n).id), pkg.id);
        input.hash = hash;
        const s = planRavens(input).scenario, t = s.ravens!.transferAt!, id = s.ravens!.carrier!,
          q = worldPosition(s, "Q", t), runner = worldPosition(s, id, t), d = Math.hypot(q[0] - runner[0], q[1] - runner[1]);
        assert.ok(t - s.steps[0].end <= 2.01, `${n}/${hash}/${pkg.name}: geç devir`);
        assert.ok(d <= 1.35 && d >= .59, `${n}/${hash}/${pkg.name}: fiziksel mesh ${d}`);
        assert.ok(Scenario.safeParse(s).success);
      }
});

test("her pas hedefi bütün rakip çağrılarında oyun rotalarını ve OL paylaşımını korur", () => {
  let checked = 0;
  for (const profile of ravensCatalog) {
    const template = planRavens(ravensScenario(profile.id)).scenario;
    if (!isRavensPass(template)) continue;
    for (const pkg of opponentPackages) {
      const base = planRavens(applyOpponentPackage(template, pkg.id)), targets = eligiblePassTargets(base.scenario),
        off = new Set(base.scenario.players.filter((p) => p.side === "OFF").map((p) => p.id)),
        routes = base.scenario.actions.filter((a) => off.has(a.player));
      assert.ok(targets.length > 0, `${profile.number}/${pkg.name}: alıcı yok`);
      for (const target of targets) {
        const input = structuredClone(base.scenario);
        input.ravens!.passTarget = target.id;
        input.ravens!.passResult = "auto";
        const plan = planRavens(input), s = plan.scenario, intent = passIntent(s)!;
        assert.ok(intent, `${profile.number}/${target.id}: geçersiz pas`);
        assert.ok(intent.releaseAt > s.steps[0].end && intent.catchAt <= s.steps.at(-1)!.end);
        assert.deepEqual(plan.assignments, base.assignments);
        assert.deepEqual(s.actions.filter((a) => off.has(a.player)), routes);
        const frame = playFrame(s, intent.catchAt + .1), result = passState(s, intent.catchAt + .1, worldPosition)!;
        assert.ok(Object.values(frame.positions).flat().every(Number.isFinite));
        assert.ok(result.at.every(Number.isFinite));
        assert.ok(["complete", "incomplete"].includes(result.outcome));
        assert.ok(s.actions.length <= 300);
        checked++;
      }
    }
  }
  assert.ok(checked >= 350, `${checked} hedef/paket birleşimi`);
});

test("rakip savunma seçilen pas hedefini top atılmadan önce öğrenmez", () => {
  const base = planRavens(applyOpponentPackage(ravensScenario(ravensProfile(1).id), opponentPackages[2].id)).scenario,
    targets = eligiblePassTargets(base);
  assert.ok(targets.length >= 2);
  const plans = targets.slice(0, 2).map((p) => {
    const s = structuredClone(base);
    s.ravens!.passTarget = p.id;
    return planRavens(s).scenario;
  });
  const release = Math.min(...plans.map((s) => passIntent(s)!.releaseAt));
  for (let t = 0; t < release; t += .1)
    for (const def of base.players.filter((p) => p.side === "DEF"))
      assert.deepEqual(worldPosition(plans[0], def.id, t), worldPosition(plans[1], def.id, t), `${def.id}/${t}`);
});
