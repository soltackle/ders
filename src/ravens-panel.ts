import {
  eligiblePassTargets,
  isRavensPass,
  passWindow,
  passIntent,
  validatePassSelection,
} from "./ravens-pass.ts";
import { applyOpponentPackage } from "./opponent.ts";
import { ravensProfile, ravensMatchesGroup } from "./ravens-catalog.ts";
import {
  ravensPlays,
  drawingRoster,
  ravensScenario,
  planRavens,
  migrateRavensScenario,
  blockingLabels,
  changeRavensBlocking,
  type Blocking,
  type DrawingPlay,
} from "./ravens.ts";
import { Scenario, type ScenarioType } from "./model.ts";
import { defaultProtection } from "./examples.ts";
const ns = "http://www.w3.org/2000/svg";
export function ravensThumbnail(play: DrawingPlay) {
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", play.name + " kaynak çizimi");
  const roster = drawingRoster(play),
    points = roster.flatMap((p) => [
      p.at,
      ...p.paths.flatMap((a) =>
        a.points.map((v) => [p.at[0] + v[0], p.at[1] + v[1]]),
      ),
    ]);
  const left = Math.min(...points.map((p) => p[0])) - 1,
    right = Math.max(...points.map((p) => p[0])) + 1,
    low = Math.min(-4, ...points.map((p) => p[1])) - 1,
    high = Math.max(5, ...points.map((p) => p[1])) + 1;
  svg.setAttribute("viewBox", `${left} ${-high} ${right - left} ${high - low}`);
  const line = document.createElementNS(ns, "line");
  for (const [k, v] of Object.entries({
    x1: left,
    y1: 0,
    x2: right,
    y2: 0,
    stroke: "#aebca0",
    "stroke-width": 0.08,
  }))
    line.setAttribute(k, String(v));
  svg.append(line);
  for (const p of roster) {
    for (const a of p.paths) {
      const path = document.createElementNS(ns, "polyline");
      path.setAttribute(
        "points",
        a.points.map(([x, z]) => `${p.at[0] + x},${-p.at[1] - z}`).join(" "),
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#cce58b");
      path.setAttribute("stroke-width", ".1");
      if (a.motion) path.setAttribute("stroke-dasharray", ".3 .2");
      svg.append(path);
    }
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(p.at[0]));
    circle.setAttribute("cy", String(-p.at[1]));
    circle.setAttribute("r", ".3");
    circle.setAttribute("fill", "#e2e6dc");
    svg.append(circle);
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", String(p.at[0]));
    text.setAttribute("y", String(-p.at[1] - 0.5));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", ".65");
    text.setAttribute("fill", "#fff");
    text.textContent = p.id;
    svg.append(text);
  }
  return svg;
}
export function mountRavens(
  host: HTMLElement,
  api: {
    get: () => ScenarioType;
    set: (s: ScenarioType) => void;
    subscribe: (fn: () => void) => void;
  },
) {
  host.className = "ravens-page";
  host.innerHTML =
    '<div class="ravens-heading"><div><span class="eyebrow">RAVENS PLAYBOOK · MOST</span><h2>Ravens ofans oyunları</h2><p>35 numaralı oyun · takım oyun çağrıları · 11 ofans oyuncusu</p></div><span class="ravens-count" role="status"></span></div><details open class="ravens-library"><summary>Oyun kütüphanesi</summary><div class="ravens-filters"><label>Oyun ara<input type="search" aria-label="Ravens oyun ara" placeholder="Oyun numarası, adı veya türü…"></label><label>Grup<select aria-label="Ravens grup"><option value="all">Bütün oyunlar</option><option value="pass">Pas / koruma</option><option value="zone">Zone</option><option value="counter">Counter</option><option value="option">Speed option</option><option value="trap">Trap</option><option value="screen">Screen</option><option value="special">Özel oyunlar</option><option value="pistol">Pistol</option><option value="bunch">Bunch</option></select></label></div><div class="ravens-grid"></div></details><div class="ravens-active"><strong class="ravens-selected"></strong><label>OL blok şeması<select aria-label="Ravens blok şeması"></select></label><p>Oyun numaraları kaynak MOST sırasını korur. Takımın pas, zone ve özel oyun çağrıları bu numaralara bağlıdır. Savunma çalışma için eklenmiştir; front ve teknik değişince görevler yeniden hesaplanır. Snap ve koşu hızları eğitim zamanlamasıdır.</p><p class="ravens-team-note"></p><div class="ravens-special-controls" hidden><label>Top taşıyıcı<select aria-label="Ravens top taşıyıcı"></select></label><label class="ravens-option-control" hidden>Option okuması<select aria-label="Ravens option okuması"><option value="pitch">Pitch / dışarı ver</option><option value="keep">Keep / QB tutar</option></select></label><label>Top devir anı (sn)<input type="number" aria-label="Ravens top devir anı" min="0.1" max="119" step="0.1"></label><p>OL görevleri takım çağrısına bağlıdır. Top taşıyıcı ve devir zamanı eğitim için ayarlanabilir; savunmanın otomatik karar verdiği varsayılmaz.</p></div><div class="ravens-pass-controls" hidden><label>Pas alıcısı<select aria-label="Ravens pas alıcısı"><option value="">Top QB’de kalsın</option></select></label><label>Pas atış anı (sn)<input type="number" aria-label="Ravens pas atış anı" step="0.1"></label><label>Pas sonucu<select aria-label="Ravens pas sonucu"><option value="auto">Savunmaya göre</option><option value="complete">Tamamlandı</option><option value="incomplete">Tamamlanmadı</option></select></label><p class="ravens-pass-status" role="status" aria-live="polite"></p></div><p class="ravens-role"></p></div>';
  const search = host.querySelector<HTMLInputElement>("input")!,
    filter = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens grup"]',
    )!,
    grid = host.querySelector<HTMLElement>(".ravens-grid")!,
    mode = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens blok şeması"]',
    )!;
  const carrier = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens top taşıyıcı"]',
    )!,
    optionRead = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens option okuması"]',
    )!,
    transferAt = host.querySelector<HTMLInputElement>(
      '[aria-label="Ravens top devir anı"]',
    )!;
  const passControls = host.querySelector<HTMLElement>(
      ".ravens-pass-controls",
    )!,
    passTarget = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens pas alıcısı"]',
    )!,
    passRelease = host.querySelector<HTMLInputElement>(
      '[aria-label="Ravens pas atış anı"]',
    )!,
    passResult = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens pas sonucu"]',
    )!,
    passStatus = host.querySelector<HTMLElement>(".ravens-pass-status")!;
  for (const [value, text] of Object.entries(blockingLabels))
    mode.add(
      Object.assign(document.createElement("option"), {
        value,
        textContent: text,
      }),
    );
  const nav = document.createElement("nav");
  nav.className = "section-tabs";
  nav.setAttribute("aria-label", "Çalışma bölümleri");
  for (const [id, title] of [
    ["training", "OL Antrenman"],
    ["ravens", "Ravens · MOST"],
  ]) {
    const b = document.createElement("button");
    b.textContent = title;
    b.dataset.section = id;
    b.onclick = () => {
      location.hash = id;
    };
    nav.append(b);
  }
  host.before(nav);
  let active = "";
  let previous: ScenarioType | undefined;
  function cards() {
    grid.replaceChildren();
    const term = search.value.trim().toLocaleLowerCase("tr");
    const numeric = /^\d+$/.test(term) ? Number(term) : null;
    const list = ravensPlays.filter((p) => {
      const profile = ravensProfile(p.id);
      return (
        (numeric !== null
          ? profile.number === numeric
          : !term ||
            `${p.name} ${profile.label}`
              .toLocaleLowerCase("tr")
              .includes(term)) && ravensMatchesGroup(profile, filter.value)
      );
    });
    host.querySelector(".ravens-count")!.textContent =
      `${list.length} / 35 oyun`;
    for (const p of list) {
      const b = document.createElement("button");
      b.className = "ravens-card";
      const profile = ravensProfile(p.id);
      b.dataset.ravensPlay = p.id;
      b.dataset.ravensNumber = String(profile.number);
      b.dataset.ravensKind = profile.kind;
      b.setAttribute("aria-pressed", String(api.get().ravens?.id === p.id));
      b.append(ravensThumbnail(p));
      const title = document.createElement("strong");
      title.textContent = `${profile.number}. ${p.name}`;
      const type = document.createElement("small");
      type.className = "ravens-play-kind";
      type.textContent = profile.label;
      b.append(title, type);
      b.onclick = () => {
        const current = api.get();
        saveDraft();
        const draft = loadDraft("ol-ravens-" + p.id);
        let next = draft?.ravens?.id === p.id ? draft : ravensScenario(p.id);
        if (current.opponent && current.ravens?.id !== p.id) {
          next = applyOpponentPackage(next, current.opponent.id);
          next.opponent!.mode = current.opponent.mode;
        }
        api.set(planRavens(next).scenario);
      };
      grid.append(b);
    }
    if (!list.length) {
      const empty = document.createElement("p");
      empty.textContent = "Aramana uygun oyun yok.";
      grid.append(empty);
    }
  }
  function loadDraft(key: string) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const parsed = Scenario.parse(JSON.parse(raw));
      const migrated = parsed.ravens ? migrateRavensScenario(parsed) : parsed;
      return migrated !== parsed && migrated.ravens
        ? planRavens(migrated).scenario
        : migrated;
    } catch {
      return undefined;
    }
  }
  function saveDraft() {
    const s = api.get();
    localStorage.setItem(
      s.ravens ? "ol-draft-ravens" : "ol-draft-training",
      JSON.stringify(s),
    );
    if (s.ravens)
      localStorage.setItem("ol-ravens-" + s.ravens.id, JSON.stringify(s));
  }
  function sync() {
    const s = api.get();
    if (previous === s) return;
    if (previous && !previous.ravens && s.ravens)
      localStorage.setItem("ol-draft-training", JSON.stringify(previous));
    previous = s;
    if (s.ravens) saveDraft();
    const profile = s.ravens ? ravensProfile(s.ravens.id) : undefined;
    host.querySelector(".ravens-selected")!.textContent = profile
      ? `${profile.number}. ${s.name}`
      : "";
    host.querySelector(".ravens-team-note")!.textContent = profile
      ? `${profile.label} · ${profile.note}`
      : "";
    mode.value = s.ravens?.blocking ?? "diagram";
    const isPass = isRavensPass(s);
    passControls.hidden = !isPass;
    if (isPass) {
      const targets = eligiblePassTargets(s),
        selected = targets.find((p) => p.id === s.ravens?.passTarget),
        window = passWindow(s),
        validation = validatePassSelection(s);
      passTarget.replaceChildren();
      passTarget.add(
        Object.assign(document.createElement("option"), {
          value: "",
          textContent: "Top QB’de kalsın",
        }),
      );
      for (const p of targets)
        passTarget.add(
          Object.assign(document.createElement("option"), {
            value: p.id,
            textContent: `${p.id} · ${p.pos}`,
          }),
        );
      passTarget.value = selected?.id ?? "";
      passRelease.min = String(window.earliest);
      passRelease.max = String(window.latest);
      passRelease.disabled = !selected || window.latest < window.earliest;
      passResult.disabled = !selected;
      passRelease.value = selected ? String(validation.releaseAt) : "";
      passResult.value = s.ravens?.passResult ?? "auto";
      const timeline = selected ? passIntent(s) : null;
      passStatus.textContent = !selected
        ? "Top QB’de kalır. Pas için rotadaki bir alıcıyı seç."
        : !validation.valid
          ? (validation.reason ?? "Pas seçimini kontrol et.")
          : timeline
            ? `${selected.id} · Atış ${timeline.releaseAt.toFixed(1)} sn → Topun varışı ${timeline.catchAt.toFixed(1)} sn · ${(s.ravens?.passResult ?? "auto") === "auto" ? "Sonuç oynatmada savunma ve alıcı temasına göre belirlenir." : s.ravens?.passResult === "complete" ? "Tamamlandı (eğitim) · Alıcının pas noktasına yetişmesi gerekir." : "Tamamlanmadı (eğitim)."}`
            : "Pas için atış zamanını seç.";
    }
    const special = !!(
      !isPass &&
      s.ravens?.blocking === "team" &&
      profile &&
      !["pass", "zone", "zone-lead", "rollout", "pass-wrap"].includes(
        profile.kind,
      )
    );
    host.querySelector<HTMLElement>(".ravens-special-controls")!.hidden =
      !special;
    host.querySelector<HTMLElement>(".ravens-option-control")!.hidden =
      profile?.kind !== "speed-option";
    carrier.disabled = profile?.kind === "tushpush";
    transferAt.disabled = profile?.kind === "tushpush";
    if (special) {
      carrier.replaceChildren();
      for (const p of s.players.filter(
        (p) =>
          p.side === "OFF" && !["LT", "LG", "C", "RG", "RT"].includes(p.pos),
      )) {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = `${p.id} · ${p.pos}`;
        carrier.add(o);
      }
      carrier.value =
        s.ravens?.carrier ??
        (profile?.kind === "tushpush"
          ? "Q"
          : s.players.some((p) => p.id === "H")
            ? "H"
            : "Q");
      optionRead.value = s.ravens?.optionRead ?? "pitch";
      transferAt.value =
        s.ravens?.transferAt === undefined ? "" : String(s.ravens.transferAt);
    }
    const rb = s.players.find((p) => p.side === "OFF" && p.pos === "RB");
    host.querySelector(".ravens-role")!.textContent = s.ravens
      ? `Kaynak harfler korunur. Q = QB${rb ? `; ${rb.id} = RB (arka alan hizası)` : "; otomatik RB atanmadı"}. Çizim ölçeği OL aralığına göre normalize edilir.`
      : "";
    for (const b of grid.querySelectorAll<HTMLElement>("[data-ravens-play]"))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.ravensPlay === s.ravens?.id),
      );
    if (s.ravens && active !== "ravens") location.hash = "ravens";
    else if (!s.ravens && active === "ravens") location.hash = "training";
  }
  function section() {
    const next = location.hash === "#ravens" ? "ravens" : "training";
    if (next !== active) {
      const current = api.get();
      saveDraft();
      active = next;
      if (next === "ravens" && !current.ravens) {
        const saved = loadDraft("ol-draft-ravens");
        api.set(
          saved?.ravens
            ? saved
            : planRavens(ravensScenario(ravensPlays[0].id)).scenario,
        );
      } else if (next === "training" && current.ravens) {
        const saved = loadDraft("ol-draft-training");
        api.set(saved && !saved.ravens ? saved : defaultProtection());
      }
    }
    host.hidden = active !== "ravens";
    for (const b of nav.querySelectorAll<HTMLButtonElement>("button")) {
      b.classList.toggle("active", b.dataset.section === active);
      b.setAttribute(
        "aria-current",
        b.dataset.section === active ? "page" : "false",
      );
    }
  }
  mode.onchange = () => {
    if (api.get().ravens)
      api.set(
        planRavens(changeRavensBlocking(api.get(), mode.value as Blocking))
          .scenario,
      );
  };
  carrier.onchange = () => {
    const s = structuredClone(api.get());
    if (!s.ravens) return;
    const oldRead = s.ravens.optionRead,
      oldCarrier = s.ravens.carrier;
    s.ravens.carrier = carrier.value;
    if (ravensProfile(s.ravens.id).kind === "speed-option")
      s.ravens.optionRead =
        carrier.value === s.players.find((p) => p.pos === "QB")?.id
          ? "keep"
          : "pitch";
    if (
      s.ravens.optionRead !== oldRead ||
      (s.ravens.carrier !== oldCarrier && !s.ravens.transferManual)
    ) {
      s.ravens.transferAt = undefined;
      s.ravens.transferManual = false;
    }
    api.set(planRavens(s).scenario);
  };
  optionRead.onchange = () => {
    const s = structuredClone(api.get());
    if (!s.ravens) return;
    if (s.ravens.optionRead !== optionRead.value) {
      s.ravens.transferAt = undefined;
      s.ravens.transferManual = false;
    }
    s.ravens.optionRead = optionRead.value as "keep" | "pitch";
    s.ravens.carrier =
      optionRead.value === "keep"
        ? s.players.find((p) => p.pos === "QB")?.id
        : (s.players.find((p) => p.id === "H")?.id ??
          s.players.find(
            (p) =>
              p.side === "OFF" &&
              !["LT", "LG", "C", "RG", "RT", "QB"].includes(p.pos),
          )?.id);
    api.set(planRavens(s).scenario);
  };
  transferAt.onchange = () => {
    const s = structuredClone(api.get());
    if (!s.ravens) return;
    const v = Number(transferAt.value);
    if (!Number.isFinite(v) || v < 0.1 || v > 119) return;
    s.ravens.transferAt = v;
    s.ravens.transferManual = true;
    api.set(planRavens(s).scenario);
  };
  function updatePass(change: (s: ScenarioType) => void) {
    const s = structuredClone(api.get());
    if (!s.ravens || !isRavensPass(s)) return;
    change(s);
    try {
      api.set(planRavens(s).scenario);
    } catch (err) {
      passStatus.textContent = `Pas ayarı kaydedilemedi: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  passTarget.onchange = () => {
    const id = passTarget.value;
    updatePass((s) => {
      s.ravens!.passTarget = id || undefined;
      if (!id) {
        s.ravens!.passReleaseAt = undefined;
        s.ravens!.passResult = undefined;
      }
    });
  };
  passRelease.onchange = () => {
    const value = Number(passRelease.value),
      window = passWindow(api.get());
    if (passRelease.value === "" || !Number.isFinite(value)) {
      passStatus.textContent = "Geçerli bir atış zamanı gir.";
      return;
    }
    const bounded = Math.min(window.latest, Math.max(window.earliest, value));
    if (window.latest < window.earliest) {
      passStatus.textContent = "Bu oyunda uygun pas atış aralığı yok.";
      return;
    }
    updatePass((s) => {
      s.ravens!.passReleaseAt = bounded;
    });
  };
  passResult.onchange = () => {
    const result = passResult.value as "auto" | "complete" | "incomplete";
    updatePass((s) => {
      s.ravens!.passResult = result;
    });
  };
  search.oninput = cards;
  filter.onchange = cards;
  api.subscribe(sync);
  window.addEventListener("hashchange", section);
  const initial = api.get();
  if (initial.ravens) {
    const migrated = migrateRavensScenario(initial);
    if (migrated !== initial) api.set(planRavens(migrated).scenario);
  }
  cards();
  if (api.get().ravens && location.hash !== "#training")
    location.hash = "ravens";
  section();
  sync();
}
