import {opponentPackages,applyOpponentPackage} from '../src/opponent.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planRavens,ravensPlays,ravensScenario} from '../src/ravens.ts';
import {runExchange,ravensBall,tossWindow} from '../src/ravens-ball.ts';
import {worldPosition,playFrame} from '../src/play-dynamics.ts';
import {position} from '../src/model.ts';
const dist=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('MAZE counter defaults to a backward toss with an unowned flight and a catch at the RB route',()=>{
 const s=planRavens(ravensScenario(ravensPlays[11].id)).scenario,w=tossWindow(s)!;
 assert.equal(runExchange(s),'toss');assert.ok(w);assert.ok(w.catchAt<=s.steps[0].end+2);
 const launch=position(s,w.qb,w.releaseAt);assert.ok(w.to[1]<launch[1]-.3);
 assert.equal(ravensBall(s,w.releaseAt-.01)!.carrier,w.qb);
 const flight=ravensBall(s,(w.releaseAt+w.catchAt)/2)!;
 assert.ok('phase' in flight&&flight.phase==='flight');assert.equal(flight.carrier,'');assert.ok(flight.at[1]>1.3);
 assert.equal(playFrame(s,w.releaseAt+.2).carrier,undefined);
 assert.equal(playFrame(s,w.catchAt+.06).carrier,w.carrier);
 assert.ok(dist(worldPosition(s,w.carrier,w.catchAt),w.to)<.1);
 assert.equal(ravensBall(s,w.catchAt+.01)!.carrier,w.carrier);
 assert.ok(!s.actions.some(a=>a.label==='special-mesh-approach'));
 assert.deepEqual(planRavens(s).scenario,s);
});
test('toss and handoff can be chosen independently for counters without rewriting puller routes',()=>{
 const input=ravensScenario(ravensPlays[29].id);input.ravens!.exchange='toss';
 const toss=planRavens(input).scenario,w=tossWindow(toss)!;assert.ok(w);
 const hand=structuredClone(toss);hand.ravens!.exchange='handoff';
 const handoff=planRavens(hand).scenario;assert.equal(tossWindow(handoff),null);
 const at=handoff.ravens!.transferAt!;assert.ok(dist(position(handoff,'Q',at),position(handoff,handoff.ravens!.carrier!,at))<=1.001);
 assert.deepEqual(toss.actions.filter(a=>a.label==='source-pull'),handoff.actions.filter(a=>a.label==='source-pull'));
});
test('nonpulling blockers make actual contact with their assigned DL before following the finishing block arrow',()=>{
 for(const n of [12,13,14,19,28,30,34]){
  const p=planRavens(ravensScenario(ravensPlays[n-1].id)),s=p.scenario,snap=s.steps[0].end,contacted=new Set<string>();
  for(let t=snap;t<snap+3;t+=.1)for(const c of playFrame(s,t).contacts.filter(c=>c.kind==='block')){contacted.add(`${c.a}:${c.b}`);contacted.add(`${c.b}:${c.a}`);}
  for(const a of p.assignments){
   const target=s.players.find(d=>d.id===a.target),first=s.actions.find(q=>q.player===a.player&&q.label==='source-down');
   if(target?.pos!=='DL'||!first)continue;
   assert.ok(contacted.has(`${a.player}:${a.target}`),`${n}: ${a.player} must engage ${a.target}`);
  }
 }
});

test('backward toss reaches the runner against every package and both hashes',()=>{
 for(const n of [12,30])for(const pack of opponentPackages)for(const hash of ['left','right'] as const){
  const input=applyOpponentPackage(ravensScenario(ravensPlays[n-1].id),pack.id);input.hash=hash;input.ravens!.exchange='toss';
  const s=planRavens(input).scenario,w=tossWindow(s)!;assert.ok(w,`${n}/${pack.name}/${hash}: toss window`);
  const launch=worldPosition(s,w.qb,w.releaseAt);assert.ok(w.to[1]<launch[1]);
  assert.equal(playFrame(s,w.releaseAt+.2).carrier,undefined);
  assert.ok(dist(worldPosition(s,w.carrier,w.catchAt),w.to)<.15,`${n}/${pack.name}/${hash}: catch point`);
  assert.equal(playFrame(s,w.catchAt+.1).carrier,w.carrier);
 }
});
