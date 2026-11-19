import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mountOpponent } from "../src/opponent-panel.ts";
import { opponentPackages } from "../src/opponent.ts";
import { ravensScenario, ravensPlays } from "../src/ravens.ts";
import { defaultProtection } from "../src/examples.ts";
import type { ScenarioType } from "../src/model.ts";
function setup(
  initial: ScenarioType = ravensScenario(ravensPlays[0].id, "pass"),
) {
  const dom = new JSDOM("<section></section>");
  Object.assign(globalThis, { document: dom.window.document });
  let state = initial;
  const listeners: (() => void)[] = [];
  const host = document.querySelector<HTMLElement>("section")!;
  const api = {
    get: () => state,
    set: (s: ScenarioType) => {
      state = s;
      listeners.forEach((f) => f());
    },
    subscribe: (f: () => void) => listeners.push(f),
  };
  mountOpponent(host, api);
  return {
    dom,
    host,
    get: () => state,
    set: api.set,
    change: (label: string, value: string) => {
      const el = host.querySelector<HTMLSelectElement>(
        `[aria-label="${label}"]`,
      )!;
      el.value = value;
      el.dispatchEvent(new dom.window.Event("change"));
    },
  };
}
const offense = (s: ScenarioType) => s.players.filter((p) => p.side === "OFF");
const defense = (s: ScenarioType) => s.players.filter((p) => p.side === "DEF");
test("Kocaeli paket alanı hazır front menüsünden ayrı beş kaynak paketi gösterir ve Ravens dışında gizlenir", () => {
  const e = setup();
  assert.equal(e.host.hidden, false);
  assert.equal(e.host.querySelectorAll("[data-opponent-package]").length, 5);
  assert.equal(e.host.querySelectorAll('svg[role="img"]').length, 5);
  assert.equal(e.host.querySelectorAll("svg circle").length, 55);
  assert.equal(
    e.host.querySelectorAll('[aria-label="Kocaeli rakip paket"] option').length,
    6,
  );
  assert.match(e.host.textContent!, /Rakip defans paketi · Kocaeli/);
  assert.ok(
    opponentPackages.some((p) => p.name.toLowerCase().includes("trips")),
  );
  assert.ok(
    opponentPackages.some((p) => p.name.toLowerCase().includes("spread")),
  );
  assert.equal(e.host.querySelector("#defense-front"), null);
  assert.equal(
    e.host.querySelector<HTMLButtonElement>(".opponent-clear")!.disabled,
    true,
  );
  e.set(defaultProtection());
  assert.equal(e.host.hidden, true);
  e.host.querySelector<HTMLButtonElement>("[data-opponent-package]")!.click();
  assert.equal(e.get().opponent, undefined);
});
test("Trips paketi seçilince 11 rakip yüklenir, ofans ve Ravens kimliği korunur", () => {
  const e = setup(),
    before = structuredClone(offense(e.get())),
    id = e.get().ravens!.id,
    pkg = opponentPackages.find((p) => p.name.toLowerCase().includes("trips"))!;
  e.change("Kocaeli rakip paket", pkg.id);
  assert.equal(e.get().opponent!.id, pkg.id);
  assert.equal(e.get().opponent!.mode, "adaptive");
  assert.equal(defense(e.get()).length, 11);
  assert.deepEqual(offense(e.get()), before);
  assert.equal(e.get().ravens!.id, id);
  assert.equal(
    e.host
      .querySelector('[aria-pressed="true"]')!
      .getAttribute("data-opponent-package"),
    pkg.id,
  );
  assert.match(
    e.host.querySelector('[role="status"]')!.textContent!,
    /11 savunmacı/,
  );
  assert.equal(
    e.host.querySelector<HTMLButtonElement>(".opponent-clear")!.disabled,
    false,
  );
});
test("kaynak ve adaptif tepki modları paket kimliği ile ofansı değiştirmeden seçilir", () => {
  const e = setup(),
    before = structuredClone(offense(e.get())),
    pkg = opponentPackages[0];
  e.host
    .querySelector<HTMLButtonElement>(`[data-opponent-package="${pkg.id}"]`)!
    .click();
  e.change("Kocaeli reaksiyon modu", "source");
  assert.equal(e.get().opponent!.mode, "source");
  assert.equal(e.get().opponent!.id, pkg.id);
  assert.match(
    e.host.querySelector(".opponent-caption")!.textContent!,
    /kaynakta çizilmiş/,
  );
  assert.deepEqual(offense(e.get()), before);
  e.change("Kocaeli reaksiyon modu", "adaptive");
  assert.equal(e.get().opponent!.mode, "adaptive");
  assert.match(
    e.host.querySelector(".opponent-caption")!.textContent!,
    /Ravens/,
  );
  assert.deepEqual(offense(e.get()), before);
});
test("paketler arası geçişten sonra kaldırmak orijinal hazır savunmayı ve özel DL yerleşimini geri getirir", () => {
  const initial = ravensScenario(ravensPlays[0].id, "pass");
  initial.players.find((p) => p.id === "DL1")!.at = [-3.17, 1.27];
  const originalDefense = structuredClone(defense(initial)),
    originalOffense = structuredClone(offense(initial)),
    e = setup(initial);
  e.change("Kocaeli rakip paket", opponentPackages[0].id);
  e.change("Kocaeli rakip paket", opponentPackages[1].id);
  e.host.querySelector<HTMLButtonElement>(".opponent-clear")!.click();
  assert.equal(e.get().opponent, undefined);
  assert.deepEqual(defense(e.get()), originalDefense);
  assert.deepEqual(offense(e.get()), originalOffense);
  assert.equal(
    e.host.querySelector<HTMLSelectElement>(
      '[aria-label="Kocaeli rakip paket"]',
    )!.value,
    "",
  );
  assert.equal(e.host.querySelectorAll('[aria-pressed="true"]').length, 0);
  assert.match(
    e.host.querySelector('[role="status"]')!.textContent!,
    /önceki savunma/,
  );
});
test("boş paket seçeneği kaldırır; kaydedilmiş paket ve kaynak modu ilk açılışta arayüze yansır", () => {
  const e = setup();
  e.change("Kocaeli rakip paket", opponentPackages[4].id);
  e.change("Kocaeli reaksiyon modu", "source");
  const restored = setup(structuredClone(e.get()));
  assert.equal(
    restored.host.querySelector<HTMLSelectElement>(
      '[aria-label="Kocaeli rakip paket"]',
    )!.value,
    opponentPackages[4].id,
  );
  assert.equal(
    restored.host.querySelector<HTMLSelectElement>(
      '[aria-label="Kocaeli reaksiyon modu"]',
    )!.value,
    "source",
  );
  assert.equal(
    restored.host.querySelectorAll('[aria-pressed="true"]').length,
    1,
  );
  restored.change("Kocaeli rakip paket", "");
  assert.equal(restored.get().opponent, undefined);
  assert.equal(
    restored.host.querySelector<HTMLButtonElement>(".opponent-clear")!.disabled,
    true,
  );
});

