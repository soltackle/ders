import {Scenario,position,type ScenarioType} from './model.ts';
export function stageDefense(input:ScenarioType){
 const scenario=structuredClone(input),starts:Record<string,[number,number]>={};let delay=0;
 scenario.actions=scenario.actions.filter(a=>a.source!=='defense');
 for(const [id,e] of Object.entries(scenario.defenseEdits??{})){
  const coverage=e.coverage??'auto';
  const p=scenario.players.find(p=>p.side==='DEF'&&p.id===id);if(!p)continue;
  if(e.preSnap){starts[id]=[...p.at];delay=Math.max(delay,Math.hypot(e.preSnap[0]-p.at[0],e.preSnap[1]-p.at[1])*.75-.85);p.at=[...e.preSnap];}
  if(coverage=== 'rush')p.intent='blitz';else if(coverage=== 'hold')p.intent='hold';else if(coverage!== 'auto')p.intent='auto';
  if(coverage!== 'auto')p.reaction='auto';
 }
 return {scenario,starts,delay};
}
export function finishDefense(input:ScenarioType,starts:Record<string,[number,number]>){
 const s=structuredClone(input),snap=s.steps[0].end,end=Math.max(...s.steps.map(st=>st.end));
 for(const [id,e] of Object.entries(s.defenseEdits??{})){
  const coverage=e.coverage??'auto';
  const p=s.players.find(p=>p.side==='DEF'&&p.id===id);if(!p)continue;
  const destination:[number,number]=[...p.at];
  if(coverage!== 'auto'){
   s.actions=s.actions.filter(a=>a.player!==id);
   const target=s.players.find(p=>p.side==='OFF'&&p.id===e.target);
   const steps=coverage=== 'man'&&target?6:1;
   for(let i=0;i<steps;i++){
    const start=snap+(end-snap)*i/steps,finish=snap+(end-snap)*(i+1)/steps;
    const at=coverage=== 'man'&&target?position(s,target.id,start):coverage=== 'rush'?position(s,s.players.find(p=>p.side==='OFF'&&p.pos==='QB')?.id??'',start):coverage=== 'zone'?(e.zone??destination):destination;
    s.actions.push({source:'defense',player:id,label:`defense-${coverage}`,start,end:finish,to:[...at],gaze:target?.id});
   }
  }
  const note=coverage==='man'?`Adam coverage: ${e.target??'seçilen alıcı'}; görülen rotasını takip et.`:coverage==='zone'?`Bölge coverage: (${(e.zone??destination).join(', ')}); alanını koru.`:coverage==='rush'?'Rush / blitz: kendi koridorundan QB’ye baskı.':coverage==='hold'?'Yerinde kal; çağrılan konumunu koru.':'Otomatik takım savunma çağrısını uygula.';
  for(const step of s.steps)step.notes[id]=note+(starts[id]?` Snap öncesi (${destination.join(', ')}) noktasına hareket et.`:'');
  if(starts[id]){p.at=[...starts[id]];s.actions.push({source:'defense',player:id,label:'defense-presnap',start:.1,end:snap-.05,to:destination});}
 }
 return Scenario.parse(s);
}
