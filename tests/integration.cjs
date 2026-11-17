'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const INPUT = process.argv[2] || require('node:path').join(__dirname,'..','index.html');
const KEY = 'ol-atolye-editor-v3';
const plain = value => JSON.parse(JSON.stringify(value));
const report = [];
const openDocuments = [];

function open(html, local = {}) {
  const errors = [], downloads = [], blobs = new Map();
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://ol.test/', pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      window.confirm = () => true;
      window.Blob = Blob;
      window.URL.createObjectURL = blob => {const id = 'blob:qa-' + blobs.size;blobs.set(id, blob);return id;};
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function () {downloads.push({name:this.download, blob:blobs.get(this.href)});};
      window.HTMLDialogElement.prototype.showModal = function () {this.setAttribute('open', '');};
      window.HTMLDialogElement.prototype.close = function () {this.removeAttribute('open');};
      window.SVGElement.prototype.getScreenCTM = () => ({inverse:() => ({})});
      window.SVGElement.prototype.createSVGPoint = () => ({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}});
      window.SVGElement.prototype.setPointerCapture = () => {};
      window.SVGElement.prototype.releasePointerCapture = () => {};
      for (const [key, value] of Object.entries(local)) window.localStorage.setItem(key, value);
    }
  });
  openDocuments.push(dom);
  const w=dom.window, d=w.document;
  function el(selector) {const element=d.querySelector(selector);assert(element,'Missing DOM element: '+selector);return element;}
  function click(selector) {const element=el(selector);assert(!element.disabled,'Disabled DOM element: '+selector);element.click();}
  function change(selector, value) {const element=el(selector);if(element.type==='checkbox')element.checked=value;else element.value=value;element.dispatchEvent(new w.Event('change',{bubbles:true}));}
  function pointer(type,target,x,y,pointerType='mouse') {const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(e,{pointerId:{value:71},pointerType:{value:pointerType},isPrimary:{value:true}});target.dispatchEvent(e);}
  function tap(target,x,y,pointerType) {pointer('pointerdown',target,x,y,pointerType);pointer('pointerup',target,x,y,pointerType);}
  function clean() {assert.equal(errors.length,0, errors.map(e=>e.stack||e.message).join('\n'));}
  assert(w.OLApp,'App booted and exposes window.OLApp');
  clean();
  return {dom,w,d,app:w.OLApp,errors,downloads,el,click,change,pointer,tap,clean};
}

function pass(name) {report.push(name);console.log('PASS '+name);}

