import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Scenario,position,type ScenarioType} from '../src/model.ts';
import {planRavens,ravensPlays,ravensScenario} from '../src/ravens.ts';
import {applyOpponentPackage,opponentPackages} from '../src/opponent.ts';
import {worldPosition,playFrame} from '../src/play-dynamics.ts';
import {planTraining} from '../src/training.ts';
import {defaultProtection} from '../src/examples.ts';
import {mountDefenseEdit} from '../src/defense-edit-panel.ts';
const dist=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('presnap relocation changes the blocking read, restores the starting alignment and replans without accumulating paths',()=>{
 const input=ravensScenario(ravensPlays[0].id),start=[...input.players.find(p=>p.id==='DL1')!.at];
 input.defenseEdits={DL1:{coverage:'zone',zone:[-6,7],preSnap:[-4.5,1.1]}};
 const s=planRavens(input).scenario,snap=s.steps[0].end;
 assert.deepEqual(s.players.find(p=>p.id==='DL1')!.at,start);
 assert.ok(dist(position(s,'DL1',snap),[-4.5,1.1])<.001);
 assert.ok(dist(worldPosition(s,'DL1',snap),[-4.5,1.1])<.08);
 assert.deepEqual(planRavens(s).scenario,s);
 const decision=playFrame(s,snap+.4).decisions!.DL1;
 assert.equal(decision.phase,'zone-landmark');assert.ok(decision.aim[0]<-4.5&&decision.aim[1]>1.1);
});
test('edited man, zone, rush and hold override package paths while unedited defenders retain their package',()=>{
 const input=applyOpponentPackage(ravensScenario(ravensPlays[0].id),opponentPackages[0].id);
 const defenders=input.players.filter(p=>p.side==='DEF');const [man,zone,rush,hold,other]=defenders;
 input.defenseEdits={
  [man.id]:{coverage:'man',target:'X'},[zone.id]:{coverage:'zone',zone:[8,9]},
  [rush.id]:{coverage:'rush'},[hold.id]:{coverage:'hold',preSnap:[-7,4]}
 };
 const s=planRavens(input).scenario,snap=s.steps[0].end;
 for(const p of [man,zone,rush,hold])assert.ok(s.actions.filter(a=>a.player===p.id).every(a=>a.source==='defense'));
 assert.ok(s.actions.some(a=>a.player===other.id&&a.source==='opponent'));
 assert.equal(s.players.find(p=>p.id===rush.id)!.intent,'blitz');
 assert.equal(playFrame(s,snap+.5).decisions![man.id].phase,'route-match');
 const aimed=playFrame(s,snap+.5).decisions![zone.id].aim;assert.ok(aimed[0]>zone.at[0]&&aimed[1]>zone.at[1]);
 assert.ok(dist(worldPosition(s,hold.id,snap),worldPosition(s,hold.id,snap+1))<.1);
 const noAI=structuredClone(s);noAI.playerAI={enabled:false};
 assert.ok(dist(position(noAI,zone.id,noAI.steps.at(-1)!.end),[8,9])<.001);
 assert.deepEqual(planRavens(s).scenario,s);
});
test('defense edits also produce timed movement in the standard protection scenario',()=>{
 const s=defaultProtection();s.defenseEdits={DL1:{coverage:'hold',preSnap:[-8,2]}};
 const out=planTraining(s).scenario;
 assert.ok(out.steps[0].end>1.1);
 assert.deepEqual(position(out,'DL1',out.steps[0].end),[-8,2]);
 assert.deepEqual(planTraining(out).scenario,out);
});
test('defense panel selects defenders, persists coverage and presnap settings and opens on a selected defender',()=>{
 const dom=new JSDOM('<section></section>');Object.assign(globalThis,{document:dom.window.document});
 let scenario:ScenarioType=planRavens(ravensScenario(ravensPlays[0].id)).scenario,selected='C';const listeners:(()=>void)[]=[];
 const host=document.querySelector('section')!;
 mountDefenseEdit(host,{get:()=>({scenario,selected}),set:s=>{scenario=planRavens(s).scenario;listeners.forEach(f=>f());},select:id=>{selected=id;listeners.forEach(f=>f());},subscribe:f=>listeners.push(f)});
 const q=(key:string)=>host.querySelector<HTMLInputElement&HTMLSelectElement>(`[data-def-${key}]`)!;
 assert.equal(host.querySelector('details')!.open,false);
 q('player').value='DL1';q('player').dispatchEvent(new dom.window.Event('change'));
 assert.equal(host.querySelector('details')!.open,true);
 q('coverage').value='man';q('target').value='X';q('move').checked=true;q('pre-x').value='-5';q('pre-z').value='1.5';
 host.querySelector<HTMLButtonElement>('[data-def-save]')!.click();
 assert.equal(scenario.defenseEdits!.DL1.coverage,'man');assert.equal(scenario.defenseEdits!.DL1.target,'X');
 assert.deepEqual(scenario.defenseEdits!.DL1.preSnap,[-5,1.5]);
 assert.deepEqual(Scenario.parse(JSON.parse(JSON.stringify(scenario))).defenseEdits,scenario.defenseEdits);
 q('coverage').value='auto';q('move').checked=false;host.querySelector<HTMLButtonElement>('[data-def-save]')!.click();
 assert.ok(!scenario.actions.some(a=>a.player==='DL1'&&a.source==='defense'));
});
