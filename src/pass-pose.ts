import {position,samplePath,type ScenarioType,type ActionType} from './model.ts';
export function isPassBlock(s:ScenarioType,id:string,a?:ActionType){return s.players.some(p=>p.id===id&&p.side==='OFF')&&!!a&&['pass-set','slide','punch','combo','pickup','pass-off'].includes(a.label)}
// Locomotion and facing are independent: a blocker retreating in a pass set still faces the rush.
export function passBlockPose(s:ScenarioType,id:string,t:number){const p=s.players.find(p=>p.id===id)!,at=position(s,id,t);const action=s.actions.find(a=>a.player===id&&t>=a.start&&t<=a.end);if(!isPassBlock(s,id,action))return null;
 const opponent=action?.target?position(s,action.target,t):[at[0],at[1]+1];const bearing=Math.atan2(opponent[0]-at[0],Math.max(.15,opponent[1]-at[1]));const heading=Math.max(-.6,Math.min(.6,bearing*.65));
 const moving=action&&Math.hypot(action.to[0]-position(s,id,action.start)[0],action.to[1]-position(s,id,action.start)[1])>.03;
 const previous=s.actions.filter(a=>a.player===id&&a.end<=(action?.start??0)&&['pass-set','slide','pickup'].includes(a.label)).sort((a,b)=>b.end-a.end)[0];const track=moving?action:previous;
 const feet=([-1,1] as const).map((sign,index)=>{let footAt:[number,number]=at,lift=0;if(track){const start=position(s,id,track.start);const distance=Math.hypot(track.to[0]-start[0],track.to[1]-start[1]);const steps=Math.max(2,Math.ceil(distance/.2));const u=Math.max(0,Math.min(1,(t-track.start)/(track.end-track.start)));const phase=Math.min(steps-1,Math.floor(u*steps)),f=u>=1?1:u*steps-phase;const kickIndex=p.at[0]<0?0:1;const swing=(phase+kickIndex)%2===index;
 let q:number;if(swing){const from=Math.max(0,(phase-1)/steps),to=(phase+1)/steps;const smooth=f*f*(3-2*f);const a=samplePath(start,track,from),b=samplePath(start,track,to);footAt=[a[0]+(b[0]-a[0])*smooth,a[1]+(b[1]-a[1])*smooth];lift=Math.sin(Math.PI*f)*.065}else {let completed=phase-1;if((completed+kickIndex)%2!==index)completed--;q=Math.max(0,(completed+1)/steps);footAt=samplePath(start,track,q)}}
 const outside=(p.at[0]<0?sign===-1:sign===1);const dx=footAt[0]+sign*.29-at[0],dz=footAt[1]+(outside?-.19:.04)-at[1];return {x:dx*Math.cos(heading)-dz*Math.sin(heading),z:dx*Math.sin(heading)+dz*Math.cos(heading),y:.065+lift}});
 const contact=!!action&&['punch','combo','pickup'].includes(action.label)&&Math.hypot(opponent[0]-at[0],opponent[1]-at[1])<1.35;const phase=action?.phases?.find(p=>t>=p.start&&t<=p.end)?.name??(contact?'anchor':'kick-slide');
 return {heading,feet,contact,phase,hip:.61,chest:.93,head:1.27,lean:contact?.14:.07};
}
