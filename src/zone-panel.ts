import type { ScenarioType } from "./model.ts";
import { zoneDefaults } from "./zone.ts";
export function mountZonePanel(
  host: HTMLElement,
  api: {
    get: () => ScenarioType;
    set: (s: ScenarioType) => void;
    subscribe: (f: () => void) => void;
  },
) {
  host.className = "zone-panel";
  host.innerHTML =
    '<strong>FIELD ZONE · KOŞU AYARLARI</strong><p>Covered kendi adamını alır. Uncovered, zone yönünde gerekiyorsa yardım eder ve ikinci seviyeye çıkar. RB okuması düzenlenebilir.</p><div class="zone-controls"></div><details><summary>Oyuncu bazında savunma reaksiyonu</summary><div class="zone-reactions"></div></details><p class="zone-status" role="status"></p>';
  const controls = host.querySelector<HTMLElement>(".zone-controls")!,
    rows = host.querySelector<HTMLElement>(".zone-reactions")!,
    status = host.querySelector<HTMLElement>(".zone-status")!;
  let previous: ScenarioType | undefined;
  const options = {
    variant: [
      ["inside", "Inside zone"],
      ["outside", "Outside / stretch"],
    ],
    dlReaction: [
      ["base", "Düz / base"],
      ["slant-field", "Field slant"],
      ["slant-boundary", "Boundary slant"],
      ["pinch", "Pinch / içe"],
      ["widen", "Widen / dışa"],
      ["twist", "Twist / stunt"],
    ],
    lbReaction: [
      ["fit", "Gap fit"],
      ["flow", "Field flow"],
      ["scrape", "Scrape"],
      ["sail", "Sail / geri açıl"],
      ["bait", "Bait / beklet"],
      ["hold", "Yerinde kal"],
    ],
    rbRead: [
      ["auto", "Geometrik koridor önerisi"],
      ["bang", "Bang / temel koridor"],
      ["bend", "Bend / içeri kes"],
      ["bounce", "Bounce / dışarı açıl"],
    ],
  };
  function select(
    title: string,
    items: string[][],
    value: string,
    change: (v: string) => void,
  ) {
    const label = document.createElement("label");
    label.append(title);
    const s = document.createElement("select");
    s.setAttribute("aria-label", title);
    for (const [value, text] of items)
      s.add(
        Object.assign(document.createElement("option"), {
          value,
          textContent: text,
        }),
      );
    s.value = value;
    s.onchange = () => change(s.value);
    label.append(s);
    return label;
  }
  function apply(s: ScenarioType) {
    s.actions = s.actions.filter((a) => !a.source || a.source === "manual");
    s.steps = [
      {
        title: "Field zone ayarı",
        start: 0,
        end: 7.2,
        description: "Yeni ayarlarla Oynat’a bas.",
        notes: {},
        focus: [],
      },
    ];
    api.set(s);
    status.textContent =
      "Zone ayarı kaydedildi; Oynat ile yeni hareketler hesaplanır.";
  }
  function render() {
    const s = api.get();
    host.hidden = !s.zone;
    if (previous === s) return;
    previous = s;
    if (!s.zone) return;
    const cfg = { ...zoneDefaults, ...s.zone };
    controls.replaceChildren();
    for (const key of [
      "variant",
      "dlReaction",
      "lbReaction",
      "rbRead",
    ] as const)
      controls.append(
        select(
          {
            variant: "Zone türü",
            dlReaction: "DL reaksiyonu",
            lbReaction: "LB reaksiyonu",
            rbRead: "RB okuması",
          }[key],
          options[key],
          cfg[key],
          (value) => {
            const next = structuredClone(api.get());
            next.zone = { ...cfg, [key]: value };
            apply(next);
          },
        ),
      );
    rows.replaceChildren();
    for (const p of s.players.filter((p) => p.side === "DEF")) {
      const choices = p.pos === "DL" ? options.dlReaction : options.lbReaction;
      rows.append(
        select(
          `${p.id} reaksiyonu`,
          [["auto", "Genel ayarı kullan"], ...choices],
          p.reaction ?? "auto",
          (value) => {
            const next = structuredClone(api.get());
            next.players.find((q) => q.id === p.id)!.reaction =
              value as typeof p.reaction;
            apply(next);
          },
        ),
      );
    }
  }
  api.subscribe(render);
  render();
}