(async () => {
  const source=fs.readFileSync(INPUT,'utf8');
  const q=open(source), {app,el,click,change,pointer,tap}=q;
  assert.equal(app.db.plays.length,0);
  assert.equal(app.db.templates.length,39);
  assert.equal(app.db.defenders.filter(d=>d.rush).length,4);
  assert(app.db.defenders.filter(d=>d.rush).every(d=>d.level==='DL'));
  assert.equal(app.db.looks.length,0);
  pass('fresh editor: no invented games, 39 templates, four DL rushers');

  el('#newPlayName').value='QA Bir';click('#newPlayBtn');
  const firstId=app.play().id;
  assert.equal(app.db.plays.length,1);
  assert.equal(app.play().players.length,7);
  assert(app.play().players.every(a=>a.task===''&&a.target===''&&a.steps.length===6&&a.steps.every(s=>s.text==='')));
  change('[data-scope="play"][data-prop="name"]','QA Bir yeniden');
  change('[data-scope="play"][data-prop="formation"]','Koç formasyonu');
  assert.equal(app.play().name,'QA Bir yeniden');
  click('#copyPlayBtn');
  assert.equal(app.db.plays.length,2);
  assert(app.play().id!==firstId);
  assert.equal(app.play().formation,'Koç formasyonu');
  change('[data-scope="actor"][data-prop="label"]','Kopya oyuncusu');
  assert.notEqual(app.db.plays.find(p=>p.id===firstId).players[0].label,'Kopya oyuncusu');
  click('#deletePlayBtn');
  assert.equal(app.db.plays.length,1);
  assert.equal(app.db.trash.at(-1).kind,'plays');
  el('#newPlayName').value='QA İki';click('#newPlayBtn');
  const secondId=app.play().id;
  click('[data-play="'+firstId+'"]');
  assert.equal(app.play().id,firstId);
  assert.equal(app.db.plays.length,2);
  pass('DOM game creation, blank tasks, rename, formation, independent copy and delete');

  click('[data-inspector-tab="steps"]');
  const actorId=app.selected().id;
  const actor=()=>app.actors().find(a=>a.id===actorId);
  const coachText='Koç metni: <işaret> </script> & "alıntı"';
  change('[data-scope="step"][data-step="0"][data-prop="text"]',coachText);
  assert.equal(actor().steps[0].text,coachText);
  change('[data-scope="step"][data-step="1"][data-prop="direction"]','Sağ çapraz');
  change('[data-scope="step"][data-step="1"][data-prop="target"]','Sağ B gap');
  change('[data-scope="step"][data-step="4"][data-prop="condition"]','Yalnız koçun verdiği işarette');
  click('[data-action="addStep"]');assert.equal(actor().steps.length,7);
  change('[data-scope="step"][data-step="6"][data-prop="title"]','Ek görev');
  click('[data-step-action="up"][data-index="6"][data-edit="step"]');
  assert.equal(actor().steps[5].title,'Ek görev');
  click('[data-step-action="down"][data-index="5"][data-edit="step"]');
  assert.equal(actor().steps[6].title,'Ek görev');
  click('[data-step-action="delete"][data-index="6"][data-edit="step"]');
  assert.equal(actor().steps.length,6);
  const template=app.db.templates[0], templateText=template.steps[0].text;
  el('#actorTemplate').value=template.id;click('[data-action="replaceTemplate"]');
  assert.equal(actor().steps[0].text,templateText);
  change('[data-scope="step"][data-step="0"][data-prop="text"]',coachText);
  assert.equal(template.steps[0].text,templateText);
  el('#newTemplateName').value='Koçun özel hareketi';click('[data-action="saveTemplate"]');
  const customTemplate=app.db.templates.at(-1);
  assert.equal(customTemplate.name,'Koçun özel hareketi');
  assert.equal(customTemplate.steps[0].text,coachText);
  change('[data-scope="step"][data-step="0"][data-prop="text"]',coachText+' son');
  assert.equal(customTemplate.steps[0].text,coachText);
  change('[data-scope="step"][data-step="1"][data-prop="x"]',355);
  change('[data-scope="step"][data-step="1"][data-prop="y"]',310);
  click('#nextBtn');assert.equal(app.S.phase,1);
  click('#prevBtn');assert.equal(app.S.phase,0);
  pass('DOM step text, direction, gap, condition, add/remove/reorder, isolated template copies and custom template');

  click('[data-inspector-tab="task"]');
  const lb=app.db.defenders.find(d=>d.level==='LB');
  change('#defenderPicker',lb.id);
  assert.equal(app.S.side,'defense');
  assert.equal(app.selected().rush,false);
  change('[data-scope="actor"][data-prop="depth"]',0.25);
  assert(app.selected().y>280&&app.selected().y<300,'LB moves close to LOS');
  assert.equal(app.selected().depth,0.25);
  assert.equal(app.selected().rush,false);
  const dlId=app.db.defenders.find(d=>d.level==='DL').id;
  const dg=el('#field [data-actor-id="'+dlId+'"][data-side="defense"]:not([data-point-index])');
  tap(dg,app.db.defenders.find(d=>d.id===dlId).x,app.db.defenders.find(d=>d.id===dlId).y);
  assert.equal(app.selected().id,dlId);
  const oldX=app.selected().x;
  change('[data-scope="actor"][data-prop="tech"]','3');
  assert.equal(app.selected().x,oldX,'technique label does not silently alter X');
  click('[data-action="alignTechnique"]');
  assert.equal(app.selected().x,375);
  click('[data-inspector-tab="path"]');click('[data-action="clearPath"]');
  assert.equal(app.selected().path.length,0);
  click('[data-mode="draw"]');
  tap(el('#field [data-field-background]'),430,320,'touch');
  tap(el('#field [data-field-background]'),470,380,'mouse');
  assert.equal(app.selected().path.length,2);
  assert.equal(app.selected().path[0].x,430);
  click('[data-mode="select"]');
  const point=el('#field [data-point-index="0"]');
  pointer('pointerdown',point,430,320,'touch');
  pointer('pointermove',el('#field'),450,335,'touch');
  pointer('pointerup',el('#field'),450,335,'touch');
  assert.equal(app.selected().path[0].x,450);
  assert.equal(app.selected().path[0].y,335);
  click('[data-mode="erase"]');tap(el('#field [data-point-index="1"]'),470,380);
  assert.equal(app.selected().path.length,1);
  change('[data-scope="point"][data-point="0"][data-prop="delay"]',2);
  assert.equal(app.selected().path[0].delay,2);
  pass('DOM LB alignment stays non-blitz; SVG mouse/touch add, drag, delete and delayed path edit');

  el('#lookName').value='QA özel look';click('#saveLookBtn');
  assert.equal(app.db.looks.length,1);
  const lookId=app.db.selectedLookId, savedDefense=plain(app.db.defenders);
  change('#frontSelect','34');assert.notDeepEqual(plain(app.db.defenders),savedDefense);
  click('#looksBtn');click('[data-look-load="'+lookId+'"]');
  assert.deepEqual(plain(app.db.defenders),savedDefense);
  assert.equal(app.selected().path[0].delay,2);
  click('[data-play="'+secondId+'"]');assert.deepEqual(plain(app.db.defenders),savedDefense);
  click('[data-play="'+firstId+'"]');assert.deepEqual(plain(app.db.defenders),savedDefense);
  assert.equal(app.db.selectedLookId,lookId);
  pass('DOM look save/load restores all paths, technique and rush flags; switching games preserves defense');

  click('[data-inspector-tab="task"]');
  change('[data-scope="actor"][data-prop="task"]','TEMEL görev');
  change('[data-scope="play"][data-prop="halfSlide"]',true);
  assert.equal(app.effective(app.selected()).task,'TEMEL görev');
  click('[data-action="variantScope"]');
  assert(app.variant());
  change('[data-scope="actor"][data-prop="task"]','LOOK özel elle görev');
  assert.equal(app.effective(app.selected()).task,'LOOK özel elle görev');
  click('[data-action="baseScope"]');
  assert.equal(app.selected().task,'TEMEL görev');
  click('[data-action="variantScope"]');
  assert.equal(app.selected().task,'LOOK özel elle görev');
  click('[data-play="'+secondId+'"]');
  click('[data-play="'+firstId+'"]');
  assert.equal(app.selected().task,'LOOK özel elle görev');
  change('#ballSelect','right');assert.equal(app.variant(),null);
  assert.equal(app.selected().task,'TEMEL görev');
  change('#ballSelect','middle');assert.equal(app.selected().task,'LOOK özel elle görev');
  assert.equal(app.play().players.find(a=>a.position==='RB').task,'');
  assert.equal(app.effective(app.actors().find(a=>a.position==='RB')).task,'');
  pass('DOM variant and manual task survive base/game/hash changes; automatic suggestions preserve manual tasks and leave RB blank');

  const incoming=plain(app.db), imported=plain(incoming.plays[0]);
  imported.id+='-qa-import';imported.name='JSON ile eklenen oyun';incoming.plays.push(imported);
  const beforeImport=app.db.plays.length;
  const importElement=el('#importFile');
  Object.defineProperty(importElement,'files',{configurable:true,value:[{size:JSON.stringify(incoming).length,text:async()=>JSON.stringify(incoming)}]});
  importElement.dispatchEvent(new q.w.Event('change',{bubbles:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(app.db.plays.length,beforeImport+1,el('#importStatus').textContent);
  assert(app.db.plays.some(p=>p.name==='JSON ile eklenen oyun'));
  assert.equal(app.db.variants.length,1);
  assert.deepEqual(plain(app.db.defenders),savedDefense);
  pass('DOM asynchronous JSON import merges a new game while preserving look, variant and current defense');

  click('#exportJsonBtn');
  const jsonDownload=q.downloads.find(x=>x.name.endsWith('.json'));
  assert(jsonDownload?.blob);
  const exportedJson=JSON.parse(await jsonDownload.blob.text());
  assert.equal(exportedJson.plays.length,app.db.plays.length);
  assert.equal(exportedJson.templates.length,40);
  assert.deepEqual(exportedJson.defenders,savedDefense);
  click('#exportHtmlBtn');
  const htmlDownload=q.downloads.find(x=>x.name.endsWith('.html'));
  assert(htmlDownload?.blob);
  const exportedHtml=await htmlDownload.blob.text();
  assert(exportedHtml.startsWith('<!doctype html>'));
  const reopened=open(exportedHtml);
  assert.equal(reopened.app.db.plays.length,app.db.plays.length);
  assert.equal(reopened.app.db.templates.length,40);
  assert.deepEqual(plain(reopened.app.db.defenders),savedDefense);
  assert.equal(reopened.app.db.looks[0].defenders.find(d=>d.id===dlId).path[0].delay,2);
  assert.equal(reopened.app.db.templates.at(-1).steps[0].text,coachText);
  assert.equal(reopened.app.variant().players.find(a=>a.id===actorId).task,'LOOK özel elle görev');
  assert.equal(reopened.d.querySelector('#embeddedBackup').type,'application/json');
  reopened.clean();
  pass('DOM JSON and HTML downloads; self-contained exported HTML reopens with paths, special text, templates and variant intact');

  const stored=q.w.localStorage.getItem(KEY);
  const reloaded=open(source,{[KEY]:stored});
  assert.deepEqual(plain(reloaded.app.db.plays),plain(app.db.plays));
  assert.deepEqual(plain(reloaded.app.db.looks),plain(app.db.looks));
  assert.deepEqual(plain(reloaded.app.db.defenders),savedDefense);
  assert.deepEqual(plain(reloaded.app.db.variants),plain(app.db.variants));
  assert.equal(reloaded.app.db.templates.length,40);
  reloaded.clean();q.clean();
  pass('full browser-local storage reload roundtrip');
  console.log(JSON.stringify({status:'passed',checks:report.length,tests:report},null,2));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(()=>{for(const dom of openDocuments)dom.window.close();});
