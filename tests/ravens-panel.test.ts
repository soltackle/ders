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
