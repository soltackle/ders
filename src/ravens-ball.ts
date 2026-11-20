import {
  isRavensPass,
  passState,
  type PositionAccessor,
} from "./ravens-pass.ts";
import { position, type ScenarioType } from "./model.ts";
export const runExchange=(s:ScenarioType)=>s.ravens?.exchange??(/MAZE/i.test(s.name)?'toss':'handoff');
/** Fixed backward-flight window from the offense's authored call. */
export function tossWindow(s:ScenarioType){
 if(isRavensPass(s)||s.zone?.enabled||runExchange(s)!=='toss'||!s.ravens?.carrier)return null;
 const qb=s.players.find(p=>p.side==='OFF'&&p.pos==='QB'),carrier=s.ravens.carrier;
 if(!qb||qb.id===carrier)return null;
 const catchAt=s.ravens.transferAt??s.steps[0].end,releaseAt=Math.max(s.steps[0].end,catchAt-.55);
 const from=position(s,qb.id,releaseAt),to=position(s,carrier,catchAt);
 return catchAt>releaseAt&&to[1]<=from[1]+.05?{qb:qb.id,carrier,releaseAt,catchAt,to}:null;
}
/** Explicit training branch; never guesses a pitch from a defender's movement. */
export function ravensBall(
  s: ScenarioType,
  t: number,
  get: PositionAccessor = position,
) {
  if (isRavensPass(s)) return passState(s, t, get);
  if (
    s.zone?.enabled ||
    !s.ravens ||
    s.ravens.blocking !== "team" ||
    !s.ravens.carrier
  )
    return null;
  const snap = s.steps[0].end,
    qb = s.players.find((p) => p.side === "OFF" && p.pos === "QB"),
    carrier = s.players.find(
      (p) => p.side === "OFF" && p.id === s.ravens!.carrier,
    );
  if (!qb || !carrier || t < snap) return null;
  const at = s.ravens.transferAt ?? snap,
    blend =
      carrier.id === qb.id
        ? 1
        : Math.max(0, Math.min(1, (t - (at - 0.35)) / 0.35));
  const toss=tossWindow(s);
  if(toss&&t<at){
    if(t<toss.releaseAt){const p=get(s,qb.id,t);return {carrier:qb.id,blend:1,at:[p[0],.84,p[1]+.25] as [number,number,number]};}
    const start=get(s,qb.id,toss.releaseAt),end=toss.to,u=Math.min(1,(t-toss.releaseAt)/(at-toss.releaseAt));
    return {carrier:'',blend:u,phase:'flight' as const,at:[start[0]+(end[0]-start[0])*u,.85+Math.sin(Math.PI*u)*.65,start[1]+(end[1]-start[1])*u] as [number,number,number]};
  }
  const from = get(s, qb.id, t),
    to = get(s, carrier.id, t);
  return {
    carrier: blend === 1 ? carrier.id : qb.id,
    blend,
    at: [
      from[0] + (to[0] - from[0]) * blend,
      0.83 + Math.sin(blend * Math.PI) * 0.3,
      from[1] + (to[1] - from[1]) * blend + 0.25,
    ] as [number, number, number],
  };
}
