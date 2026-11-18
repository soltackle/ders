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
  assert.equal(root.querySelectorAll("[data-ravens-play]").length, 2);
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
