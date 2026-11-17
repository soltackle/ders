import {test} from 'node:test';import assert from 'node:assert/strict';import {HeadLook,verticalFov} from '../src/head-look.ts';
test('fare bakışı yaw/pitch yönüne çevirir ve otomatik hedef zorlamaz',()=>{const h=new HeadLook();h.move(100,-50,.3);assert.ok(h.heading(0)>.3);assert.ok(h.pitch>0);assert.equal(h.heading(1),h.heading(0));h.reset();assert.equal(h.heading(1),1);assert.equal(h.pitch,0)});
test('boyun sınırları ters dönmeyi önler',()=>{const h=new HeadLook();h.move(100000,100000,0);assert.ok(h.yaw<=1.92);assert.ok(h.pitch>=-1.05);h.move(-200000,-200000,0);assert.ok(h.yaw>=-1.92);assert.ok(h.pitch<=.87)});
test('geniş görüş açısı ekran oranına uyarlanır ve aşırı lens bozulması sınırlanır',()=>{assert.ok(verticalFov(100,2)<verticalFov(100,1));assert.ok(verticalFov(115,.5)<=90)});
