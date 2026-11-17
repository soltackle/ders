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


(async()=>{
 const source=fs.readFileSync(INPUT,'utf8'),q=open(source),{app,click,change,el}=q,w=q.w;
 const E=w.eval('OLEmpty'),D=w.eval('OLDefense'),M=w.eval('OLModel');
 assert.equal(app.db.plays.length,1);assert.equal(app.play().name,'Empty');assert.equal(app.actors().length,11);assert(!app.actors().some(a=>a.position==='RB'));assert.equal(app.db.templates.length,39);
 const pos=name=>app.actors().find(a=>a.position===name),select=a=>click(`[data-select-id="${a.id}"]`),jobs=()=>E.analyze(app.db,{...app.play(),players:app.actors()});
 select(pos('C'));click('[data-inspector-tab="steps"]');assert.equal(q.d.querySelectorAll('#inspector .step-card').length,6);assert(el('#inspector').textContent.includes('Sık hata'));assert(el('#inspector').textContent.includes('Kendini kontrol et'));
 let a=jobs();assert.equal(a.jobs[pos('C').id].target,a.jobs[pos('LG').id].target);assert(a.jobs[pos('C').id].task.includes('göz ve gövde'));assert.equal(a.jobs[pos('RG').id].target,'T');assert.equal(a.jobs[pos('RT').id].target,'ER');
 pass('Only supplied Empty seeded: RB absent, eleven actors, detailed six-step center combo and correct adjacent blockers');
 click('[data-learning="normal"]');assert(!el('#inspector').textContent.includes('Sık hata'));click('[data-learning="rookie"]');assert(el('#inspector').textContent.includes('Sık hata'));
 click('[data-action="editLessons"]');assert(el('#lessonDialog').hasAttribute('open'));change('[data-scope="lessonStep"][data-step="0"][data-prop="text"]','Koç: {target} + {comboGuard}; <göz> & denge');assert(el('#inspector').textContent.includes('Koç: N + LG; <göz> & denge'));
 click('[data-action="addLessonStep"]');assert.equal(app.play().emptyCurriculum.centerCombo.length,7);click('[data-edit="lessonStep"][data-step-action="up"][data-index="6"]');assert.equal(app.play().emptyCurriculum.centerCombo[5].title,'Yeni adım');click('[data-edit="lessonStep"][data-step-action="delete"][data-index="5"]');assert.equal(app.play().emptyCurriculum.centerCombo.length,6);click('#lessonDialog [data-close]');
 click('[data-action="copyTeaching"]');assert.equal(pos('C').stepMode,'manual');const manual=pos('C').steps[0].text;change('[data-scope="step"][data-step="0"][data-prop="cue"]','Benim kısa çağrım');assert.equal(pos('C').steps[0].cue,'Benim kısa çağrım');
 pass('Rookie/normal modes, editable live templates, placeholder substitution, add/reorder/delete and isolated manual coach steps');
 const boundaryLB=app.db.defenders.find(d=>d.level==='LB');boundaryLB.x=200;boundaryLB.rush=true;app.renderAll();a=jobs();assert(a.jobs[pos('QB').id].task.includes(boundaryLB.label));assert(a.boundaryReads.includes(boundaryLB.id));assert.notEqual(a.jobs[pos('LT').id].target,boundaryLB.id);assert.equal(pos('C').steps[0].text,manual);
 boundaryLB.rush=false;const fieldLB=app.db.defenders.find(d=>d.level==='LB'&&d.id!==boundaryLB.id);fieldLB.x=600;fieldLB.rush=true;app.renderAll();a=jobs();assert.equal(a.jobs[pos('RT').id].target,fieldLB.id);assert.equal(a.jobs[pos('RG').id].target,'ER');assert.equal(a.jobs[pos('C').id].target,'T');
 const frozen=pos('C').steps[0].text;change('#ballSelect','right');a=jobs();boundaryLB.rush=true;app.renderAll();a=jobs();assert.equal(a.jobs[pos('LT').id].target,boundaryLB.id);assert.equal(pos('C').steps[0].text,frozen);assert(a.jobs[pos('QB').id].task.includes(fieldLB.label));
 pass('Boundary LB remains a QB read; field LB shifts C/guard/tackle; hash updates preserve authored coach steps');
 let cases=0;
 for(const f of D.fronts())for(const ball of ['left','middle','right'])for(const tech of ['0','1','1i','2','2i','3','3i'])for(const side of ['L','R']){
  const db=M.fresh(),p=E.newPlay();db.ball=ball;db.defenders=D.create(f.id);const d=db.defenders.find(d=>d.level==='DL');d.tech=tech;d.side=side;d.x=500+(side==='L'?-1:1)*D.techX[tech];
  for(const blitz of [false,true]){db.defenders.filter(d=>d.level==='LB').forEach((d,i)=>{d.rush=blitz&&i<2;});const result=E.analyze(db,p);for(const actor of p.players){const job=result.jobs[actor.id];assert.equal(job.steps.length,6);for(const step of job.steps)for(const k of ['title','text','direction','target','condition','cue','error','check']){assert.equal(typeof step[k],'string');assert(step[k].length>0);assert(!/\{[A-Za-z]+\}/.test(step[k]),step[k]);}if(job.target){const defender=db.defenders.find(d=>d.id===job.target);assert(defender?.rush);if((ball==='right'?['RG','RT']:['LG','LT']).includes(actor.position))assert.equal(defender.level,'DL');}}cases++;}
 }
 assert.equal(cases,756);pass('756 combinations across all fronts, three hashes, 0/1/1i/2/2i/3/3i, both sides and blitz states: valid complete explanations');
 app.db.defenders=D.movement(D.create('43over'),'et');app.renderAll();assert(jobs().warnings.some(t=>t.includes('Slant')));assert(!jobs().warnings.join(' ').includes('beklen'));assert(jobs().warnings.join(' ').includes('looper'));
 app.db.defenders=D.movement(D.create('43over'),'overload');app.db.defenders.filter(d=>d.level==='LB').forEach(d=>d.rush=true);app.renderAll();assert(jobs().warnings.some(t=>t.includes('Ek açık baskı')));assert(jobs().open.length>0);
 pass('Stunt describes gap handoff and returning looper; overload gives a concrete QB response and exposes free pressure');
 select(pos('QB'));click('[data-inspector-tab="steps"]');click('[data-action="copyTeaching"]');change('[data-scope="step"][data-step="0"][data-prop="text"]','QB kendi metnim </script> < > &');click('#backupBtn');click('#exportHtmlBtn');const exported=await q.downloads.at(-1).blob.text();const restored=open(exported);assert.equal(restored.app.play().emptyCurriculum.centerCombo[0].text,'Koç: {target} + {comboGuard}; <göz> & denge');assert(restored.app.actors().find(a=>a.position==='QB').steps[0].text.includes('</script>'));assert.equal(restored.app.db.plays.length,1);
 const invalid=plain(app.db);invalid.plays[0].emptyCurriculum.field={bad:true};assert(!M.validate(invalid));
 const saved=q.w.localStorage.getItem(KEY);const reopened=open(source,{[KEY]:saved});assert.equal(reopened.app.db.plays.length,1);assert.equal(reopened.app.db.seedImports.length,1);
 for(const doc of openDocuments)doc.window.close();console.log('PASS HTML and localStorage roundtrip preserve editable curriculum, manual steps and single seeded game; malformed curriculum rejected');
})().catch(e=>{console.error(e.stack);for(const doc of openDocuments)doc.window.close();process.exitCode=1;});
