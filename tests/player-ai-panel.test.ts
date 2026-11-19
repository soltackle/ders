import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mountPlayerAI } from "../src/player-ai-panel.ts";
import { ravensScenario, ravensPlays, planRavens } from "../src/ravens.ts";
import { Scenario, type ScenarioType } from "../src/model.ts";
import { applyOpponentPackage, opponentPackages } from "../src/opponent.ts";
import { defaultProtection } from "../src/examples.ts";
function setup(
  initial: ScenarioType = planRavens(ravensScenario(ravensPlays[0].id))
    .scenario,
) {
  const dom = new JSDOM("<section></section>");
  Object.assign(globalThis, { document: dom.window.document });
  let state = initial;
  const callbacks: (() => void)[] = [];
  const host = document.querySelector<HTMLElement>("section")!,
    api = {
      get: () => state,
      set: (s: ScenarioType) => {
        state = Scenario.parse(s);
        callbacks.forEach((f) => f());
      },
      subscribe: (f: () => void) => callbacks.push(f),
    };
  mountPlayerAI(host, api);
  return {
    dom,
    host,
    get: api.get,
    set: api.set,
    enabled: host.querySelector<HTMLInputElement>("[data-player-ai-enabled]")!,
    decisions: host.querySelector<HTMLInputElement>(
      "[data-player-ai-decisions]",
    )!,
    toggle: (selector: string, checked: boolean) => {
      const input = host.querySelector<HTMLInputElement>(selector)!;
      input.checked = checked;
      input.dispatchEvent(new dom.window.Event("change"));
    },
  };
}
function withoutAI(s: ScenarioType) {
  const copy = structuredClone(s);
  delete copy.playerAI;
  return copy;
}
test("Saha AI Ravens’te varsayılan açık ve karar bilgisi kapalıdır; seçili oyunu ve saha rollerini gösterir", () => {
  const e = setup();
  assert.equal(e.host.hidden, false);
  assert.equal(e.enabled.checked, true);
  assert.equal(e.decisions.checked, false);
  assert.equal(e.host.dataset.playerAiEffective, "true");
  assert.ok(
    e.host
      .querySelector(".player-ai-play")!
      .textContent!.includes(e.get().name),
  );
  assert.match(e.host.textContent!, /OL kendi blok görevini/);
  assert.match(e.host.textContent!, /Koşucu açık koridoru/);
  assert.match(e.host.textContent!, /Savunma görüş/);
  assert.match(e.host.textContent!, /QB’nin pas hedefini sen seçersin/);
  assert.equal(e.host.querySelector('input[type="password"]'), null);
  assert.equal(e.host.querySelector('[name="endpoint"]'), null);
});
test("Saha AI tercihleri ofans, defans, yollar, rakip paketi ve seçili pas alıcısını değiştirmez", () => {
  const s = planRavens(
    applyOpponentPackage(
      ravensScenario(ravensPlays[0].id),
      opponentPackages[1].id,
    ),
  ).scenario;
  s.ravens!.passTarget = "X";
  s.ravens!.passReleaseAt = s.steps[0].end + 1.6;
  s.ravens!.passResult = "incomplete";
  const e = setup(s),
    before = withoutAI(e.get());
  e.toggle("[data-player-ai-enabled]", false);
  assert.equal(e.get().playerAI!.enabled, false);
  assert.equal(e.get().playerAI!.showDecisions, false);
  assert.equal(e.host.dataset.playerAiEffective, "false");
  assert.deepEqual(withoutAI(e.get()), before);
  e.toggle("[data-player-ai-decisions]", true);
  assert.equal(e.get().playerAI!.showDecisions, true);
  assert.equal(e.get().playerAI!.enabled, false);
  assert.deepEqual(withoutAI(e.get()), before);
  e.toggle("[data-player-ai-enabled]", true);
  assert.equal(e.get().playerAI!.enabled, true);
  assert.equal(e.get().playerAI!.showDecisions, true);
  assert.deepEqual(withoutAI(e.get()), before);
});
test("kaynak oyun ve kaynak defans modunda yollar korunur, AI tercihi kaydedilse de etkisiz olduğu açıkça gösterilir", () => {
  for (const initial of [
    planRavens(ravensScenario(ravensPlays[8].id, "diagram")).scenario,
    (() => {
      const s = applyOpponentPackage(
        ravensScenario(ravensPlays[0].id),
        opponentPackages[0].id,
      );
      s.opponent!.mode = "source";
      return planRavens(s).scenario;
    })(),
  ]) {
    const e = setup(initial),
      before = withoutAI(e.get());
    assert.equal(e.enabled.disabled, false);
    assert.equal(e.host.dataset.playerAiEffective, "false");
    assert.match(
      e.host.querySelector('[role="status"]')!.textContent!,
      /Kaynak çizimi korunur/,
    );
    e.toggle("[data-player-ai-decisions]", true);
    assert.equal(e.get().playerAI!.showDecisions, true);
    assert.equal(e.host.dataset.playerAiEffective, "false");
    assert.deepEqual(withoutAI(e.get()), before);
  }
});
test("kayıtlı tercihler tekrar açılır ve başka Ravens oyunu adı gösterilir; antrenman alanında panel gizlenir", () => {
  const initial = ravensScenario(ravensPlays[10].id);
  initial.playerAI = { enabled: false, showDecisions: true };
  const e = setup(Scenario.parse(JSON.parse(JSON.stringify(initial))));
  assert.equal(e.enabled.checked, false);
  assert.equal(e.decisions.checked, true);
  assert.match(e.host.querySelector(".player-ai-play")!.textContent!, /SPEED/);
  e.set(ravensScenario(ravensPlays[34].id));
  assert.match(e.host.querySelector(".player-ai-play")!.textContent!, /TAŞO/);
  assert.equal(e.enabled.checked, true);
  assert.equal(e.decisions.checked, false);
  e.set(defaultProtection());
  assert.equal(e.host.hidden, true);
  const before = structuredClone(e.get());
  e.toggle("[data-player-ai-enabled]", false);
  assert.deepEqual(e.get(), before);
});

test("otomatik oyun hesabı kapalıysa Saha AI tercihi açık olsa bile etkisiz olduğu gösterilir", () => {
  const initial = planRavens(ravensScenario(ravensPlays[0].id)).scenario;
  initial.ravens!.enabled = false;
  initial.playerAI = { enabled: true, showDecisions: false };
  const e = setup(initial),
    before = withoutAI(e.get());
  assert.equal(e.enabled.checked, true);
  assert.equal(e.host.dataset.playerAiEffective, "false");
  assert.match(
    e.host.querySelector('[role="status"]')!.textContent!,
    /Otomatik oyun kuralları kapalı/,
  );
  e.toggle("[data-player-ai-decisions]", true);
  assert.equal(e.get().playerAI!.showDecisions, true);
  assert.equal(e.host.dataset.playerAiEffective, "false");
  assert.deepEqual(withoutAI(e.get()), before);
});
