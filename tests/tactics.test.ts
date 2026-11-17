import {test} from 'node:test';import assert from 'node:assert/strict';
import {Scenario,position,defaultRules,motion,type ScenarioType} from '../src/model.ts';
import {alignment,classifyBlitz,resolvedAssignments,generateCase,pullTemplate} from '../src/tactics.ts';
import {inspectScenario} from '../src/analyzer.ts';
import {examples} from './fixtures.ts';
const sample=()=>structuredClone(examples[2]);
test('teknik: center omzu 1, tackle içi 4i, dışı 5',()=>{const s=sample();assert.equal(alignment(s,-.4).technique,'1');assert.equal(alignment(s,-2).technique,'4i');assert.equal(alignment(s,-2.8).technique,'5')});
test('field/boundary rolleri hash değişince aynalanır',()=>{const s=sample();assert.equal(resolvedAssignments(s).find(a=>a.role==='FT')?.player,'RT');s.hash='right';assert.equal(resolvedAssignments(s).find(a=>a.role==='FT')?.player,'LT')});
test('blitz başlıktan bağımsız hareket ve gap ile bulunur',()=>{const s=sample();s.blitz='none';assert.equal(classifyBlitz(s).blitz,'field');s.actions.find(a=>a.player==='SAM')!.gap='A';assert.equal(classifyBlitz(s).blitz,'middle')});
test('RB olmayan sahada boundary sorumluluğu varmış gibi gösterilmez',()=>{const s=sample();s.players=s.players.filter(p=>p.id!=='RB');s.blitz='boundary';s.actions=[{player:'WILL',label:'blitz',gap:'C',start:0,end:1,to:[-2,-1]}];const a=inspectScenario(s);assert.equal(a.blitzers[0].responsibility.length,0);assert.ok(a.findings.some(x=>x.text.includes('sahada')))});
test('tüm playbook kurallarından geçerli Case çıkar',()=>{const s=sample();for(const rule of defaultRules){const c=generateCase(s,rule.blitz);assert.equal(Scenario.safeParse(c).success,true);assert.equal(c.blitz,rule.blitz)}});
test('pull fazları aksiyon süresinin içinde ve yol hattın arkasında',()=>{const s=sample();const a=pullTemplate(s,'LG','DT2','R','trap',.4,1.4);assert.equal(a.phases?.length,4);assert.ok(a.path![0][1]<0);assert.ok(Scenario.safeParse({...s,actions:[a]}).success)});
test('engage edilen savunmacı aynı mesafeyi kat eder',()=>{const s=sample();s.actions=[{player:'LT',label:'engage',engage:'DE1',start:0,end:2,to:[-1,2]}];const at=position(s,'DE1',2),lt=position(s,'LT',2);assert.ok(Math.abs((at[0]-lt[0])-(s.players[5].at[0]-s.players[0].at[0]))<1e-8)});
test('zamanda ileri geri sarma aynı pozu döndürür',()=>{const s=sample();const first=motion(s,'RT',1);motion(s,'RT',1.5);assert.deepEqual(motion(s,'RT',1),first)});
test('yanlış engage ve faz aralıkları reddedilir',()=>{const s=sample();s.actions[0].engage='YOK';assert.equal(Scenario.safeParse(s).success,false);s.actions[0].engage=undefined;s.actions[0].phases=[{name:'open',start:0,end:99}];assert.equal(Scenario.safeParse(s).success,false)});

test('engage bitince savunmacı başlangıç noktasına sıçramaz',()=>{const s=sample();s.actions=[{player:'LT',label:'engage',engage:'DE1',start:0,end:1,to:[-1,2]}];assert.deepEqual(position(s,'DE1',1),position(s,'DE1',1.1))});
