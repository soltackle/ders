import {test} from 'node:test';
import assert from 'node:assert/strict';
import {opponentPackages,applyOpponentPackage,alignOpponent,changeOpponentAlignment,opponentFormation} from '../src/opponent.ts';
import {ravensScenario,ravensPlays,planRavens} from '../src/ravens.ts';
import {position,Scenario} from '../src/model.ts';
import {playFrame} from '../src/play-dynamics.ts';
import {JSDOM} from 'jsdom';
import {mountOpponent} from '../src/opponent-panel.ts';
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const comparable=(s:unknown)=>JSON.parse(JSON.stringify(s,(_key,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v));
const template=()=>ravensScenario(ravensPlays[32].id);
test('automatic alignment puts the package secondary support on the actual trips side, and does not mirror balanced sets',()=>{
 for(const pkg of opponentPackages)for(const side of [-1,1]){
  const input=template();if(side<0)for(const p of input.players.filter(p=>p.side==='OFF'))p.at[0]*=-1;
  const s=planRavens(applyOpponentPackage(input,pkg.id)).scenario;
  assert.equal(opponentFormation(s).strong,side);
  const db=s.players.filter(p=>p.side==='DEF'&&['CB','SS','FS'].includes(p.pos)&&Math.abs(p.at[0])>1.5);
  assert.ok(db.filter(p=>p.at[0]*side>0).length>db.filter(p=>p.at[0]*side<0).length);
  assert.equal(s.opponent!.alignment,'auto');
  assert.deepEqual(comparable(planRavens(Scenario.parse(JSON.parse(JSON.stringify(s)))).scenario),comparable(s));
 }
 const balanced=ravensScenario(ravensPlays[21].id);
 for(const pkg of opponentPackages)assert.equal(planRavens(applyOpponentPackage(balanced,pkg.id)).scenario.opponent!.mirrored,false);
});
test('source and mirror reflect both source movement and initial positions around a shifted center without changing offense',()=>{
 for(const pkg of opponentPackages){
  const input=template();for(const p of input.players.filter(p=>p.side==='OFF'))p.at[0]+=3.7;
  const base=applyOpponentPackage(input,pkg.id);base.opponent!.mode='source';
  const source=planRavens(changeOpponentAlignment(base,'source')).scenario,mirror=planRavens(changeOpponentAlignment(source,'mirror')).scenario;
  assert.deepEqual(mirror.players.filter(p=>p.side==='OFF'),source.players.filter(p=>p.side==='OFF'));
  const routes=(s:typeof source)=>s.actions.filter(a=>a.source==='ravens').map(({player,start,end,to,path})=>({player,start,end,to,path}));
  assert.deepEqual(routes(mirror),routes(source));
  assert.deepEqual(mirror.opponent!.backup,source.opponent!.backup);
  for(const p of source.players.filter(p=>p.side==='DEF'))for(const t of [0,source.steps[0].end+.5,source.steps.at(-1)!.end]){
   const a=position(source,p.id,t),b=position(mirror,p.id,t);close(a[0]+b[0],7.4);close(a[1],b[1]);
  }
  assert.deepEqual(comparable(planRavens(changeOpponentAlignment(mirror,'source')).scenario),comparable(source));
 }
});
test('mirror mode keeps coach paths, coverage targets and presnap destinations together',()=>{
 const s=planRavens(changeOpponentAlignment(applyOpponentPackage(template(),opponentPackages[1].id),'source')).scenario;
 const id=s.players.find(p=>p.side==='DEF'&&p.pos==='CB')!.id;
 s.actions=s.actions.filter(a=>a.player!==id);s.actions.push({source:'manual',player:id,label:'coach path',start:1.1,end:5,to:[5,7],path:[[4,5]],dir:'R',gap:'R-B'});
 s.defenseEdits={[id]:{coverage:'man',target:'X',zone:[6,8],preSnap:[7,4]}};
 const mirrored=alignOpponent(changeOpponentAlignment(s,'mirror'));
 const path=mirrored.actions.find(a=>a.player===id)!;
 assert.deepEqual(path.to,[-5,7]);assert.deepEqual(path.path,[[-4,5]]);assert.equal(path.dir,'L');assert.equal(path.gap,'L-B');
 assert.deepEqual(mirrored.defenseEdits![id],{coverage:'man',target:'X',zone:[-6,8],preSnap:[-7,4]});
 assert.deepEqual(comparable(alignOpponent(changeOpponentAlignment(mirrored,'source'))),comparable(s));
});
test('mirrored package rush landmarks point along the mirrored source lane in live AI',()=>{
 for(const direction of ['source','mirror'] as const){
  const s=planRavens(changeOpponentAlignment(applyOpponentPackage(template(),opponentPackages[1].id),direction)).scenario;
  const snap=s.steps[0].end,frame=playFrame(s,snap+.45);
  for(const original of opponentPackages[1].players.filter(p=>p.pos==='DL')){
   const current=frame.positions[original.id],aim=frame.decisions![original.id].aim,delta=original.paths.at(-1)!.points.at(-1)!,sign=direction==='mirror'?-1:1;
   const targetX=sign*(original.at[0]+delta[0]),targetZ=original.at[1]+delta[1];
   assert.ok((aim[0]-current[0])*(targetX-current[0])+(aim[1]-current[1])*(targetZ-current[1])>=-.05);
  }
 }
});
test('opponent panel exposes automatic, source and mirror controls, and mirror toggles survive package changes',()=>{
 const dom=new JSDOM('<section></section>');Object.assign(globalThis,{document:dom.window.document});
 let s=template();const listeners:(()=>void)[]=[];const host=document.querySelector<HTMLElement>('section')!;
 mountOpponent(host,{get:()=>s,set:next=>{s=next;listeners.forEach(f=>f());},subscribe:f=>listeners.push(f)});
 const select=host.querySelector<HTMLSelectElement>('[aria-label="Kocaeli rakip paket"]')!,direction=host.querySelector<HTMLSelectElement>('[aria-label="Kocaeli yerleşim yönü"]')!,mirror=host.querySelector<HTMLButtonElement>('.opponent-mirror')!;
 assert.ok(mirror.disabled);select.value=opponentPackages[1].id;select.dispatchEvent(new dom.window.Event('change'));
 assert.equal(direction.value,'auto');assert.equal(s.opponent!.mirrored,true);
 mirror.click();assert.equal(s.opponent!.mirrored,false);assert.equal(direction.value,'source');
 mirror.click();assert.equal(s.opponent!.mirrored,true);assert.equal(direction.value,'mirror');
 select.value=opponentPackages[0].id;select.dispatchEvent(new dom.window.Event('change'));assert.equal(s.opponent!.alignment,'mirror');
 direction.value='auto';direction.dispatchEvent(new dom.window.Event('change'));assert.equal(s.opponent!.alignment,'auto');
 host.querySelector<HTMLButtonElement>('.opponent-clear')!.click();assert.equal(s.opponent,undefined);
});

test('automatic orientation is based on the snap formation after authored motion across all Ravens calls',()=>{
 for(const play of ravensPlays){
  const s=planRavens(applyOpponentPackage(ravensScenario(play.id),opponentPackages[1].id)).scenario;
  const snap=s.players.filter(p=>p.side==='OFF').map(p=>({id:p.id,at:position(s,p.id,s.steps[0].end)}));
  const formation=opponentFormation(s,snap);
  assert.equal(s.opponent!.mirrored,formation.strong===1,play.name);
 }
});

test('retained coach landmarks are not mirrored a second time when loading another package',()=>{
 const input=planRavens(applyOpponentPackage(template(),opponentPackages[1].id)).scenario;
 assert.equal(input.opponent!.mirrored,true);
 const id=input.players.find(p=>p.side==='DEF'&&p.pos==='CB')!.id;
 input.defenseEdits={[id]:{coverage:'zone',zone:[6,9],preSnap:[7,4]}};
 const switched=planRavens(applyOpponentPackage(input,opponentPackages[2].id)).scenario;
 assert.deepEqual(switched.defenseEdits,input.defenseEdits);
 assert.deepEqual(switched.opponent!.backup,input.opponent!.backup);
});
