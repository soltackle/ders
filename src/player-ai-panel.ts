import type { ScenarioType } from "./model.ts";

export function mountPlayerAI(
  host: HTMLElement,
  api: {
    get: () => ScenarioType;
    set: (s: ScenarioType) => void;
    subscribe: (fn: () => void) => void;
  },
) {
  host.className = "player-ai-panel";
  host.setAttribute("aria-label", "Saha AI oyuncu davranışları");
  host.dataset.playerAiPanel = "";
  host.innerHTML =
    '<style>.player-ai-panel{padding:15px;margin:15px 0;background:#182a20;border:1px solid #526947;border-radius:8px}.player-ai-panel[hidden]{display:none}.player-ai-panel h3{margin:0 0 7px;color:#dceab1;font-size:16px}.player-ai-play{font-size:12px;color:#e6eddb;font-weight:600;overflow-wrap:anywhere}.player-ai-panel p{line-height:1.6}.player-ai-controls{display:flex;flex-wrap:wrap;gap:16px;margin:12px 0}.player-ai-panel label{display:flex;align-items:center;gap:8px;font-size:12px;color:#c8d8ba;cursor:pointer}.player-ai-panel input{accent-color:#cce683}.player-ai-roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.player-ai-roles p{font-size:11px;color:#aec3a4;padding:9px;background:#102017;border-radius:5px;margin:0}.player-ai-status{margin:10px 0 0;color:#c4d5b2;font-size:11px}</style><h3>Saha AI</h3><p class="player-ai-play"></p><div class="player-ai-controls"><label><input id="player-ai-enabled" data-player-ai-enabled type="checkbox">Saha AI etkin</label><label><input id="player-ai-decisions" data-player-ai-decisions type="checkbox">Kararları göster</label></div><div class="player-ai-roles"><p>OL kendi blok görevini ve zone yardımını takip eder.</p><p>Koşucu açık koridoru okur.</p><p>Savunma görüş ve tepkiyle hareket eder.</p><p>QB’nin pas hedefini sen seçersin.</p></div><p class="player-ai-status" data-player-ai-status role="status" aria-live="polite"></p>';
  const enabled = host.querySelector<HTMLInputElement>(
      "[data-player-ai-enabled]",
    )!,
    decisions = host.querySelector<HTMLInputElement>(
      "[data-player-ai-decisions]",
    )!,
    play = host.querySelector<HTMLElement>(".player-ai-play")!,
    status = host.querySelector<HTMLElement>(".player-ai-status")!;
  function update() {
    const current = api.get();
    if (!current.ravens) return;
    const next = structuredClone(current);
    next.playerAI = {
      ...next.playerAI,
      enabled: enabled.checked,
      showDecisions: decisions.checked,
    };
    try {
      api.set(next);
    } catch (err) {
      status.textContent = `Saha AI ayarı kaydedilemedi: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  enabled.onchange = update;
  decisions.onchange = update;
  let previous: ScenarioType | undefined;
  function render() {
    const s = api.get();
    host.hidden = !s.ravens;
    if (previous === s) return;
    previous = s;
    const active = s.playerAI?.enabled ?? true,
      show = s.playerAI?.showDecisions ?? false,
      automatic = s.ravens?.enabled !== false,
      source =
        s.ravens?.blocking === "diagram" || s.opponent?.mode === "source";
    enabled.checked = active;
    decisions.checked = show;
    play.textContent = s.ravens ? `Seçili oyun: ${s.name}` : "";
    host.dataset.playerAiEffective = String(
      !!s.ravens && active && automatic && !source,
    );
    status.textContent = !automatic
      ? "Otomatik oyun kuralları kapalı; Saha AI bu oyunda uygulanmaz. Tercihin kaydedilir."
      : source
        ? "Kaynak çizimi korunur; Saha AI bu modda uygulanmaz. Tercihin diğer Ravens oyunları için kaydedilir."
        : active
          ? `Saha AI etkin. ${show ? "Karar bilgisi açık." : "Karar bilgisi kapalı."} Oynat ile seçili oyunda kullanılır.`
          : "Saha AI kapalı; oyuncular oyun atamalarını izler.";
  }
  api.subscribe(render);
  render();
}
