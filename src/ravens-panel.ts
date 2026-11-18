import {
  ravensPlays,
  drawingRoster,
  ravensScenario,
  planRavens,
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
    '<div class="ravens-heading"><div><span class="eyebrow">RAVENS PLAYBOOK · MOST</span><h2>Ravens ofans oyunları</h2><p>35 kaynak çizim · 11 ofans oyuncusu · motion ve rotalar</p></div><span class="ravens-count" role="status"></span></div><details open class="ravens-library"><summary>Oyun kütüphanesi</summary><div class="ravens-filters"><label>Oyun ara<input type="search" aria-label="Ravens oyun ara" placeholder="Oyun adı, zone, pistol, bunch…"></label><label>Grup<select aria-label="Ravens grup"><option value="all">Bütün oyunlar</option><option value="zone">Zone</option><option value="counter">Counter</option><option value="option">Option</option><option value="pistol">Pistol</option><option value="bunch">Bunch</option></select></label></div><div class="ravens-grid"></div></details><div class="ravens-active"><strong class="ravens-selected"></strong><label>OL blok şeması<select aria-label="Ravens blok şeması"></select></label><p>Kaynakta savunma çizilmemiştir; aşağıdaki savunma çalışma için eklenmiştir. Çizimdeki yollar modunda özel counter/option kararları varsayılmaz. Pas ve zone modlarında OL ile ilgili RB/QB görevleri takım şemasından hesaplanır; kaynak çizim kartta korunur. Snap ve koşu hızları eğitim zamanlamasıdır.</p><p class="ravens-role"></p></div>';
  const search = host.querySelector<HTMLInputElement>("input")!,
    filter = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens grup"]',
    )!,
    grid = host.querySelector<HTMLElement>(".ravens-grid")!,
    mode = host.querySelector<HTMLSelectElement>(
      '[aria-label="Ravens blok şeması"]',
    )!;
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
    const term = search.value.toLocaleLowerCase("tr");
    const list = ravensPlays.filter(
      (p) =>
        (!term || p.name.toLocaleLowerCase("tr").includes(term)) &&
        (filter.value === "all" ||
          p.name.toLocaleLowerCase("tr").includes(filter.value)),
    );
    host.querySelector(".ravens-count")!.textContent =
      `${list.length} / 35 oyun`;
    for (const p of list) {
      const b = document.createElement("button");
      b.className = "ravens-card";
      b.dataset.ravensPlay = p.id;
      b.setAttribute("aria-pressed", String(api.get().ravens?.id === p.id));
      b.append(ravensThumbnail(p));
      const title = document.createElement("strong");
      title.textContent = p.name;
      b.append(title);
      b.onclick = () => {
        saveDraft();
        const next = loadDraft("ol-ravens-" + p.id);
        api.set(
          next?.ravens?.id === p.id
            ? next
            : planRavens(ravensScenario(p.id)).scenario,
        );
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
      return raw ? Scenario.parse(JSON.parse(raw)) : undefined;
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
    host.querySelector(".ravens-selected")!.textContent = s.ravens
      ? s.name
      : "";
    mode.value = s.ravens?.blocking ?? "diagram";
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
  search.oninput = cards;
  filter.onchange = cards;
  api.subscribe(sync);
  window.addEventListener("hashchange", section);
  cards();
  if (api.get().ravens && location.hash !== "#training")
    location.hash = "ravens";
  section();
  sync();
}
