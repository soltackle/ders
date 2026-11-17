'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const context = vm.createContext({});
for (const file of ['templates.js', 'defense.js', 'model.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), context, {filename:file});
}
const {M,D,T} = vm.runInContext('({M:OLModel,D:OLDefense,T:OLTemplates})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const tests = [];
function test(name, fn) { fn(); tests.push(name); console.log('PASS '+name); }

test('Fresh workshop has no authored or generated plays and four explicit DL rushers', () => {
  const db = M.fresh();
  assert.equal(db.plays.length, 0);
  assert.equal(db.defenders.length, 11);
  assert.equal(db.defenders.filter(d=>d.rush).length, 4);
  assert.ok(db.defenders.filter(d=>d.rush).every(d=>d.level==='DL'));
  assert.equal(M.validate(db), true);
  assert.ok(db.templates.length >= 35);
});

test('New play is blank and its players and steps are separately editable', () => {
  const p=M.newPlay('İlk oyunum');
  assert.equal(p.name, 'İlk oyunum');
  assert.equal(p.halfSlide, false);
  assert.equal(p.players.length, 7);
  assert.ok(p.players.every(a=>!a.task&&!a.target&&!a.secondary&&!a.path.length));
  assert.ok(p.players.every(a=>a.steps.length===6&&a.steps.every(s=>!s.text)));
  p.players[0].steps[0].text='Yalnız LT açıklamam';
  assert.equal(p.players[1].steps[0].text,'');
});

test('Half-slide suggestions match all three stated hash rules with no RB or QB assignment', () => {
  const db=M.fresh(), p=M.newPlay('Kural kontrolü');
  const before=JSON.stringify(p);
  assert.equal(Object.keys(M.suggestions(db,p)).length,0);
  p.halfSlide=true;
  const expected={left:{C:'sağ A',RG:'sağ B',RT:'sağ C'},middle:{C:'sağ A',RG:'sağ B',RT:'sağ C'},right:{C:'sol A',LG:'sol B',LT:'sol C'}};
  for (const ball of ['left','middle','right']) {
    db.ball=ball;
    const suggestions=M.suggestions(db,p);
    assert.equal(Object.keys(suggestions).length,5);
    for (const a of p.players) {
      if (['QB','RB'].includes(a.position)) {
        assert.equal(suggestions[a.id],undefined);
      } else {
        const exp=expected[ball][a.position];
        assert.equal(suggestions[a.id].source,'suggestion');
        assert.equal(suggestions[a.id].gap,exp||'');
        assert.equal(suggestions[a.id].task,exp?`GAP/SLIDE · ${exp} gap`:'MAN · boundary tarafı');
      }
    }
  }
  p.halfSlide=false;
  assert.equal(JSON.stringify(p),before,'suggestions must never write over authored players or steps');
});

test('Template application uses independent deep copies across actors and plays', () => {
  const db=M.fresh(), p=M.newPlay('Bir'), other=M.newPlay('İki');
  const template=db.templates[0], original=JSON.stringify(template);
  p.players[0].steps=M.clone(template.steps);
  other.players[0].steps=M.clone(template.steps);
  p.players[0].steps[0].text='Koçun kendi cümlesi';
  p.players[0].steps.splice(2,1);
  p.players[0].steps.push({title:'Ek adım',text:'Bitir',direction:'',target:'',condition:''});
  assert.equal(JSON.stringify(template),original);
  assert.equal(JSON.stringify(other.players[0].steps),JSON.stringify(template.steps));
});

test('Every required front has eleven defenders and LB alignment never changes its rush flag', () => {
  for(const front of D.fronts()) {
    const defs=D.create(front.id);
    assert.equal(defs.length,11,front.name);
    assert.equal(new Set(defs.map(d=>d.id)).size,11,front.name);
    const lb=defs.find(d=>d.level==='LB');
    assert.equal(lb.rush,false);
    lb.y=299; lb.x=500;
    assert.equal(lb.rush,false,'moving an LB to the line must not mark it as a blitzer');
  }
});

test('Every movement preset returns valid editable point paths without mutating its source', () => {
  const source=D.create(), original=JSON.stringify(source);
  for(const move of D.moves()) {
    const result=D.movement(source,move.id);
    assert.equal(JSON.stringify(source),original);
    const db=M.fresh(); db.defenders=result;
    assert.equal(M.validate(db),true,move.name);
    assert.ok(result.every(d=>Array.isArray(d.path)));
  }
});

test('Backup JSON retains manual text, paths, delays, templates and play-defense variant links', () => {
  const db=M.fresh(), p=M.newPlay('Yedek denemesi');
  db.plays.push(p);db.selectedPlayId=p.id;
  p.players[0].task='Benim açıklamam';
  p.players[0].path=[{x:330,y:320},{x:355,y:280,delay:0.5}];
  db.defenders[0].path=[{x:280,y:270},{x:350,y:240,delay:0.8},{x:420,y:365}];
  const key=M.variantKey(db,p);
  db.variants.push({id:'variant-test',playId:p.id,key,players:M.clone(p.players)});
  db.looks.push({id:'look-test',name:'Çizdiğim look',defenders:M.clone(db.defenders)});
  const restored=JSON.parse(JSON.stringify(db));
  assert.equal(M.validate(restored),true);
  assert.deepEqual(plain(restored),plain(db));
  assert.equal(M.variantKey(restored,restored.plays[0]),key);
});

test('Conflicting backup merge preserves both plays and remaps incoming variant to its play', () => {
  const db=M.fresh(), p=M.newPlay('Mevcut');db.plays.push(p);
  const original=JSON.stringify(p);
  const incoming=M.fresh(), other=M.clone(p);other.name='Yedekteki';
  other.players[0].steps[0].text='Yedekteki farklı açıklama';incoming.plays.push(other);
  const oldKey=M.variantKey(incoming,other);
  incoming.variants.push({id:'variant-import',playId:other.id,key:oldKey,players:M.clone(other.players)});
  assert.equal(M.validate(incoming),true);
  M.merge(db,incoming);
  assert.equal(db.plays.length,2);
  assert.equal(JSON.stringify(db.plays[0]),original);
  const imported=db.plays[1];
  assert.notEqual(imported.id,p.id);
  assert.equal(db.variants[0].playId,imported.id);
  assert.equal(db.variants[0].key,imported.id+oldKey.slice(oldKey.indexOf('|')));
  assert.equal(db.variants[0].players[0].steps[0].text,'Yedekteki farklı açıklama');
  assert.equal(M.validate(db),true);
});

test('Identical backup merge is idempotent', () => {
  const db=M.fresh();db.plays.push(M.newPlay('Aynı oyun'));
  const original=JSON.stringify(db);
  M.merge(db,M.clone(db));
  assert.equal(JSON.stringify(db),original);
});

test('Imported unsaved defense is preserved as a look while occupied local working state stays intact', () => {
  const db=M.fresh();db.plays.push(M.newPlay('Yerel oyun'));
  const localDefense=JSON.stringify(db.defenders);
  const incoming=M.fresh();incoming.defenders[0].path=[{x:100,y:200,delay:0.6},{x:200,y:330}];incoming.front='43under';incoming.ball='right';
  M.merge(db,incoming);
  assert.equal(JSON.stringify(db.defenders),localDefense);
  assert.equal(db.ball,'middle');
  assert.equal(db.looks.length,1);
  assert.match(db.looks[0].name,/içe aktarılan/);
  assert.deepEqual(plain(db.looks[0].defenders),plain(incoming.defenders));
  assert.equal(db.looks[0].front,'43under');
  M.merge(db,incoming);assert.equal(db.looks.length,1,'repeat import must not duplicate the same defense');
});

test('Empty workshop restores incoming working state, including selected play and custom defense', () => {
  const db=M.fresh(), incoming=M.fresh(), p=M.newPlay('Geri yükle');
  incoming.plays.push(p);incoming.selectedPlayId=p.id;incoming.front='34';incoming.ball='right';incoming.defenders=D.create('34');
  incoming.defenders[0].path=[{x:285,y:271},{x:325,y:315,delay:0.3}];
  M.merge(db,incoming);
  assert.equal(db.selectedPlayId,p.id);
  assert.equal(db.front,'34');assert.equal(db.ball,'right');
  assert.deepEqual(plain(db.defenders),plain(incoming.defenders));
  assert.equal(M.validate(db),true);
});

test('Conflicting same-play defense variant remains usable on its own imported play copy', () => {
  const db=M.fresh(), p=M.newPlay('Aynı oyun');db.plays.push(p);
  const key=M.variantKey(db,p);
  db.variants.push({id:'v-local',playId:p.id,key,players:M.clone(p.players)});
  db.variants[0].players[0].task='Yerel özel görev';
  const incoming=M.clone(db);incoming.variants[0].players[0].task='Yedekteki özel görev';
  M.merge(db,incoming);
  assert.equal(db.plays.length,2);
  assert.equal(db.variants.length,2);
  assert.equal(db.variants[0].players[0].task,'Yerel özel görev');
  const imported=db.variants[1];
  assert.notEqual(imported.playId,p.id);
  assert.equal(imported.playId,db.plays[1].id);
  assert.ok(imported.key.startsWith(imported.playId+'|'));
  assert.equal(imported.players[0].task,'Yedekteki özel görev');
  assert.equal(M.validate(db),true);
});

test('Legacy v2 migration preserves every raw record, exact coordinates and explicit rush flags', () => {
  const defenders=plain(D.create()).map(d=>({id:d.id,label:d.label,level:d.level,x:d.x-500,depth:4,tech:d.tech,side:d.side,rush:d.rush,move:'straight',fit:'auto'}));
  defenders[0].depth=1.4;defenders[0].move='loopRight';defenders[0].twist={to:35,kind:'looper'};
  const lb=defenders.find(d=>d.level==='LB');lb.depth=0.5;lb.rush=false;
  const old={version:2,revision:3,ball:'right',looks:[{id:'look-eski',name:'Eski look',front:'over',strength:'left',movement:'custom',pressure:'none',coverage:'3',fit:'box',defenders}],playRules:{p01:{scan:'Koçun sırası',actors:{H:'protect'}}},notes:{p01:'Eski özel not'},overrides:{'p01-hash':{LT:{role:'help',target:'N',secondary:'M',zone:1}}},trash:[{id:'deleted',name:'Arşiv'}],customField:{text:'Kaybetme'}};
  const db=M.fresh();M.migrate(db,old);
  assert.equal(db.plays.length,0,'legacy catalog must not become an active playbook');
  assert.deepEqual(plain(db.legacy[0].data),old);
  assert.equal(db.looks.length,1);
  assert.deepEqual(plain(db.looks[0].legacy),old.looks[0]);
  assert.equal(db.looks[0].defenders[0].x,500+defenders[0].x);
  assert.equal(db.looks[0].defenders[0].y,300-1.4*24);
  assert.equal(db.looks[0].defenders.find(d=>d.id===lb.id).rush,false);
  assert.ok(db.looks[0].defenders[0].path.length>0,'legacy stunt must have editable points');
  assert.equal(db.ball,'right');
  assert.equal(M.validate(db),true);
  M.migrate(db,old);assert.equal(db.looks.length,1);assert.equal(db.legacy.length,1);
});

test('Malformed imports reject without partial mutation and duplicate identities are invalid', () => {
  const db=M.fresh(), original=JSON.stringify(db);
  assert.throws(()=>M.migrate(db,{version:2,looks:[null]}));
  assert.equal(JSON.stringify(db),original);
  for(const list of ['looks','templates','variants']) {
    const bad=M.fresh();
    if(list==='looks')bad.looks.push({id:'dup',name:'A',defenders:M.clone(bad.defenders)});
    if(list==='variants') {const p=M.newPlay('P');bad.plays.push(p);bad.variants.push({id:'dup',playId:p.id,key:M.variantKey(bad,p),players:M.clone(p.players)});}
    bad[list].push(M.clone(bad[list][0]));
    assert.equal(M.validate(bad),false,list);
    assert.throws(()=>M.merge(db,bad));
    assert.equal(JSON.stringify(db),original);
  }
  const invalidStep=M.fresh(), p=M.newPlay('Konum');invalidStep.plays.push(p);p.players[0].steps[0].x=1001;
  assert.equal(M.validate(invalidStep),false);
});

console.log(`\n${tests.length} model/data checks passed.`);
