import { test } from "node:test";
import assert from "node:assert/strict";
import { ravensPlays, ravensScenario, planRavens } from "../src/ravens.ts";
import {
  applyRavensSpecial,
  prepareRunHandoff,
} from "../src/ravens-special.ts";
import { Scenario, position, type ScenarioType } from "../src/model.ts";
function source(n: number) {
  return planRavens(ravensScenario(ravensPlays[n - 1].id, "diagram")).scenario;
}
const specs = {
  11: "speed-option",
  12: "gt-counter",
  13: "gt-counter",
  14: "dart",
  19: "trap3",
  21: "screen",
  26: "trap3",
  28: "ct-counter",
  29: "source-special",
  30: "gt-counter",
  34: "trap5",
  35: "tushpush",
};
test("özel Ravens oyunları geçerli aksiyon ve adımlarla bütün ofansı ve savunma başlangıçlarını korur", () => {
  for (const [number, kind] of Object.entries(specs)) {
    const input = source(Number(number)),
      defense = structuredClone(input.players.filter((p) => p.side === "DEF")),
      out = applyRavensSpecial(input, {
        number: Number(number),
        kind,
      }).scenario;
    assert.ok(Scenario.safeParse(out).success, number);
    assert.deepEqual(
      out.players.filter((p) => p.side === "DEF"),
      defense,
    );
    assert.equal(out.players.filter((p) => p.side === "OFF").length, 11);
    assert.ok(out.actions.every((a) => a.end <= out.steps.at(-1)!.end));
    assert.ok(!out.actions.some((a) => a.label === "pass-set"));
    for (const p of out.players)
      for (const t of [0, out.steps[0].end, out.steps.at(-1)!.end])
        assert.ok(position(out, p.id, t).every(Number.isFinite));
  }
});
test("GT 12/13, dart14, CT28 ve GT30 doğru source puller ve arka hat waypoint’lerini korur", () => {
  for (const [n, kind, roles] of [
    [12, "gt-counter", ["RG", "RT"]],
    [13, "gt-counter", ["LG", "LT"]],
    [14, "dart", ["LT"]],
    [28, "ct-counter", ["C", "RT"]],
    [30, "gt-counter", ["RG", "RT"]],
  ] as const) {
    const input = source(n),
      out = applyRavensSpecial(input, { number: n, kind });
    for (const pos of roles) {
      const p = out.scenario.players.find((p) => p.pos === pos)!;
      const imported = input.actions.filter(
        (a) => a.player === p.id && a.label !== "motion",
      );
      const planned = out.scenario.actions.filter(
        (a) => a.player === p.id && a.label === "source-pull",
      );
      assert.equal(planned.length, imported.length);
      assert.deepEqual(
        planned.map((a) => a.path),
        imported.map((a) => a.path),
      );
      assert.deepEqual(
        planned.map((a) => a.to),
        imported.map((a) => a.to),
      );
      assert.ok(
        planned.some(
          (a) => (a.path ?? []).some((p) => p[1] < 0) || a.to[1] < 0,
        ),
      );
      assert.ok(
        out.scenario.actions.some(
          (a) => a.player === p.id && a.label === "special-gather",
        ),
      );
    }
  }
});
test("3-tech ve field5-tech trapte hedef gerçekten doğru tekniktir, bypass oyuncusu trap adamını almaz", () => {
  for (const [n, kind, release] of [
    [19, "trap3", "RG"],
    [26, "trap3", "RG"],
    [34, "trap5", "RT"],
  ] as const) {
    const p = applyRavensSpecial(source(n), { number: n, kind });
    const pull = p.assignments.find((a) => a.player === "LG")!;
    assert.ok(pull.target);
    const coverage = p.coverage.find((c) => c.defender === pull.target)!;
    assert.equal(coverage.technique, kind === "trap3" ? "3" : "5");
    assert.notEqual(
      p.assignments.find((a) => a.player === release)!.target,
      pull.target,
    );
    assert.ok(
      p.scenario.actions.some((a) => a.player === "LG" && a.kind === "trap"),
    );
  }
});
test("istenen trap tekniği yoksa başka teknik sahte trap hedefi sayılmaz", () => {
  for (const [n, kind] of [
    [19, "trap3"],
    [34, "trap5"],
  ] as const) {
    const s = source(n);
    const ol = s.players.filter(
      (p) => p.side === "OFF" && ["LT", "LG", "C", "RG", "RT"].includes(p.pos),
    );
    for (const [i, d] of s.players.filter((p) => p.pos === "DL").entries())
      d.at = [ol[i].at[0], 1.1];
    const p = applyRavensSpecial(s, { number: n, kind });
    assert.equal(
      p.assignments.find((a) => a.player === "LG")!.target,
      undefined,
    );
    assert.match(p.warnings.join(" "), /trap hedefi bu dizilişte yok/);
    assert.ok(
      p.unblocked.every(
        (id) => !p.coverage.find((c) => c.defender === id)!.blockers.length,
      ),
    );
  }
});
test("29’da iki guard karşıt yönlerde kalır; 28’de ters H fake rotası ve sol F akışı ayrıdır", () => {
  const s = source(29),
    p = applyRavensSpecial(s, { number: 29, kind: "source-special" });
  for (const [id, sign] of [
    ["LG", -1],
    ["RG", 1],
  ] as const) {
    const last = p.scenario.actions
      .filter((a) => a.player === id && a.label === "source-pull")
      .at(-1)!;
    const start = p.scenario.players.find((p) => p.id === id)!.at;
    assert.equal(Math.sign(last.to[0] - start[0]), sign);
  }
  assert.match(p.warnings.join(" "), /iki guard/);
  const ct = applyRavensSpecial(source(28), {
    number: 28,
    kind: "ct-counter",
    direction: "boundary",
  });
  assert.ok(
    ct.scenario.actions.some(
      (a) => a.player === "F" && a.label === "special-carry",
    ),
  );
  assert.ok(
    !ct.scenario.actions.some(
      (a) => a.player === "H" && a.label === "special-carry",
    ),
  );
  assert.match(ct.warnings.join(" "), /H fake yolu korunuyor/);
});
test("screen RG/RT release gösterir, speed option pitch kararını uydurmaz, tush QB ve destekçileri ileri taşır", () => {
  const screenInput=source(21);
  screenInput.ravens!.passTarget="U";
  const screen = applyRavensSpecial(screenInput, {
    number: 21,
    kind: "screen",
    direction: "field",
  });
  assert.ok(
    screen.scenario.actions.some(
      (a) => a.player === "RG" && a.kind === "screen",
    ),
  );
  assert.ok(
    screen.scenario.actions.some(
      (a) => a.player === "RT" && a.kind === "screen",
    ),
  );
  assert.match(screen.warnings.join(" "), /Screen taşıyıcısı/);
  assert.equal(screen.scenario.ravens!.carrier, "U");
  assert.ok(
    !screen.scenario.actions.some((a) => a.label === "special-screen-carry"),
  );
  const option = applyRavensSpecial(source(11), {
    number: 11,
    kind: "speed-option",
    direction: "field",
  });
  assert.match(option.warnings.join(" "), /QB keep/);
  const tush = applyRavensSpecial(source(35), { number: 35, kind: "tushpush" }),
    end = tush.scenario.steps.at(-1)!.end,
    qb = tush.scenario.players.find((p) => p.pos === "QB")!;
  assert.ok(position(tush.scenario, qb.id, end)[1] > 0);
  for (const id of ["H", "U", "Y"]) {
    assert.ok(position(tush.scenario, id, end)[1] > 0);
    assert.ok(
      position(tush.scenario, id, end)[1] <
        position(tush.scenario, qb.id, end)[1],
    );
  }
  for (const p of tush.scenario.players.filter((p) =>
    ["LT", "LG", "C", "RG", "RT"].includes(p.pos),
  ))
    assert.ok(
      position(tush.scenario, p.id, end)[1] >
        position(tush.scenario, qb.id, end)[1],
    );
});

