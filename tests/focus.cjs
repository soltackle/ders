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
 const q=open(fs.readFileSync(INPUT,'utf8')), {app,click,el}=q;
 for(const id of ['gamesPanel','defensePanel','toolsPanel','editorPanel'])assert.equal(el('#'+id).open,false);
 const c=app.actors().find(a=>a.position==='C');click('[data-select-id="'+c.id+'"]');assert.equal(app.S.focus,false);click('#focusBtn');assert.equal(app.S.focus,true);
 assert(el('#field [data-actor-id="'+c.id+'"]').getAttribute('data-context')==='clear');
 const qb=app.actors().find(a=>a.position==='QB');assert.equal(el('#field [data-actor-id="'+qb.id+'"]').getAttribute('data-context'),'clear');
 assert(q.d.querySelectorAll('[data-context="blurred"]').length>0);
 for(const k of ['Ayaklar','Eller','Gözler','Temas noktası','Gövde'])assert(el('#inspector').textContent.includes(k));
 const node=el('#field [data-moving][data-actor-id="'+c.id+'"]'),before=node.getAttribute('transform');click('#playBtn');
 const stable=el('#field [data-moving][data-actor-id="'+c.id+'"]');await new Promise(resolve=>setTimeout(resolve,220));
 assert(app.S.visualPhase>0&&app.S.visualPhase<1);assert.equal(app.S.phase,0);assert.equal(el('#field [data-moving][data-actor-id="'+c.id+'"]'),stable);assert.notEqual(stable.getAttribute('transform'),before);click('#playBtn');assert.equal(app.S.playing,false);
 click('#focusBtn');assert.equal(q.d.querySelectorAll('[data-context="blurred"]').length,0);const qb2=app.actors().find(a=>a.position==='QB');click('[data-select-id="'+qb2.id+'"]');assert.equal(app.S.focus,false,'selection must not turn focus back on');
 q.clean();for(const doc of openDocuments)doc.window.close();console.log('PASS collapsed panels, role focus, QB context, blur, five technique fields and fractional RAF motion without replacing actor nodes');
})().catch(e=>{console.error(e.stack);for(const doc of openDocuments)doc.window.close();process.exitCode=1;});
