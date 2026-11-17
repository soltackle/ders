import {test} from 'node:test';import assert from 'node:assert/strict';import {Scenario,position,analysis} from '../src/model.ts';import {examples} from '../src/examples.ts';
test('örnekler şemaya uygundur',()=>{for(const example of examples) assert.equal(Scenario.safeParse(example).success,true)});
test('hareket başlangıç ve bitiş konumlarını korur',()=>{const s=examples[0];assert.deepEqual(position(s,'LT',0),[-2.4,0]);assert.deepEqual(position(s,'LT',2),[-2,.7])});
test('hash ve blitz için doğru kuralı döndürür',()=>{const result=analysis(examples[2]);assert.equal(result.field,'right');assert.equal(result.blitz,'field');assert.match(result.rule,/FT/) });
test('bilinmeyen oyuncu referansını reddeder',()=>{const s=structuredClone(examples[0]);s.actions[0].player='YOK';assert.equal(Scenario.safeParse(s).success,false)});
