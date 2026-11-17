import {analysis,fieldSide,position,type ScenarioType} from './model';
export type Finding={level:'info'|'warning',text:string};
export function inspectScenario(s:ScenarioType){
 const base=analysis(s), ol=s.players.filter(p=>['LT','LG','C','RG','RT'].includes(p.pos));
 const defenders=s.players.filter(p=>p.side==='DEF').map(p=>{
  const nearest=[...ol].sort((a,b)=>Math.abs(a.at[0]-p.at[0])-Math.abs(b.at[0]-p.at[0]))[0];
  const delta=nearest?p.at[0]-nearest.at[0]:0,dist=Math.abs(delta);
  let technique='belirsiz';if(nearest&&p.pos==='DL'){const baseTech=nearest.pos==='C'?0:nearest.pos.endsWith('G')?2:4;technique=dist<.22?`${baseTech}`:dist<.6?`${baseTech}${(delta*nearest.at[0]<0)?'i':''}`:`${baseTech+1}`}
  const action=s.actions.find(a=>a.player===p.id);return {id:p.id,position:p.pos,technique,nearestOL:nearest?.id??null,gap:action?.gap??null,action:action?.label??null,alignment:p.at};
 });
 const covered=ol.map(p=>({player:p.id,covered:defenders.some(d=>d.position==='DL'&&d.nearestOL===p.id&&Math.abs(d.alignment[0]-p.at[0])<.6)}));
 const findings:Finding[]=[];
 for(const a of s.actions.filter(a=>a.label.includes('pull'))){const target=s.players.find(p=>p.id===a.target);if(!target)findings.push({level:'warning',text:`${a.player}: pull hedefi tanımlı değil.`});if(a.kind==='trap'&&a.target&&s.actions.some(x=>x.player!==a.player&&x.target===a.target))findings.push({level:'warning',text:`${a.target}: trap hedefi başka bir oyuncuya da atanmış; bloklanmadan bırakılmasını kontrol edin.`});findings.push({level:'info',text:`${a.player}: pull ile boşalan bölgenin sorumlusu editörde doğrulanmalı.`})}
 for(let t=0;t<=Math.max(...s.steps.map(x=>x.end));t+=.2){for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++){const p=s.players[i],q=s.players[j];if(p.side!==q.side)continue;const x=position(s,p.id,t),y=position(s,q.id,t);if(Math.hypot(x[0]-y[0],x[1]-y[1])<.35&&!findings.some(f=>f.text.includes(`${p.id} / ${q.id}`)))findings.push({level:'warning',text:`${p.id} / ${q.id}: yaklaşık ${t.toFixed(1)} sn anında olası çakışma.`})}}
 const blitzers=s.actions.filter(a=>/blitz/i.test(a.label)).map(a=>({player:a.player,gap:a.gap??'belirsiz',responsibility:s.blitz==='boundary'||s.blitz==='middle'?'RB veya QB':s.actions.find(x=>x.target===a.player)?.player??'atanmadı'}));
 for(const b of blitzers)if(b.responsibility==='atanmadı')findings.push({level:'warning',text:`${b.player}: blitz için açık bir sorumluluk bulunamadı.`});
 return {...base,field:fieldSide(s),defenders,covered,blitzers,counts:{offense:ol.length,defense:s.players.filter(p=>p.side==='DEF').length,rushers:s.actions.filter(a=>/blitz|rush|penetrate|attack-gap/i.test(a.label)).length},findings,limitations:['Teknikler yaklaşık konumdan tahmin edilir; koçun teknik tanımlarıyla doğrulanmalıdır.','Çakışma kontrolü yaklaşık örneklemeye dayanır.','Atanmamış taktik kuralları otomatik uydurulmaz.']};
}