test("Dart tackle lead LB’ye giderken field tackle kendi DL’sinde kalır; ters taraftaki 3-tech trap hedefi sayılmaz", () => {
  const dart = applyRavensSpecial(source(14), {
    number: 14,
    kind: "dart",
    direction: "boundary",
  });
  const lt = dart.assignments.find((a) => a.player === "LT")!,
    rt = dart.assignments.find((a) => a.player === "RT")!;
  assert.equal(
    dart.scenario.players.find((p) => p.id === lt.target)!.pos,
    "LB",
  );
  assert.equal(
    dart.scenario.players.find((p) => p.id === rt.target)!.pos,
    "DL",
  );
  const s = source(19);
  s.players.find((p) => p.id === "DL3")!.at = [1.2, 1.1];
  s.players.find((p) => p.id === "DL2")!.at = [-1.62, 1.1];
  const trap = applyRavensSpecial(s, { number: 19, kind: "trap3" });
  assert.equal(
    trap.assignments.find((a) => a.player === "LG")!.target,
    undefined,
  );
  assert.match(trap.warnings.join(" "), /trap hedefi bu dizilişte yok/);
});

test("GT12/30 ve CT28 geçerli yerel down blokları uzak eşleşme uğruna kaybetmez, fit yapan LB blok dışı gösterilir", () => {
  for (const n of [12, 30]) {
    const p = planRavens(ravensScenario(ravensPlays[n - 1].id));
    assert.equal(p.assignments.find((a) => a.player === "C")!.target, "DL3");
    assert.equal(p.assignments.find((a) => a.player === "LG")!.target, "DL2");
    assert.ok(!p.unblocked.includes("DL2") && !p.unblocked.includes("DL3"));
    assert.equal(p.coverage.find((c) => c.defender === "MIKE")!.status, "free");
  }
  const ct = planRavens(ravensScenario(ravensPlays[27].id));
  assert.equal(ct.assignments.find((a) => a.player === "LG")!.target, "DL2");
});

