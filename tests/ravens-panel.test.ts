import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mountRavens } from "../src/ravens-panel.ts";
import { ravensPlays } from "../src/ravens.ts";
import { defaultProtection } from "../src/examples.ts";
import type { ScenarioType } from "../src/model.ts";
test("Ravens sekmesinde 35 kart, arama/grup filtresi, oyun açma, blok değiştirme ve antrenman taslağına dönüş çalışır", async () => {
  const dom = new JSDOM('<section id="ravens"></section>', {
    url: "https://example.com/ders/",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
  });
  let state: ScenarioType = defaultProtection();
  state.players.find((p) => p.id === "DL1")!.at = [-3.1, 1];
  const original = structuredClone(state),
    listeners: (() => void)[] = [];
  const root = document.querySelector<HTMLElement>("#ravens")!;
  mountRavens(root, {
    get: () => state,
    set: (s) => {
      state = s;
      listeners.forEach((f) => f());
    },
    subscribe: (f) => {
      listeners.push(f);
    },
  });
  assert.equal(root.hidden, true);
  assert.equal(root.querySelectorAll("[data-ravens-play]").length, 35);
  document.querySelector<HTMLButtonElement>('[data-section="ravens"]')!.click();
  window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
  assert.equal(root.hidden, false);
  assert.ok(state.ravens);
  assert.equal(state.players.filter((p) => p.side === "OFF").length, 11);
  const search = root.querySelector<HTMLInputElement>("input")!;
  search.value = "counter";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.equal(root.querySelectorAll("[data-ravens-play]").length, 5);
  search.value = "31";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.equal(root.querySelectorAll("[data-ravens-play]").length, 1);
  assert.equal(
    root.querySelector<HTMLElement>("[data-ravens-play]")!.dataset.ravensNumber,
    "31",
  );
  assert.match(
    root.querySelector("[data-ravens-play]")!.textContent!,
    /guard lead/,
  );
  search.value = "";
  search.dispatchEvent(new dom.window.Event("input"));
  const filter = root.querySelector<HTMLSelectElement>(
    '[aria-label="Ravens grup"]',
  )!;
  filter.value = "pistol";
  filter.dispatchEvent(new dom.window.Event("change"));
  assert.equal(root.querySelectorAll("[data-ravens-play]").length, 6);
  const id =
    root.querySelector<HTMLButtonElement>("[data-ravens-play]")!.dataset
      .ravensPlay!;
  root.querySelector<HTMLButtonElement>("[data-ravens-play]")!.click();
  assert.equal(state.ravens!.id, id);
  const mode = root.querySelector<HTMLSelectElement>(
    '[aria-label="Ravens blok şeması"]',
  )!;
  mode.value = "outside";
  mode.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.ravens!.blocking, "outside");
  assert.equal(state.zone!.variant, "outside");
  assert.ok(state.actions.some((a) => a.label === "zone-step"));
  document
    .querySelector<HTMLButtonElement>('[data-section="training"]')!
    .click();
  window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
  assert.equal(root.hidden, true);
  assert.deepEqual(state, original);
  document.querySelector<HTMLButtonElement>('[data-section="ravens"]')!.click();
  window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
  assert.equal(state.ravens!.id, id);
  assert.equal(state.ravens!.blocking, "outside");
  search.value = "oyun yok 999";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.equal(root.querySelectorAll("[data-ravens-play]").length, 0);
  assert.match(root.textContent!, /uygun oyun yok/);
  await new Promise((r) => setTimeout(r, 0));
  dom.window.close();
});

test("özel takım oyununda taşıyıcı, option keep/pitch ve devir zamanı seçilir; pas oyununda bu alan gizlenir", async () => {
  const { ravensScenario, planRavens } = await import("../src/ravens.ts");
  const dom = new JSDOM("<section></section>", {
    url: "https://example.com/ders/#ravens",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
  });
  let state = planRavens(ravensScenario(ravensPlays[10].id)).scenario;
  const listeners: (() => void)[] = [];
  const root = document.querySelector<HTMLElement>("section")!;
  mountRavens(root, {
    get: () => state,
    set: (s) => {
      state = s;
      listeners.forEach((f) => f());
    },
    subscribe: (f) => listeners.push(f),
  });
  assert.equal(
    root.querySelector<HTMLElement>(".ravens-special-controls")!.hidden,
    false,
  );
  assert.equal(
    root.querySelector<HTMLElement>(".ravens-option-control")!.hidden,
    false,
  );
  assert.match(root.querySelector(".ravens-selected")!.textContent!, /^11\./);
  const read = root.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens option okuması"]',
    )!,
    carrier = root.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens top taşıyıcı"]',
    )!,
    time = root.querySelector<HTMLInputElement>(
      '[aria-label="Ravens top devir anı"]',
    )!;
  assert.ok(
    ![...carrier.options].some((o) =>
      ["LT", "LG", "C", "RG", "RT"].includes(o.value),
    ),
  );
  read.value = "keep";
  read.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.ravens!.optionRead, "keep");
  assert.equal(state.ravens!.carrier, "Q");
  carrier.value = "H";
  carrier.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.ravens!.optionRead, "pitch");
  assert.equal(state.ravens!.carrier, "H");
  assert.ok(
    state.ravens!.transferAt! > state.steps[0].end + 0.5,
    "Pitch keep dalının snap anındaki devrini taşımamalı",
  );
  time.value = "3.7";
  time.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.ravens!.transferAt, 3.7);
  assert.equal(state.ravens!.transferManual, true);
  root.querySelector<HTMLButtonElement>('[data-ravens-number="35"]')!.click();
  assert.equal(carrier.value, "Q");
  assert.equal(carrier.disabled, true);
  assert.equal(time.disabled, true);
  root.querySelector<HTMLButtonElement>('[data-ravens-number="1"]')!.click();
  assert.equal(
    root.querySelector<HTMLElement>(".ravens-special-controls")!.hidden,
    true,
  );
  assert.match(
    root.querySelector(".ravens-team-note")!.textContent!,
    /pas koruması/,
  );
  assert.equal(carrier.disabled, false);
  assert.equal(time.disabled, false);
  await new Promise((r) => setTimeout(r, 0));
  dom.window.close();
});

