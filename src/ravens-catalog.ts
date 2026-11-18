import source from "./data/ravens-most.json" with { type: "json" };

/** Fixed MOST order: numbers refer to the imported 35 cards, never a filtered list. */
export const RAVENS_PROFILE_REVISION = 2;
export type RavensKind =
  | "pass"
  | "zone"
  | "rollout"
  | "speed-option"
  | "gt-counter"
  | "dart"
  | "trap3"
  | "screen"
  | "ct-counter"
  | "source-special"
  | "zone-lead"
  | "pass-wrap"
  | "trap5"
  | "tushpush";
export type RavensDirection = "field" | "boundary" | "drawing";
export type CatalogBlocking =
  "pass" | "inside" | "outside" | "team" | "diagram";
export type RavensProfile = {
  number: number;
  id: string;
  name: string;
  kind: RavensKind;
  label: string;
  direction: RavensDirection;
  defaultBlocking: CatalogBlocking;
  confirmed: boolean;
  absolutePull?: "right";
  note: string;
};
const pass = new Set([1, 2, 3, 4, 5, 7, 15, 16, 17, 18, 22, 23, 25, 33]);
const zone = new Set([6, 8, 20, 24, 27]);
const special: Record<number, Omit<RavensProfile, "number" | "id" | "name">> = {
  9: {
    kind: "source-special",
    label: "Kaynak çizimi (korundu)",
    direction: "drawing",
    defaultBlocking: "diagram",
    confirmed: true,
    note: "9 numara kullanıcının seçimiyle kaynak çizimi olarak korunur. Kaynak adı B2-MAZE-GTCOUNTER-; özel takım counter kuralı varsayılmaz.",
  },
  10: {
    kind: "rollout",
    label: "Field rollout · slide koruma",
    direction: "field",
    defaultBlocking: "team",
    confirmed: true,
    note: "QB field tarafına rollout yapar. Pas koruması içinde field tarafı slide protection uygular; boundary sorumlulukları korunur.",
  },
  11: {
    kind: "speed-option",
    label: "Speed option",
    direction: "field",
    defaultBlocking: "team",
    confirmed: true,
    note: "Speed option. Kaynak QB/RB yolları ve option ilişkisi birlikte oynatılır; top taşıyıcı ve pitch kararı senaryoda açıkça gösterilir.",
  },
  12: {
    kind: "gt-counter",
    label: "GT counter",
    direction: "drawing",
    defaultBlocking: "team",
    confirmed: true,
    note: "GT counter. Pull yapan guard ve tackle ile çıkış yönü kaynak OL çizgilerinden alınır.",
  },
  13: {
    kind: "gt-counter",
    label: "GT counter",
    direction: "drawing",
    defaultBlocking: "team",
    confirmed: true,
    note: "GT counter. Guard/tackle pull yolu ve diğer OL blokları kaynak çizimine göre uygulanır.",
  },
  14: {
    kind: "dart",
    label: "Dart · boundary tackle sağ pull",
    direction: "boundary",
    absolutePull: "right",
    defaultBlocking: "team",
    confirmed: true,
    note: "Boundary tackle sağa pull yapar: Dart. Boundary rolü ile sağ pull yönü ayrı değerlendirilir; kaynak OL yolları korunur.",
  },
  19: {
    kind: "trap3",
    label: "3-tech trap",
    direction: "drawing",
    defaultBlocking: "team",
    confirmed: true,
    note: "3 teknik savunmacıya trap. Trapper ve giriş yolu kaynak OL çizgisinden, hedef güncel savunma tekniğinden belirlenir.",
  },
  21: {
    kind: "screen",
    label: "Field screen pas",
    direction: "field",
    defaultBlocking: "team",
    confirmed: true,
    note: "Screen pas field tarafına oynanır. OL’nin çizimdeki bekleme/çıkış ve eskort yolları dikkate alınır.",
  },
  26: {
    kind: "trap3",
    label: "3-tech trap",
    direction: "drawing",
    defaultBlocking: "team",
    confirmed: true,
    note: "3 teknik trap. Kaynak OL yolu izlenir; güncel savunmada gerçek 3-tech hedefi aranır.",
  },
  28: {
    kind: "ct-counter",
    label: "Boundary CT counter",
    direction: "boundary",
    defaultBlocking: "team",
    confirmed: true,
    note: "Boundary yönüne CT counter. Center ve tackle pull yapar; kaynak çizim blok sırasını ve çıkış yolunu belirler.",
  },
  29: {
    kind: "source-special",
    label: "Kaynak çizimine özel oyun",
    direction: "drawing",
    defaultBlocking: "team",
    confirmed: true,
    note: "Takımın özel oyunu. Genel pas veya zone şemasıyla değiştirilmez; kaynak oyuncu ve OL yollarına göre uyarlanır.",
  },
  30: {
    kind: "gt-counter",
    label: "Boundary GT counter",
    direction: "boundary",
    defaultBlocking: "team",
    confirmed: true,
    note: "Boundary tarafına GT counter. Guard ve tackle pull yolları kaynak çiziminden uyarlanır.",
  },
  31: {
    kind: "zone-lead",
    label: "Field zone · guard lead",
    direction: "field",
    defaultBlocking: "team",
    confirmed: true,
    note: "Field yönüne zone/right. Field guard tackle’ın arkasından geçerek lead blok için çıkar; diğer OL covered/uncovered zone kuralını sürdürür.",
  },
  32: {
    kind: "pass-wrap",
    label: "Pas koruması · boundary guard wrap",
    direction: "boundary",
    defaultBlocking: "team",
    confirmed: true,
    note: "Pas koruması: boundary guard tackle’ın arkasından dolanıp tackle’ın adamını alır. Boşalan iç sorumluluk ve diğer adam paylaşımı birlikte gösterilir.",
  },
  34: {
    kind: "trap5",
    label: "Field 5-tech trap",
    direction: "field",
    defaultBlocking: "team",
    confirmed: true,
    note: "Field tarafındaki 5 teknik savunmacıya trap. Trapper kaynak OL yolundan seçilir; hedef field 5-tech olarak aranır.",
  },
  35: {
    kind: "tushpush",
    label: "Tush push",
    direction: "drawing",
    defaultBlocking: "team",
    confirmed: true,
    note: "Tush push. QB merkezden ilerler; OL alçak ve ileri drive yapar, arka alan destekçileri QB arkasında itiş düzenine girer.",
  },
};
export const ravensCatalog: RavensProfile[] = source.map((p, index) => {
  const number = index + 1;
  const profile = pass.has(number)
    ? {
        kind: "pass" as const,
        label: "Takım pas koruması",
        direction: "drawing" as const,
        defaultBlocking: "pass" as const,
        confirmed: true,
        note: "Pas oyunu. Takım ALERT / boundary man / big-on-big paylaşımı uygulanır; kaynak alıcı rotaları korunur.",
      }
    : zone.has(number)
      ? {
          kind: "zone" as const,
          label: number === 6 ? "Field outside zone" : "Field zone",
          direction: "field" as const,
          defaultBlocking: (number === 6
            ? "outside"
            : "inside") as CatalogBlocking,
          confirmed: true,
          note: "Field yönüne zone. Covered OL kendi adamını tutar; uncovered yalnız zone yönünde gerekiyorsa yardım eder ve sonra ikinci seviyeye çıkar. Inside/outside varyantı seçilebilir.",
        }
      : special[number];
  if (!profile) throw Error(`Ravens ${number} sınıflandırması eksik`);
  return { number, id: p.id, name: p.name, ...profile };
});
export function ravensProfile(idOrNumber: string | number): RavensProfile {
  const profile =
    typeof idOrNumber === "number"
      ? ravensCatalog[idOrNumber - 1]
      : ravensCatalog.find((p) => p.id === idOrNumber);
  if (!profile) throw Error(`Ravens oyun profili bulunamadı: ${idOrNumber}`);
  return profile;
}
export function ravensMatchesGroup(profile: RavensProfile, group: string) {
  if (group === "all") return true;
  if (group === "pass")
    return ["pass", "rollout", "pass-wrap"].includes(profile.kind);
  if (group === "zone") return ["zone", "zone-lead"].includes(profile.kind);
  if (group === "counter")
    return ["gt-counter", "ct-counter"].includes(profile.kind);
  if (group === "trap") return ["trap3", "trap5"].includes(profile.kind);
  if (group === "option") return profile.kind === "speed-option";
  if (group === "screen") return profile.kind === "screen";
  if (group === "special")
    return ["dart", "source-special", "tushpush"].includes(profile.kind);
  if (group === "pistol" || group === "bunch")
    return profile.name.toLocaleLowerCase("tr").includes(group);
  return false;
}