test("counter/dart/trap taşıyıcısı son carry segmentini beklemeden gerçek erken QB mesh ile topu alır", () => {
  for (const n of [12, 13, 14, 19, 26, 28, 29, 30, 34]) {
    const input=ravensScenario(ravensPlays[n - 1].id);input.ravens!.exchange="handoff";
    const out = planRavens(input).scenario,
      snap = out.steps[0].end,
      at = out.ravens!.transferAt!,
      id = out.ravens!.carrier!;
    assert.ok(
      at >= snap + 0.4 && at <= snap + 2,
      `${n}: exchange first two seconds`,
    );
    const q = position(out, "Q", at),
      r = position(out, id, at);
    assert.ok(
      Math.hypot(q[0] - r[0], q[1] - r[1]) <= 1.001,
      `${n}: handoff must be within arm's reach`,
    );
    assert.ok(
      q[1] <= 0.15 && r[1] <= 0.15,
      `${n}: exchange before runner crosses LOS`,
    );
    assert.equal(out.ravens!.transferManual, false);
    const again = planRavens(out).scenario;
    assert.equal(again.ravens!.transferAt, at);
    assert.deepEqual(
      again.actions,
      out.actions,
      `${n}: no repeated approach insertion`,
    );
  }
});
test("eksik kaynak mesh için kısa yaklaşma hız sınırını ve sonraki kaynak fake noktalarını korur", () => {
  for (const n of [12, 13, 14, 19, 28, 30]) {
    const carrierId = n === 28 ? "F" : "H";
    const input = source(n),
      raw = input.actions.filter(
        (a) => a.player === carrierId && a.label !== "motion",
      ),
      handoff = ravensScenario(ravensPlays[n - 1].id);
    handoff.ravens!.exchange="handoff";
    const out=planRavens(handoff).scenario;
    const approach = out.actions.find(
      (a) => a.player === carrierId && a.label === "special-mesh-approach",
    )!;
    assert.ok(approach, `${n}: missing source mesh requires approach`);
    let peak = 0;
    for (let t = approach.start; t < approach.end; t += 0.005) {
      const a = position(out, carrierId, t),
        b = position(out, carrierId, Math.min(approach.end, t + 0.005));
      peak = Math.max(peak, Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.005);
    }
    assert.ok(peak <= 3.01, `${n}: approach speed ${peak}`);
    const drawn = out.actions.filter(
      (a) => a.player === carrierId && a.label === "kaynak-rota",
    );
    assert.deepEqual(
      drawn.map((a) => a.to),
      raw.map((a) => a.to),
    );
    assert.deepEqual(
      drawn.map((a) => a.path),
      raw.map((a) => a.path),
    );
    assert.ok(drawn.every((a) => a.start >= approach.end));
    for (const id of ["C", "LG", "RG", "LT", "RT", "Q"])
      assert.deepEqual(
        out.players.find((p) => p.id === id)!.at,
        input.players.find((p) => p.id === id)!.at,
      );
  }
});
test("açık kullanıcı devir zamanı korunur; eski otomatik carry-başlangıcı erken mesh ile yenilenir", () => {
  for (const manual of [true, undefined]) {
    const s = source(14);
    s.ravens!.carrier = "H";
    s.ravens!.transferAt = 3.7;
    s.ravens!.transferManual = manual;
    const warnings: string[] = [];
    const at = prepareRunHandoff(s, "H", 8, warnings);
    assert.equal(at, 3.7);
    assert.equal(s.ravens!.transferManual, true);
    assert.ok(!s.actions.some((a) => a.label === "special-mesh-approach"));
  }
  const s = source(14);
  s.ravens!.carrier = "H";
  s.ravens!.transferAt = 8;
  const at = prepareRunHandoff(s, "H", 8, []);
  assert.ok(at! < s.steps[0].end + 2);
  assert.equal(s.ravens!.transferManual, false);
});
test("ulaşılamayan seçili taşıyıcıya saha boyunca handoff yapılmaz", () => {
  const s = source(14);
  s.ravens!.carrier = "H";
  s.actions = s.actions.filter((a) => a.player !== "H");
  s.players.find((p) => p.id === "H")!.at = [50, -4];
  const before = structuredClone(s.actions),
    warnings: string[] = [];
  const at = prepareRunHandoff(s, "H", 8, warnings);
  assert.equal(at, s.steps[0].end);
  assert.equal(s.ravens!.carrier, "Q");
  assert.deepEqual(s.actions, before);
  assert.match(warnings.join(" "), /uzaktan top aktarımı yapılmadı/);
});
test("counter taşıyıcısı fake sonrası puller temasını sabit beklemek yerine aynı koridorda takip eder", () => {
  for (const n of [12, 13, 14, 26, 28, 30]) {
    const s = planRavens(ravensScenario(ravensPlays[n - 1].id)).scenario,
      id = s.ravens!.carrier!,
      tracks = s.actions.filter((a) => a.player === id && a.label !== "motion").sort((a, b) => a.start - b.start),
      follow = tracks.find((a) => a.label === "special-follow-pull")!,
      carry = tracks.find((a) => a.label === "special-carry")!;
    assert.ok(follow, `${n}: puller takibi`);
    for (let i = 1; i < tracks.length; i++)
      assert.ok(tracks[i].start - tracks[i - 1].end <= .13, `${n}: gereksiz sabit bekleme`);
    assert.equal(follow.end, carry.start);
    assert.ok(follow.to[1] < 0 && carry.to[1] > 0);
    const before = position(s, id, follow.start), later = position(s, id, (follow.start + follow.end) / 2);
    assert.ok(Math.hypot(before[0] - later[0], before[1] - later[1]) > .25);
    assert.deepEqual(planRavens(s).scenario.actions, s.actions);
  }
});
