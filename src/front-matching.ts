import type {PlayerType,ScenarioType} from './model.ts';
import {fieldSide} from './model.ts';

// Maximum-cardinality, minimum-cost matching. Extra defenders are considered explicitly;
// selecting only the first five would silently discard a field-side rusher in a six-man line.
export function matchDefenders(blockers:PlayerType[],defenders:PlayerType[]){
 const required=Math.min(blockers.length,defenders.length);
 let bestCost=Infinity,best=new Map<string,string>();
 const targets=[...defenders].sort((a,b)=>a.at[0]-b.at[0]||a.id.localeCompare(b.id));
 function visit(index:number,used:Set<string>,cost:number,chosen:Map<string,string>){
  if(cost>=bestCost)return;
  if(chosen.size===required){bestCost=cost;best=new Map(chosen);return}
  if(index>=targets.length||targets.length-index<required-chosen.size)return;
  const target=targets[index];
  for(const blocker of blockers){
   if(used.has(blocker.id))continue;
   const delta=blocker.at[0]-target.at[0];
   used.add(blocker.id);chosen.set(blocker.id,target.id);
   visit(index+1,used,cost+delta*delta,chosen);
   used.delete(blocker.id);chosen.delete(blocker.id);
  }
  if(targets.length-index>required-chosen.size)visit(index+1,used,cost,chosen);
 }
 visit(0,new Set(),0,new Map());return best;
}

export function boundaryFirstMatch(s:ScenarioType,ol:PlayerType[],line:PlayerType[],roles:Record<string,string>){
 const boundaryMen=ol.filter(p=>p.id===roles.BG||p.id===roles.BT);
 const center=s.players.find(p=>p.side==='OFF'&&p.pos==='C')?.at[0]??0;
 const fieldSign=fieldSide(s)==='right'?1:-1;
 const boundaryDL=line.filter(p=>(p.at[0]-center)*fieldSign<-.05);
 const locked=matchDefenders(boundaryMen,boundaryDL);
 const reserved=new Set(locked.values());
 const remaining=matchDefenders(ol.filter(p=>!locked.has(p.id)),line.filter(p=>!reserved.has(p.id)));
 // A boundary player with a direct opponent is never reconsidered by the field slide.
 return {assignments:new Map([...locked,...remaining]),locked};
}