test("önceki Ravens taslağı yeni takım çağrısına geçirilirken defans yerleşimi korunur", async () => {
  const { ravensScenario } = await import("../src/ravens.ts");
  const { RAVENS_PROFILE_REVISION } = await import("../src/ravens-catalog.ts");
  const dom = new JSDOM("<section></section>", {
    url: "https://example.com/ders/#ravens",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
  });
  const legacy = ravensScenario(ravensPlays[18].id, "diagram");
  delete legacy.ravens!.revision;
  legacy.players.find((p) => p.id === "DL1")!.at = [-3.1, 1];
  localStorage.setItem("ol-draft-ravens", JSON.stringify(legacy));
  let state: ScenarioType = defaultProtection();
  const listeners: (() => void)[] = [];
  mountRavens(document.querySelector<HTMLElement>("section")!, {
    get: () => state,
    set: (s) => {
      state = s;
      listeners.forEach((f) => f());
    },
    subscribe: (f) => listeners.push(f),
  });
  assert.equal(state.ravens!.id, ravensPlays[18].id);
  assert.equal(state.ravens!.revision, RAVENS_PROFILE_REVISION);
  assert.equal(state.ravens!.blocking, "team");
  assert.deepEqual(state.players.find((p) => p.id === "DL1")!.at, [-3.1, 1]);
  assert.match(
    document.querySelector(".ravens-team-note")!.textContent!,
    /3-tech trap/,
  );
  await new Promise((r) => setTimeout(r, 0));
  dom.window.close();
});

test("pas alıcısı rotadaki WR’lerden seçilir; atış zamanı sınırlanır ve tamamlanmayan pas seçimi saklanır", async () => {
  const { ravensScenario, planRavens } = await import("../src/ravens.ts"),
    { passWindow, eligiblePassTargets, passTimeline, validatePassSelection } =
      await import("../src/ravens-pass.ts");
  const dom = new JSDOM("<section></section>", {
    url: "https://example.com/ders/#ravens",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
  });
  let state = planRavens(ravensScenario(ravensPlays[0].id)).scenario;
  const listeners: (() => void)[] = [];
  const root = document.querySelector<HTMLElement>("section")!,
    api = {
      get: () => state,
      set: (s: ScenarioType) => {
        state = s;
        listeners.forEach((f) => f());
      },
      subscribe: (f: () => void) => listeners.push(f),
    };
  mountRavens(root, api);
  const controls = root.querySelector<HTMLElement>(".ravens-pass-controls")!,
    target = root.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens pas alıcısı"]',
    )!,
    release = root.querySelector<HTMLInputElement>(
      '[aria-label="Ravens pas atış anı"]',
    )!,
    result = root.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens pas sonucu"]',
    )!;
  assert.equal(controls.hidden, false);
  assert.equal(release.disabled, true);
  assert.equal(result.disabled, true);
  assert.equal(target.value, "");
  assert.match(target.options[0].textContent!, /QB/);
  assert.deepEqual(
    [...target.options].slice(1).map((o) => o.value),
    eligiblePassTargets(state).map((p) => p.id),
  );
  assert.ok(
    ![...target.options].some((o) =>
      ["C", "LG", "RG", "LT", "RT", "Q"].includes(o.value),
    ),
  );
  target.value = "X";
  target.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.ravens!.passTarget, "X");
  assert.equal(release.disabled, false);
  assert.equal(result.disabled, false);
  assert.ok(passTimeline(state));
  assert.equal(Number(release.value), passTimeline(state)!.releaseAt);
  assert.match(root.querySelector(".ravens-pass-status")!.textContent!, /Atış/);
  const bounds = passWindow(state);
  release.value = String(bounds.latest + 20);
  release.dispatchEvent(new dom.window.Event("change"));
  assert.ok(state.ravens!.passReleaseAt! <= bounds.latest + 1e-6);
  assert.ok(state.ravens!.passReleaseAt! >= bounds.earliest);
  result.value = "incomplete";
  result.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.ravens!.passResult, "incomplete");
  assert.equal(passTimeline(state)!.outcome, "incomplete");
  assert.match(
    root.querySelector(".ravens-pass-status")!.textContent!,
    /Tamamlanmadı/,
  );
  target.value = "";
  target.dispatchEvent(new dom.window.Event("change"));
  assert.equal(state.ravens!.passTarget, undefined);
  assert.equal(release.disabled, true);
  assert.equal(passTimeline(state), null);
  assert.match(
    root.querySelector(".ravens-pass-status")!.textContent!,
    /QB’de/,
  );
  const stale = structuredClone(state);
  stale.ravens!.passTarget = "C";
  api.set(planRavens(stale).scenario);
  assert.equal(target.value, "");
  assert.equal(release.disabled, true);
  await new Promise((r) => setTimeout(r, 0));
  dom.window.close();
});

