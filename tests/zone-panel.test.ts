import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mountZonePanel } from "../src/zone-panel.ts";
import { renderCoverage } from "../src/coverage-panel.ts";
import { defaultFieldZone, defaultProtection } from "../src/examples.ts";
import { planZone } from "../src/zone.ts";
import { trainingFront } from "../src/training.ts";
import type { ScenarioType } from "../src/model.ts";
test("zone paneli inside/outside ve genel/oyuncu bazlı reaksiyonları kaydeder, yeni hareketleri temizler", () => {
  const dom = new JSDOM("<section></section>");
  Object.assign(globalThis, { document: dom.window.document });
  const root = document.querySelector<HTMLElement>("section")!;
  let state: ScenarioType = planZone(defaultFieldZone()).scenario;
  const listeners: (() => void)[] = [];
  mountZonePanel(root, {
    get: () => state,
    set: (s) => {
      state = s;
      listeners.forEach((f) => f());
    },
    subscribe: (f) => {
      listeners.push(f);
    },
  });
  function change(label: string, value: string) {
    const e = root.querySelector<HTMLSelectElement>(
      `select[aria-label="${label}"]`,
    )!;
    e.value = value;
    e.dispatchEvent(new dom.window.Event("change"));
  }
  change("Zone türü", "outside");
  assert.equal(state.zone!.variant, "outside");
  assert.ok(!state.actions.some((a) => a.source === "zone"));
  change("DL reaksiyonu", "twist");
  change("LB reaksiyonu", "scrape");
  change("DL1 reaksiyonu", "pinch");
  assert.equal(state.zone!.dlReaction, "twist");
  assert.equal(state.zone!.lbReaction, "scrape");
  assert.equal(state.players.find((p) => p.id === "DL1")!.reaction, "pinch");
  assert.match(
    root.querySelector('[role="status"]')!.textContent!,
    /kaydedildi/,
  );
  state = defaultProtection();
  listeners.forEach((f) => f());
  assert.equal(root.hidden, true);
});
test("zone paylaşım tablosu RB’yi taşıyıcı, QB’yi mesh olarak ve ekstra DL’yi serbest takipçi olarak gösterir", () => {
  const dom = new JSDOM("<section></section>");
  Object.assign(globalThis, { document: dom.window.document });
  const root = document.querySelector<HTMLElement>("section")!;
  renderCoverage(root, planZone(trainingFront(defaultFieldZone(), 6)));
  assert.match(
    root.querySelector('[data-blocker="RB"]')!.textContent!,
    /TOP TAŞIYICI/,
  );
  assert.match(
    root.querySelector('[data-blocker="QB"]')!.textContent!,
    /HANDOFF/,
  );
  assert.match(root.textContent!, /BLOK DIŞI \/ TAKİP/);
  assert.ok(!root.textContent!.includes("HOT"));
  assert.ok(!root.textContent!.includes("ALERT"));
});
