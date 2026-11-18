import { test } from "node:test";
import assert from "node:assert/strict";
import { ravensCatalog, ravensProfile } from "../src/ravens-catalog.ts";
import {
  ravensScenario,
  planRavens,
  migrateRavensScenario,
  changeRavensBlocking,
} from "../src/ravens.ts";
import { Scenario, fieldSide, position } from "../src/model.ts";
import { trainingFront, trainingDefense } from "../src/training.ts";
import { planProtection } from "../src/protection.ts";
import { inspectScenario } from "../src/analyzer.ts";
import { ravensBall } from "../src/ravens-ball.ts";
import { zoneBlockPose } from "../src/zone-pose.ts";
import { passBlockPose } from "../src/pass-pose.ts";
const scenario = (n: number) => ravensScenario(ravensProfile(n).id);
test("yeni numara kuralları varsayılan seçilir, eski taslak güncellenir ve sonraki bilinçli şema seçimi korunur", () => {
  for (const p of ravensCatalog) {
    const s = scenario(p.number);
    assert.equal(s.ravens!.blocking, p.defaultBlocking);
    const old = changeRavensBlocking(s, "diagram");
    delete old.ravens!.revision;
    old.players.find((p) => p.id === "DL1")!.at = [-3.1, 1];
    const migrated = migrateRavensScenario(old);
    assert.equal(migrated.ravens!.blocking, p.defaultBlocking);
    assert.deepEqual(migrated.players, old.players);
    const chosen = changeRavensBlocking(migrated, "diagram");
    assert.equal(migrateRavensScenario(chosen).ravens!.blocking, "diagram");
  }
  assert.equal(scenario(9).ravens!.blocking, "diagram");
});
test("tüm pas oyunlarında field blitz boundary adamını değiştirmez ve pas seti üretir", () => {
  for (const p of ravensCatalog.filter((p) => p.kind === "pass"))
    for (const hash of ["left", "right"] as const) {
      let s = scenario(p.number);
      s.hash = hash;
      const sign = fieldSide(s) === "right" ? 1 : -1;
      s = trainingDefense(s, sign > 0 ? "right" : "left", "blitz");
      const expected = planProtection(s),
        actual = planRavens(s);
      for (const role of sign > 0 ? ["LG", "LT"] : ["RG", "RT"])
        assert.equal(
          actual.assignments.find((a) => a.player === role)!.target,
          expected.assignments.find((a) => a.player === role)!.target,
          `${p.number}/${role}`,
        );
      assert.ok(actual.scenario.actions.some((a) => a.label === "pass-set"));
      assert.ok(
        !actual.scenario.actions.some(
          (a) => a.player === "C" && a.label === "source-pull",
        ),
      );
    }
});
test("6/8/20/24/27 field zone covered sorumluluğunu tutar, uncovered ikinci seviyeye çıkar", () => {
  for (const n of [6, 8, 20, 24, 27])
    for (const hash of ["left", "right"] as const) {
      const s = scenario(n);
      s.hash = hash;
      const p = planRavens(s);
      assert.ok(p.scenario.zone?.enabled);
      for (const a of p.assignments) {
        if ("covered" in a && a.covered) {
          assert.equal(a.release, undefined);
          assert.equal(a.secondLevel, false);
        }
        if ("covered" in a && a.covered === false)
          assert.equal(a.secondLevel, true);
      }
      assert.ok(!p.coverage.some((c) => c.blockers.includes("H")));
    }
});
test("10 rollout field FT/FG/C slide yapar, boundary kendi DL’sinde kalır ve QB field’a açılır", () => {
  for (const hash of ["left", "right"] as const) {
    const s = scenario(10);
    s.hash = hash;
    const expected = planProtection(s),
      p = planRavens(s),
      sign = fieldSide(s) === "right" ? 1 : -1;
    for (const id of sign > 0 ? ["C", "RG", "RT"] : ["C", "LG", "LT"]) {
      assert.equal(p.assignments.find((a) => a.player === id)!.type, "slide");
      assert.ok(
        p.scenario.actions.some((a) => a.player === id && a.label === "slide"),
      );
    }
    for (const id of sign > 0 ? ["LG", "LT"] : ["RG", "RT"]) {
      assert.equal(
        p.assignments.find((a) => a.player === id)!.target,
        expected.assignments.find((a) => a.player === id)!.target,
      );
      assert.equal(p.assignments.find((a) => a.player === id)!.type, "man");
    }
    const qb = p.scenario.players.find((p) => p.pos === "QB")!;
    assert.ok(
      (position(p.scenario, qb.id, p.scenario.steps.at(-1)!.end)[0] -
        qb.at[0]) *
        sign >
        0,
    );
    assert.ok(p.scenario.protection!.enabled);
    assert.ok(!p.scenario.actions.some((a) => a.label === "handoff"));
  }
});
test("31 field guard tackle arkasından lead,32 boundary guard wrap yapar; kendi OL yolları çakışmaz", () => {
  for (const n of [31, 32])
    for (const hash of ["left", "right"] as const) {
      const s = scenario(n);
      s.hash = hash;
      const p = planRavens(s),
        sign = fieldSide(s) === "right" ? 1 : -1,
        guard = n === 31 ? (sign > 0 ? "RG" : "LG") : sign > 0 ? "LG" : "RG",
        tackle = n === 31 ? (sign > 0 ? "RT" : "LT") : sign > 0 ? "LT" : "RT";
      const pull = p.scenario.actions.find(
        (a) => a.player === guard && a.label === "pull",
      )!;
      assert.ok(pull);
      assert.ok(pull.path!.some((p) => p[1] < -0.7));
      assert.ok(
        !p.scenario.actions.some(
          (a) => a.player === guard && a.label === "zone-step",
        ),
      );
      if (n === 32) {
        const base = planProtection(s);
        assert.equal(
          p.assignments.find((a) => a.player === guard)!.target,
          base.assignments.find((a) => a.player === tackle)!.target,
        );
        assert.ok(passBlockPose(p.scenario, guard, pull.end - 0.05));
      }
      assert.deepEqual(
        inspectScenario(p.scenario).findings.filter((f) =>
          /çakışma/.test(f.text),
        ),
        [],
        `${n}/${hash}`,
      );
    }
});
test("840 hazır durumda geçerli zaman, sabit savunma başlangıcı ve tekrar hesaplamada aynı yollar", () => {
  for (const p of ravensCatalog)
    for (const hash of ["left", "right"] as const)
      for (const n of [3, 4, 5, 6] as const)
        for (const side of ["none", "middle", "both"] as const) {
          let s = scenario(p.number);
          s.hash = hash;
          s = trainingDefense(trainingFront(s, n), side, "blitz");
          const before = structuredClone(
              s.players.filter((p) => p.side === "DEF"),
            ),
            r = planRavens(s),
            out = r.scenario;
          assert.ok(
            Scenario.safeParse(out).success,
            `${p.number}/${hash}/${n}/${side}`,
          );
          assert.deepEqual(
            out.players.filter((p) => p.side === "DEF"),
            before,
          );
          assert.ok(out.actions.every((a) => a.end <= out.steps.at(-1)!.end));
          assert.deepEqual(
            planRavens(out).scenario.actions,
            out.actions,
            `${p.number}/${hash}/${n}/${side}`,
          );
        }
});
test("option keep/pitch ve seçili taşıyıcı topu gerçekten değiştirir, tush QB’de kalır ve alçak drive üretir", () => {
  for (const read of ["keep", "pitch"] as const) {
    const s = scenario(11);
    s.ravens!.optionRead = read;
    s.ravens!.carrier = read === "keep" ? "Q" : "H";
    s.ravens!.transferAt = 3.7;
    const p = planRavens(s).scenario,
      before = ravensBall(p, 3)!,
      after = ravensBall(p, 4)!;
    assert.equal(after.carrier, read === "keep" ? "Q" : "H");
    if (read === "pitch") {
      assert.equal(before.carrier, "Q");
      const during = ravensBall(p, 3.55)!;
      assert.ok(during.blend > 0 && during.blend < 1);
    }
  }
  const s = planRavens(scenario(35)).scenario,
    low = zoneBlockPose(s, "C", s.steps[0].end + 0.5)!;
  assert.equal(s.ravens!.carrier, "Q");
  assert.ok(low.head < 1.1 && low.lean > 0.4);
  assert.equal(ravensBall(s, s.steps[0].end + 0.5)!.carrier, "Q");
});

test("takım çağrısında outside seçimi31’in guard lead istisnasını ve zone8 varyantını kaybettirmez", () => {
  for (const n of [8, 31]) {
    const s = changeRavensBlocking(scenario(n), "team");
    s.zone = { enabled: true, variant: "outside" };
    const p = planRavens(s).scenario;
    assert.equal(p.ravens!.blocking, "team");
    assert.equal(p.zone!.variant, "outside");
    if (n === 31)
      assert.ok(
        p.actions.some((a) => a.player === "RG" && a.kind === "zone-lead"),
      );
  }
});
