import {
  opponentPackages,
  applyOpponentPackage,
  removeOpponentPackage,
  changeOpponentAlignment,
  type OpponentAlignment,
} from "./opponent.ts";
import { planRavens } from "./ravens.ts";
import type { ScenarioType } from "./model.ts";

const ns = "http://www.w3.org/2000/svg";
type Package = (typeof opponentPackages)[number];
function preview(pkg: Package) {
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${pkg.name} rakip yerleşimi`);
  const points = pkg.players.map((p) => p.at),
    xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]);
  const left = Math.min(...xs) - 1,
    right = Math.max(...xs) + 1,
    low = Math.min(0, ...zs) - 1,
    high = Math.max(...zs) + 1;
  svg.setAttribute("viewBox", `${left} ${-high} ${right - left} ${high - low}`);
  const los = document.createElementNS(ns, "line");
  for (const [k, v] of Object.entries({
    x1: left,
    x2: right,
    y1: 0,
    y2: 0,
    stroke: "#91ad76",
    "stroke-width": 0.08,
  }))
    los.setAttribute(k, String(v));
  svg.append(los);
  for (const p of pkg.players) {
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", String(p.at[0]));
    dot.setAttribute("cy", String(-p.at[1]));
    dot.setAttribute("r", ".25");
    dot.setAttribute(
      "fill",
      p.pos === "DL" ? "#edbc77" : p.pos === "LB" ? "#a3c9ee" : "#dce7d3",
    );
    svg.append(dot);
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(p.at[0]));
    label.setAttribute("y", String(-p.at[1] - 0.4));
    label.setAttribute("font-size", ".5");
    label.setAttribute("fill", "#e9efdf");
    label.setAttribute("text-anchor", "middle");
    label.textContent = p.label ?? p.id;
    svg.append(label);
  }
  return svg;
}
export function mountOpponent(
  host: HTMLElement,
  api: {
    get: () => ScenarioType;
    set: (s: ScenarioType) => void;
    subscribe: (fn: () => void) => void;
  },
) {
  host.className = "opponent-panel";
  host.setAttribute("aria-label", "Kocaeli rakip defans paketleri");
  host.innerHTML =
    '<style>.opponent-panel{margin:16px 0;padding:16px;border:1px solid #4a6250;background:#14291e;border-radius:8px}.opponent-panel[hidden]{display:none}.opponent-panel h3{font-size:16px;color:#dce9bb;margin:0 0 8px}.opponent-panel p{font-size:11px;line-height:1.6;color:#b7c8b0}.opponent-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:12px 0}.opponent-panel label{display:grid;gap:6px;font-size:11px;color:#c0d0b8}.opponent-panel select,.opponent-clear,.opponent-mirror{padding:9px;background:#0c1e13;color:#e4edd8;border:1px solid #58714b;border-radius:5px;max-width:100%;font-size:11px}.opponent-package-select{min-width:220px}.opponent-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.opponent-card{padding:10px;min-width:0;background:#1c3525;color:#e2ecd8;border:1px solid #4c6349;border-radius:6px;text-align:left;cursor:pointer}.opponent-card[aria-pressed=true]{outline:2px solid #cce483;background:#30462d}.opponent-card svg{display:block;width:100%;height:105px;background:#102318;border-radius:4px}.opponent-card strong{display:block;font-size:11px;line-height:1.5;margin:8px 0 4px;overflow-wrap:anywhere}.opponent-card small{font-size:10px;color:#aec2a2}.opponent-status{margin-bottom:0}.opponent-clear:disabled,.opponent-mirror:disabled{opacity:.5;cursor:default}@media(max-width:600px){.opponent-panel{padding:12px}.opponent-controls{display:grid;grid-template-columns:1fr}.opponent-package-select{min-width:0;width:100%}.opponent-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h3>Rakip defans paketi · Kocaeli</h3><p>Rakibin 4–3 paketleri, hazır savunma front menüsünden ayrı seçilir. Kaynak yerleşiminde 11 savunmacı bulunur.</p><div class="opponent-controls"><label>Rakip paket<select class="opponent-package-select" aria-label="Kocaeli rakip paket"><option value="">Paket seçilmedi · hazır savunma</option></select></label><label>Reaksiyon<select aria-label="Kocaeli reaksiyon modu"><option value="adaptive">Ravens oyununa tepki</option><option value="source">Kaynakta çizilmiş hareketler</option></select></label><label>Yerleşim yönü<select aria-label="Kocaeli yerleşim yönü"><option value="auto">Otomatik · trips tarafına</option><option value="source">Kaynak yönü</option><option value="mirror">Ayna yönü</option></select></label><button type="button" class="opponent-mirror">Defansı aynala</button><button type="button" class="opponent-clear">Paketi kaldır · önceki savunmaya dön</button></div><div class="opponent-cards"></div><p class="opponent-caption"></p><p class="opponent-status" role="status" aria-live="polite"></p>';
  const select = host.querySelector<HTMLSelectElement>(
      '[aria-label="Kocaeli rakip paket"]',
    )!,
    mode = host.querySelector<HTMLSelectElement>(
      '[aria-label="Kocaeli reaksiyon modu"]',
    )!,
    alignment = host.querySelector<HTMLSelectElement>('[aria-label="Kocaeli yerleşim yönü"]')!,
    mirror = host.querySelector<HTMLButtonElement>(".opponent-mirror")!,
    clear = host.querySelector<HTMLButtonElement>(".opponent-clear:not(.opponent-mirror)")!,
    cards = host.querySelector<HTMLElement>(".opponent-cards")!,
    caption = host.querySelector<HTMLElement>(".opponent-caption")!,
    status = host.querySelector<HTMLElement>(".opponent-status")!;
  for (const pkg of opponentPackages) {
    const option = document.createElement("option");
    option.value = pkg.id;
    option.textContent = pkg.name;
    select.add(option);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "opponent-card";
    button.dataset.opponentPackage = pkg.id;
    button.append(preview(pkg));
    const title = document.createElement("strong");
    title.textContent = pkg.name;
    const personnel = document.createElement("small");
    personnel.textContent = `${pkg.formation} · ${pkg.players.length} savunmacı`;
    button.append(title, personnel);
    button.onclick = () => choose(pkg.id);
    cards.append(button);
  }
  function commit(next: ScenarioType, message: string) {
    try {
      const plan = planRavens(next);
      api.set(plan.scenario);
      status.textContent = message;
    } catch (err) {
      status.textContent = `Rakip paketi uygulanamadı: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  function choose(id: string) {
    const s = api.get();
    if (!s.ravens) return;
    if (!id) {
      commit(
        removeOpponentPackage(s),
        "Rakip paketi kaldırıldı; önceki savunma yerleşimine dönüldü.",
      );
      return;
    }
    try {
      const next = applyOpponentPackage(s, id);
      next.opponent!.mode = mode.value as "adaptive" | "source";
      commit(
        next,
        `${opponentPackages.find((p) => p.id === id)!.name} yüklendi · 11 savunmacı.`,
      );
    } catch (err) {
      status.textContent = `Rakip paketi yüklenemedi: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  select.onchange = () => choose(select.value);
  clear.onclick = () => choose("");
  alignment.onchange=()=>{const s=api.get();if(s.opponent)commit(changeOpponentAlignment(s,alignment.value as OpponentAlignment),'Savunmanın yerleşim yönü güncellendi.');};
  mirror.onclick=()=>{const s=api.get();if(s.opponent)commit(changeOpponentAlignment(s,s.opponent.mirrored?'source':'mirror'),'Savunma ve hareket çizgileri birlikte aynalandı.');};
  mode.onchange = () => {
    const s = api.get();
    if (!s.ravens || !s.opponent) return;
    const next = structuredClone(s);
    next.opponent!.mode = mode.value as "adaptive" | "source";
    commit(
      next,
      mode.value === "source"
        ? "Kaynak savunma hareketleri seçildi."
        : "Rakip savunmanın Ravens oyununa göre tepkisi seçildi.",
    );
  };
  let previous: ScenarioType | undefined;
  function render() {
    const s = api.get();
    host.hidden = !s.ravens;
    if (previous === s) return;
    previous = s;
    const pkg = s.opponent
      ? opponentPackages.find((p) => p.id === s.opponent!.id)
      : undefined;
    select.value = pkg?.id ?? "";
    clear.disabled = !s.opponent;mirror.disabled=!s.opponent;alignment.disabled=!s.opponent;alignment.value=s.opponent?.alignment??'auto';mirror.setAttribute('aria-pressed',String(!!s.opponent?.mirrored));
    if (s.opponent) mode.value = s.opponent.mode ?? "adaptive";
    for (const b of cards.querySelectorAll<HTMLButtonElement>(
      "[data-opponent-package]",
    ))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.opponentPackage === pkg?.id),
      );
    caption.textContent = !pkg
      ? "Paket seçerek rakibin spread/trips ve down durumuna ait yerleşimini yükleyebilirsin."
      : s.opponent?.mode === "source"
        ? "Seçilen paketin kaynakta çizilmiş defans yolları oynatılır."
        : "Paketin savunmacı rolleri, seçili Ravens oyununun pas/koşu görevlerine göre tepki verir. Coverage eşleşmeleri ve takip eğitim uyarlamasıdır; kaynakta coverage çağrısı belirtilmemiştir.";
    if(pkg)caption.textContent+=' Yerleşim yönü otomatik olarak snap anındaki trips/alıcı tarafına uyarlanır. Kaynak yönü veya Ayna yönü ile elle seçebilirsin; Defansı aynala mevcut yönü ters çevirir. Kart önizlemeleri kaynak yönünü gösterir.';
    status.textContent = pkg
      ? `${pkg.name} · ${pkg.formation} · ${pkg.players.length} savunmacı · ${s.opponent?.alignment==='auto'||!s.opponent?.alignment?'Otomatik yerleşim · ':''}${s.opponent?.mirrored?'Ayna yönü':'Kaynak yönü'}`
      : "Rakip paketi seçili değil.";
  }
  api.subscribe(render);
  render();
}