test("Ravens oyun kartı değişince seçili Kocaeli paketi ve kaynak modu yeni ofansa taşınır", async () => {
  const { mountRavens } = await import("../src/ravens-panel.ts");
  const dom = new JSDOM(
    '<section id="ravens"></section><section id="opponent"></section>',
    { url: "https://example.com/ders/#ravens" },
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    location: dom.window.location,
  });
  let state: ScenarioType = ravensScenario(ravensPlays[0].id, "pass");
  const listeners: (() => void)[] = [];
  const api = {
    get: () => state,
    set: (s: ScenarioType) => {
      state = s;
      listeners.forEach((f) => f());
    },
    subscribe: (f: () => void) => listeners.push(f),
  };
  const raven = document.querySelector<HTMLElement>("#ravens")!,
    opponent = document.querySelector<HTMLElement>("#opponent")!;
  mountRavens(raven, api);
  mountOpponent(opponent, api);
  const pkg = opponentPackages.find((p) =>
    p.name.toLowerCase().includes("trips"),
  )!;
  const select = opponent.querySelector<HTMLSelectElement>(
      '[aria-label="Kocaeli rakip paket"]',
    )!,
    mode = opponent.querySelector<HTMLSelectElement>(
      '[aria-label="Kocaeli reaksiyon modu"]',
    )!;
  select.value = pkg.id;
  select.dispatchEvent(new dom.window.Event("change"));
  mode.value = "source";
  mode.dispatchEvent(new dom.window.Event("change"));
  raven.querySelector<HTMLButtonElement>('[data-ravens-number="3"]')!.click();
  assert.equal(state.ravens!.id, ravensPlays[2].id);
  assert.equal(state.opponent!.id, pkg.id);
  assert.equal(state.opponent!.mode, "source");
  assert.equal(defense(state).length, 11);
  assert.deepEqual(
    offense(state),
    offense(ravensScenario(ravensPlays[2].id, "pass")),
  );
  assert.equal(select.value, pkg.id);
  assert.equal(mode.value, "source");
  assert.equal(
    opponent
      .querySelector(`[data-opponent-package="${pkg.id}"]`)!
      .getAttribute("aria-pressed"),
    "true",
  );
  await new Promise((r) => setTimeout(r, 0));
  dom.window.close();
});
