import data from "./data/opponent-kocaeli.json" with { type: "json" };
import {
  Scenario,
  pathLength,
  type ScenarioType,
  type ActionType,
  type PlayerType,
} from "./model.ts";
import { travelDuration } from "./timing.ts";
export type OpponentPackage = {
  id: string;
  name: string;
  formation: string;
  anchor: { x: number; y: number };
  scale: number;
  players: {
    id: string;
    label: string;
    pos: string;
    at: [number, number];
    paths: { d: string; points: [number, number][] }[];
  }[];
};
export const opponentPackages = data as OpponentPackage[];
export type OpponentAlignment = 'auto' | 'source' | 'mirror';
export const opponentSign = (s: ScenarioType) => s.opponent?.mirrored ? -1 : 1;
type FormationPoint = {id:string; at:[number,number]};
/** Read only the offense's declared snap alignment, never a future route. */
export function opponentFormation(s:ScenarioType, atSnap?:FormationPoint[]){
 const center=s.players.find(p=>p.side==='OFF'&&p.pos==='C')?.at[0]??0;
 const points=new Map(atSnap?.map(p=>[p.id,p.at]));
 const eligible=s.players.filter(p=>p.side==='OFF'&&!['LT','LG','C','RG','RT','QB'].includes(p.pos));
 const count=(side:number)=>eligible.filter(p=>{const at=points.get(p.id)??p.at;return at[1]>=-1.6&&(at[0]-center)*side>1.5;}).length;
 const left=count(-1),right=count(1);
 return {left,right,strong:Math.max(left,right)>=3&&left!==right?(right>left?1:-1):0};
}
export function opponentWantsMirror(s:ScenarioType,atSnap?:FormationPoint[]){
 if(!s.opponent)return false;
 const alignment=s.opponent.alignment??'auto';
 if(alignment!=='auto')return alignment==='mirror';
 const pack=opponentPackages.find(p=>p.id===s.opponent!.id),strong=opponentFormation(s,atSnap).strong;
 if(!pack||!strong)return false;
 const db=pack.players.filter(p=>['CB','SS','FS','DB','S'].includes(p.pos)&&Math.abs(p.at[0])>1.5);
 const left=db.filter(p=>p.at[0]<0).length,right=db.filter(p=>p.at[0]>0).length;
 const support=left!==right?(right>left?1:-1):Math.sign(pack.players.find(p=>p.pos==='SS')?.at[0]??0);
 return !!support&&support!==strong;
}
/** Reflect the current defense as a unit, including coach edits, without reloading it. */
export function alignOpponent(input:ScenarioType,atSnap?:FormationPoint[]){
 if(!input.opponent)return input;
 const mirrored=opponentWantsMirror(input,atSnap);
 if(mirrored===(input.opponent.mirrored??false))return input;
 const s=structuredClone(input),center=s.players.find(p=>p.side==='OFF'&&p.pos==='C')?.at[0]??0;
 const flip=([x,z]:[number,number]):[number,number]=>[2*center-x,z];
 const ids=new Set(s.players.filter(p=>p.side==='DEF').map(p=>p.id));
 for(const p of s.players)if(ids.has(p.id))p.at=flip(p.at);
 for(const a of s.actions)if(ids.has(a.player)){a.to=flip(a.to);a.path=a.path?.map(flip);if(a.dir)a.dir=a.dir==='L'?'R':'L';if(a.gap)a.gap=a.gap.replace(/^[LR]/,d=>d==='L'?'R':'L');}
 for(const [id,e] of Object.entries(s.defenseEdits??{}))if(ids.has(id)){if(e.zone)e.zone=flip(e.zone);if(e.preSnap)e.preSnap=flip(e.preSnap);}
 s.opponent!.mirrored=mirrored;
 return s;
}
export function changeOpponentAlignment(input:ScenarioType,alignment:OpponentAlignment){
 const s=structuredClone(input);if(s.opponent)s.opponent.alignment=alignment;return s;
}
export function opponentCue(p: OpponentPackage["players"][number]) {
  const end = p.paths.at(-1)?.points.at(-1),
    z = end ? p.at[1] + end[1] : p.at[1];
  if (p.pos === "DL") return "rush";
  if (z < 0) return "blitz";
  if (p.pos === "LB" && z <= 1.1 && end && end[1] < -0.5) return "pressure";
  if (p.pos === "LB") return "fit";
  return "coverage";
}
function metadata(p: OpponentPackage["players"][number]): PlayerType {
  return {
    id: p.id,
    pos: p.pos,
    side: "DEF",
    at: [...p.at],
    stance: p.pos === "DL" ? "3pt" : "2pt",
    intent: ["blitz", "pressure"].includes(opponentCue(p)) ? "blitz" : "auto",
  };
}
export function applyOpponentPackage(input: ScenarioType, id: string) {
  const pack = opponentPackages.find((p) => p.id === id);
  if (!pack) throw Error("Rakip defans paketi bulunamadı");
  const s = structuredClone(input),
    backup = s.opponent?.backup ?? {
      players: structuredClone(s.players.filter((p) => p.side === "DEF")),
      actions: structuredClone(
        s.actions.filter(
          (a) =>
            s.players.find((p) => p.id === a.player)?.side === "DEF" &&
            (!a.source || a.source === "manual"),
        ),
      ),
    };
  const center =
    s.players.find((p) => p.side === "OFF" && p.pos === "C")?.at[0] ?? 0;
  // New package players start in source coordinates. Bring retained coach
  // landmarks back to that frame before applying the requested orientation.
  if(s.opponent?.mirrored){
    const ids=new Set(s.players.filter(p=>p.side==='DEF').map(p=>p.id));
    for(const [id,e] of Object.entries(s.defenseEdits??{}))if(ids.has(id)){
      if(e.zone)e.zone=[2*center-e.zone[0],e.zone[1]];
      if(e.preSnap)e.preSnap=[2*center-e.preSnap[0],e.preSnap[1]];
    }
  }
  s.players = s.players.filter((p) => p.side === "OFF");
  s.players.push(
    ...pack.players.map((p) => ({
      ...metadata(p),
      at: [center + p.at[0], p.at[1]] as [number, number],
    })),
  );
  s.opponent = { id, mode: input.opponent?.mode ?? "adaptive", alignment:input.opponent?.alignment??"auto", mirrored:false, backup };
  s.actions = [];
  s.rules = [];
  s.steps = [
    {
      title: "Rakip defans paketi",
      start: 0,
      end: 8,
      description: `Kocaeli · ${pack.name}. 11 kaynak savunmacı; takım blok kuralları bu dizilişe karşı hesaplanır.`,
      notes: {},
      focus: [],
    },
  ];
  return alignOpponent(Scenario.parse(s));
}
export function removeOpponentPackage(input: ScenarioType) {
  const s = structuredClone(input);
  if (!s.opponent) return s;
  const original = s.opponent.backup;
  s.players = s.players.filter((p) => p.side === "OFF");
  if (original) s.players.push(...structuredClone(original.players));
  const ids = new Set(s.players.map((p) => p.id));
  s.actions = (original?.actions ? structuredClone(original.actions) : [])
    .filter((a) => ids.has(a.player))
    .map((a) => {
      for (const key of ["target", "engage", "gaze"] as const)
        if (a[key] && !ids.has(a[key]!)) a[key] = undefined;
      return a;
    });
  s.opponent = undefined;
  s.rules = [];
  s.steps = [
    {
      title: "Çalışma savunmasına dönüş",
      start: 0,
      end: 8,
      description:
        "Rakip paketi kapatıldı; önceki çalışma savunması geri yüklendi.",
      notes: {},
      focus: [],
    },
  ];
  return Scenario.parse(s);
}
/** Source opening tracks are temporarily authored for the OL planner, then restored to opponent ownership. */
export function prepareOpponent(input: ScenarioType) {
  if (!input.opponent) return input;
  const pack = opponentPackages.find((p) => p.id === input.opponent!.id);
  if (!pack) throw Error("Bilinmeyen rakip paketi");
  const s = structuredClone(input);
  // An explicitly saved manual action can retain an old generated kind in JSON.
  // Ownership, rather than the label/kind, decides whether the coach's path survives.
  for (const a of s.actions)
    if ((!a.source || a.source === "manual") && a.kind?.startsWith("opponent-"))
      a.kind = undefined;
  const manual = new Set(
      s.actions
        .filter(
          (a) =>
            (!a.source || a.source === "manual") &&
            s.players.some((p) => p.id === a.player && p.side === "DEF"),
        )
        .map((a) => a.player),
    );
  s.actions = s.actions.filter(
    (a) => a.source !== "opponent",
  );
  const direction=opponentSign(s);
  for (const original of pack.players) {
    const p = s.players.find((p) => p.side === "DEF" && p.id === original.id);
    if (!p || manual.has(p.id)) continue;
    const points = original.paths
      .flatMap((path) => path.points)
      .filter(
        (v, i, all) =>
          i === 0 ||
          Math.hypot(v[0] - all[i - 1][0], v[1] - all[i - 1][1]) > 0.001,
      );
    const absolute = points
        .slice(1)
        .map(([x, z]) => [p.at[0] + direction*x, p.at[1] + z] as [number, number]),
      kind =
        p.pos === "DL" || p.intent === "blitz"
          ? "rush"
          : p.pos === "LB"
            ? "fit"
            : "coverage";
    const a: ActionType = {
      source: "manual",
      interpolation: "polyline",
      player: p.id,
      label: `opponent-${kind}`,
      kind: `opponent-${kind}`,
      start: 1.1,
      end: 3.1,
      to: absolute.at(-1) ?? [...p.at],
      path: absolute.slice(0, -1),
    };
    a.end =
      a.start +
      Math.max(
        1.8,
        travelDuration(pathLength(p.at, a), p.pos === "DL" ? 2 : 3),
      );
    s.actions.push(a);
  }
  return s;
}
export function restoreOpponentOwnership(s: ScenarioType) {
  for (const a of s.actions)
    if (a.kind?.startsWith("opponent-")) a.source = "opponent";
  return s;
}

/** Adopt the entire generated track when a coach edits one of its path segments. */
export function adoptOpponentPath(s: ScenarioType, player: string) {
  for (const a of s.actions)
    if (a.player === player && a.source === "opponent") {
      a.source = "manual";
      if (a.kind?.startsWith("opponent-")) a.kind = undefined;
    }
}