test("pas ayarları rakip paketini korur; başka Ravens oyunundan dönünce kendi alıcısı ve atış anı yüklenir", async () => {
  const { ravensScenario, planRavens } = await import("../src/ravens.ts"),
    { applyOpponentPackage, opponentPackages } =
      await import("../src/opponent.ts"),
    { passWindow } = await import("../src/ravens-pass.ts");
  const dom = new JSDOM("<section></section>", {
    url: "https://example.com/ders/#ravens",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
  });
  let state = planRavens(
    applyOpponentPackage(
      ravensScenario(ravensPlays[0].id),
      opponentPackages[1].id,
    ),
  ).scenario;
  const listeners: (() => void)[] = [];
  const root = document.querySelector<HTMLElement>("section")!;
  mountRavens(root, {
    get: () => state,
    set: (s) => {
      state = s;
      listeners.forEach((f) => f());
    },
    subscribe: (f) => listeners.push(f),
  });
  const target = root.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens pas alıcısı"]',
    )!,
    release = root.querySelector<HTMLInputElement>(
      '[aria-label="Ravens pas atış anı"]',
    )!;
  target.value = "X";
  target.dispatchEvent(new dom.window.Event("change"));
  const bounds = passWindow(state),
    chosen = (bounds.earliest + bounds.latest) / 2;
  release.value = String(chosen);
  release.dispatchEvent(new dom.window.Event("change"));
  const originalTime = state.ravens!.passReleaseAt;
  assert.equal(state.opponent!.id, opponentPackages[1].id);
  assert.equal(state.ravens!.passTarget, "X");
  root.querySelector<HTMLButtonElement>('[data-ravens-number="3"]')!.click();
  assert.equal(state.ravens!.id, ravensPlays[2].id);
  assert.equal(state.opponent!.id, opponentPackages[1].id);
  root.querySelector<HTMLButtonElement>('[data-ravens-number="1"]')!.click();
  assert.equal(state.ravens!.passTarget, "X");
  assert.equal(state.ravens!.passReleaseAt, originalTime);
  assert.equal(target.value, "X");
  assert.equal(state.opponent!.id, opponentPackages[1].id);
  await new Promise((r) => setTimeout(r, 0));
  dom.window.close();
});

test("rollout, boundary wrap ve screen pas kontrollerini kullanır; koşu oyunları pas alıcısı alanını gizler", async () => {
  const { ravensScenario, planRavens } = await import("../src/ravens.ts");
  const dom = new JSDOM("<section></section>", {
    url: "https://example.com/ders/#ravens",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
  });
  let state = planRavens(ravensScenario(ravensPlays[9].id)).scenario;
  const listeners: (() => void)[] = [];
  const root = document.querySelector<HTMLElement>("section")!;
  const set = (s: ScenarioType) => {
    state = s;
    listeners.forEach((f) => f());
  };
  mountRavens(root, {
    get: () => state,
    set,
    subscribe: (f) => listeners.push(f),
  });
  for (const n of [10, 21, 32]) {
    set(planRavens(ravensScenario(ravensPlays[n - 1].id)).scenario);
    assert.equal(
      root.querySelector<HTMLElement>(".ravens-pass-controls")!.hidden,
      false,
      String(n),
    );
    assert.equal(
      root.querySelector<HTMLElement>(".ravens-special-controls")!.hidden,
      true,
      String(n),
    );
  }
  const { trainingDefense } = await import("../src/training.ts");
  set(
    planRavens(
      trainingDefense(ravensScenario(ravensPlays[1].id), "left", "blitz"),
    ).scenario,
  );
  const receivers = root.querySelector<HTMLSelectElement>(
    '[aria-label="Ravens pas alıcısı"]',
  )!;
  assert.ok(
    ![...receivers.options].some((o) => o.value === "H"),
    "HPP içindeki pickup RB pas alıcısı olarak sunulmamalı",
  );
  assert.ok([...receivers.options].some((o) => o.value === "X"));
  set(planRavens(ravensScenario(ravensPlays[5].id)).scenario);
  assert.equal(
    root.querySelector<HTMLElement>(".ravens-pass-controls")!.hidden,
    true,
  );
  await new Promise((r) => setTimeout(r, 0));
  dom.window.close();
});
