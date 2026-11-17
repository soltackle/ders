import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Scenario,
  position,
  pathLength,
  type ScenarioType,
} from "../src/model.ts";
import { defaultFieldZone, defaultProtection } from "../src/examples.ts";
import { planZone, createFieldZone } from "../src/zone.ts";
import {
  automaticTraining,
  planTraining,
  trainingFront,
  trainingDefense,
} from "../src/training.ts";
import { inspectScenario } from "../src/analyzer.ts";
import { placeTechnique } from "../src/techniques.ts";
import { zoneBlockPose } from "../src/zone-pose.ts";
const variants = ["inside", "outside"] as const;
const end = (s: ScenarioType) => s.steps.at(-1)!.end;
function peak(s: ScenarioType, id: string) {
  let max = 0;
  for (let t = 0; t < end(s); t += 0.01) {
    const a = position(s, id, t),
      b = position(s, id, t + 0.01);
    max = Math.max(max, Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.01);
  }
  return max;
}
test("iki zone varyantı pas şablonundan ayrı kalır, RB koşucu ve QB handoff görevindedir", () => {
  const pass = defaultProtection(),
    before = structuredClone(pass);
  for (const variant of variants) {
    const zone = createFieldZone(pass);
    zone.zone!.variant = variant;
    const plan = planTraining(zone);
    assert.equal(plan.mode, `${variant}-zone`);
    assert.equal(plan.scenario.protection?.enabled, false);
    assert.ok(automaticTraining(zone));
    assert.equal(
      plan.assignments.find((a) => a.player === "RB")!.type,
      "carry",
    );
    assert.equal(
      plan.assignments.find((a) => a.player === "QB")!.type,
      "handoff",
    );
    assert.ok(
      !plan.coverage.some(
        (c) => c.blockers.includes("RB") || c.blockers.includes("QB"),
      ),
    );
    assert.ok(Scenario.safeParse(plan.scenario).success);
  }
  assert.deepEqual(pass, before);
  assert.equal(planTraining(pass).mode, "base");
});
test("zone yerleşimi ve teknikler korunur, otomatik üretim tekrarlandığında aynı hareketleri verir", () => {
  let s = trainingFront(defaultFieldZone(), 3);
  s = placeTechnique(s, "DL1", "4i", "left");
  const before = structuredClone(s.players),
    a = planZone(s),
    b = planZone(a.scenario);
  assert.deepEqual(a.scenario.players, before);
  assert.deepEqual(a.scenario, b.scenario);
  assert.equal(a.coverage.find((c) => c.defender === "DL1")!.technique, "4i");
  assert.ok(a.assignments.some((x) => x.target === "DL1"));
});
test("combo yardımcısı kontrollü temas sonrasında LB’ye çıkar, DL’nin asıl blokçusu adamında kalır", () => {
  const plan = planZone(trainingFront(defaultFieldZone(), 3));
  const helper = plan.assignments.find((a) => a.release)!;
  assert.equal(helper.type, "combo");
  const owner = plan.assignments.find((a) => a.player === helper.partner)!;
  assert.equal(owner.target, helper.target);
  assert.equal(owner.release, undefined);
  const climb = plan.scenario.actions.find(
    (a) => a.player === helper.player && a.label === "climb",
  )!;
  const combo = plan.scenario.actions.find(
    (a) => a.player === helper.player && a.label === "zone-combo",
  )!;
  assert.equal(climb.start, combo.end);
  assert.ok(climb.start >= 3.25);
  assert.equal(climb.target, helper.release);
  const hold = plan.scenario.actions
    .filter((a) => a.player === owner.player)
    .at(-1)!;
  assert.equal(hold.target, helper.target);
  assert.equal(hold.end, end(plan.scenario));
  assert.equal(
    plan.coverage.find((c) => c.defender === helper.release)!.blockers[0],
    helper.player,
  );
});
test("uzaktaki dış blitz için iç combo yardımcısı bütün hattı çapraz koşmaz", () => {
  const s = trainingDefense(
      trainingFront(defaultFieldZone(), 4),
      "right",
      "blitz",
    ),
    p = planZone(s);
  const lg = p.assignments.find((a) => a.player === "LG")!;
  assert.notEqual(lg.release, s.players.find((p) => p.intent === "blitz")!.id);
  assert.ok(
    p.unblocked.includes(s.players.find((p) => p.intent === "blitz")!.id),
  );
});
test("OL zone’da ileri drive yapar; outside ilk adımı inside’dan geniştir", () => {
  let inside = defaultFieldZone(),
    outside = defaultFieldZone();
  outside.zone!.variant = "outside";
  const a = planZone(inside).scenario,
    b = planZone(outside).scenario;
  const stepA = a.actions.find(
      (x) => x.player === "RT" && x.label === "zone-step",
    )!,
    stepB = b.actions.find(
      (x) => x.player === "RT" && x.label === "zone-step",
    )!;
  assert.ok(stepB.to[0] - 2.4 > stepA.to[0] - 2.4);
  for (const s of [a, b])
    for (const p of s.players.filter((p) =>
      ["LT", "LG", "C", "RG", "RT"].includes(p.pos),
    )) {
      assert.ok(position(s, p.id, end(s))[1] > 0);
      assert.ok(
        !s.actions.some(
          (a) => a.player === p.id && /pass-set|pickup/.test(a.label),
        ),
      );
    }
});
test("6 DL’de RB blokçu sayılmaz; fazla DL ve LB koşu takipçisi olarak açıkça bildirilir", () => {
  const p = planZone(trainingFront(defaultFieldZone(), 6));
  assert.equal(
    p.coverage.filter((c) => c.position === "DL" && c.blockers.length).length,
    5,
  );
  assert.ok(p.unblocked.length >= 2);
  assert.ok(
    p.unblocked.every(
      (id) => p.coverage.find((c) => c.defender === id)!.status === "free",
    ),
  );
  assert.ok(!p.coverage.some((c) => c.status === "hot"));
  assert.match(p.warnings.join(" "), /RB blokçu sayılmaz/);
  const report = inspectScenario(p.scenario);
  assert.equal(report.zoneMode, "inside-zone");
  assert.equal(report.protectionMode, undefined);
  assert.ok(!report.findings.some((f) => /HOT|hot gözetiminde/.test(f.text)));
});
test("DL slant, pinch, widen ve twist ile LB fit/flow/scrape/sail/bait/hold gerçek yollar üretir", () => {
  for (const r of [
    "base",
    "slant-field",
    "slant-boundary",
    "pinch",
    "widen",
    "twist",
  ] as const) {
    const s = defaultFieldZone();
    s.zone!.dlReaction = r;
    const p = planZone(s),
      a = p.scenario.actions.find((a) => a.player === "DL3")!;
    if (r === "slant-field")
      assert.ok(a.to[0] > s.players.find((p) => p.id === "DL3")!.at[0]);
    if (r === "slant-boundary")
      assert.ok(a.to[0] < s.players.find((p) => p.id === "DL3")!.at[0]);
    if (r === "twist")
      assert.ok(
        p.scenario.actions.some((a) => a.path && /twist|stunt/.test(a.label)),
      );
    assert.equal(p.scenario.players.length, s.players.length);
  }
  for (const r of ["fit", "flow", "scrape", "sail", "bait", "hold"] as const) {
    const s = defaultFieldZone();
    s.zone!.lbReaction = r;
    const p = planZone(s),
      lb = s.players.find((p) => p.pos === "LB")!,
      a = p.scenario.actions.find((a) => a.player === lb.id);
    if (r === "hold") {
      assert.equal(a, undefined);
      assert.deepEqual(position(p.scenario, lb.id, end(p.scenario)), lb.at);
    } else {
      assert.equal(a?.label, r);
      assert.notDeepEqual(a?.to, lb.at);
    }
  }
});
test("oyuncu reaksiyonu genel ayarı ezer; seçilen gerçek blitz bekleyen LB ayarından önceliklidir", () => {
  let s = defaultFieldZone();
  s.zone!.dlReaction = "slant-field";
  s.players.find((p) => p.id === "DL1")!.reaction = "slant-boundary";
  let p = planZone(s);
  assert.ok(
    p.scenario.actions.find((a) => a.player === "DL1")!.to[0] <
      s.players.find((p) => p.id === "DL1")!.at[0],
  );
  s = trainingDefense(s, "right", "blitz");
  s.zone!.lbReaction = "hold";
  const id = s.players.find((p) => p.intent === "blitz")!.id;
  p = planZone(s);
  assert.equal(p.scenario.actions.find((a) => a.player === id)!.label, "blitz");
});
test("front/blitz değişimleri zone türü ve genel tepkileri korur; diğer LB’ler koşuya tepki verir", () => {
  let s = defaultFieldZone();
  s.zone!.variant = "outside";
  s.zone!.dlReaction = "pinch";
  s = trainingDefense(s, "both", "blitz");
  s = trainingFront(s, 3);
  assert.equal(s.zone!.variant, "outside");
  assert.equal(s.zone!.dlReaction, "pinch");
  assert.equal(s.protection!.enabled, false);
  assert.equal(s.players.filter((p) => p.intent === "blitz").length, 2);
  const p = planZone(s);
  assert.ok(p.scenario.actions.some((a) => a.label === "fit"));
  s = trainingDefense(s, "none", "blitz");
  assert.equal(s.players.filter((p) => p.intent === "blitz").length, 0);
  assert.ok(planZone(s).scenario.actions.some((a) => a.label === "fit"));
});
test("manuel savunma yolu korunur; show/hold niyetli oyuncu yerinden oynamaz", () => {
  const s = defaultFieldZone(),
    dl = s.players.find((p) => p.id === "DL1")!,
    lb = s.players.find((p) => p.pos === "LB")!;
  s.actions = [
    {
      source: "manual",
      player: dl.id,
      label: "my-slant",
      start: 1.1,
      end: 4,
      to: [-2, 1],
    },
  ];
  lb.intent = "show";
  const p = planZone(s);
  assert.deepEqual(
    p.scenario.actions.filter((a) => a.player === dl.id),
    s.actions,
  );
  assert.deepEqual(position(p.scenario, lb.id, end(p.scenario)), lb.at);
  assert.equal(p.coverage.find((c) => c.defender === lb.id)!.status, "show");
});
test("RB bang/bend/bounce elle seçilebilir; çok uzaktaki RB ve DL hızı değil süreyi uzatır", () => {
  for (const variant of variants)
    for (const rbRead of ["bang", "bend", "bounce"] as const) {
      const s = defaultFieldZone();
      s.zone!.variant = variant;
      s.zone!.rbRead = rbRead;
      const p = planZone(s);
      assert.match(p.read, new RegExp(rbRead.toUpperCase()));
      assert.ok(peak(p.scenario, "RB") <= 2.61);
      assert.ok(end(p.scenario) / 0.5 >= 15);
    }
  const s = defaultFieldZone();
  s.players.find((p) => p.pos === "RB")!.at = [7, -8];
  s.players.find((p) => p.id === "DL4")!.at = [10, 1.1];
  const p = planZone(s).scenario;
  assert.ok(peak(p, "RB") <= 2.61);
  assert.ok(peak(p, "RT") <= 2.11);
  assert.ok(end(p) > end(planZone(defaultFieldZone()).scenario));
});
test("zone blok pozu yere basar, öne eğilir ve zaman geri sarılınca aynı sonucu verir", () => {
  const s = planZone(defaultFieldZone()).scenario;
  for (const t of [1.4, 2.5, 4, 6, 7]) {
    const p = zoneBlockPose(s, "RT", t)!;
    assert.ok(p);
    assert.ok(p.lean > 0);
    assert.ok(p.feet.some((f) => f.y <= 0.066));
    assert.ok(p.feet.every((f) => [f.x, f.z, f.y].every(Number.isFinite)));
    assert.deepEqual(zoneBlockPose(s, "RT", t), p);
  }
  assert.equal(zoneBlockPose(s, "RB", 4), null);
  assert.equal(zoneBlockPose(defaultProtection(), "RT", 4), null);
});
test("field hash’e göre aynalanır, kaydırılmış center etrafında da doğru yön ve cutoff kullanılır", () => {
  for (const hash of ["left", "right"] as const) {
    const s = defaultFieldZone();
    s.hash = hash;
    for (const p of s.players) p.at[0] += 10;
    const plan = planZone(s),
      step = plan.scenario.actions.find(
        (a) => a.player === "C" && a.label === "zone-step",
      )!;
    assert.equal(Math.sign(step.to[0] - 10), hash === "left" ? 1 : -1);
    assert.equal(
      plan.assignments.find(
        (a) => a.player === (hash === "left" ? "LT" : "RT"),
      )!.type,
      "cutoff",
    );
  }
});
test("iki zone, iki hash, 3–4/4–3/5/6 hat ve tüm blitz seçeneklerinde kendi takım yolları çakışmaz", () => {
  for (const variant of variants)
    for (const n of [3, 4, 5, 6] as const)
      for (const hash of ["left", "right"] as const)
        for (const side of [
          "none",
          "left",
          "right",
          "middle",
          "both",
        ] as const) {
          let s = trainingFront(defaultFieldZone(), n);
          s.zone!.variant = variant;
          s.hash = hash;
          s = trainingDefense(s, side, "blitz");
          const p = planZone(s);
          assert.ok(Scenario.safeParse(p.scenario).success);
          assert.deepEqual(
            inspectScenario(p.scenario).findings.filter((f) =>
              f.text.includes("çakışma"),
            ),
            [],
            `${variant} / ${n} / ${hash} / ${side}`,
          );
        }
});
