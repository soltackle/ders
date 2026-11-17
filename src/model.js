'use strict';
const OLModel = (() => {
 const clone=v=>JSON.parse(JSON.stringify(v)), uid=(prefix='id')=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 const steps=()=>OLStepTitles.map(title=>({title,text:'',direction:'',target:'',condition:''}));
 const actor=(label,x,y)=>({id:uid('a'),label,position:label,x,y,path:[],task:'',target:'',secondary:'',gap:'',source:'',steps:steps()});
 function fresh(){return {app:'ol-atolye-editor',version:3,id:uid('workshop'),plays:[],templates:clone(OLTemplates),looks:[],defenders:OLDefense.create(),front:'43over',selectedPlayId:'',selectedLookId:'',ball:'middle',variants:[],legacy:[],trash:[],updatedAt:Date.now()};}
 function newPlay(name){return {id:uid('play'),name,formation:'',notes:'',halfSlide:false,players:[actor('LT',320,330),actor('LG',410,330),actor('C',500,330),actor('RG',590,330),actor('RT',680,330),actor('QB',500,435),actor('RB',550,510)]};}
 function hash(v){let n=2166136261;for(const c of JSON.stringify(v)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);}
 function variantKey(db,p){return p.id+'|'+db.ball+'|'+hash(db.defenders);}
 function migrate(db,old){
  if(!old||old.version!==2||!Array.isArray(old.looks)||old.looks.length>500||!old.looks.every(l=>l&&typeof l==='object'&&typeof l.id==='string'&&typeof l.name==='string'&&Array.isArray(l.defenders)&&l.defenders.length<=50&&new Set(l.defenders.map(d=>d?.id)).size===l.defenders.length&&l.defenders.every(d=>d&&typeof d.id==='string'&&typeof d.label==='string'&&Number.isFinite(d.x)&&Math.abs(d.x)<=440&&Number.isFinite(d.depth)&&d.depth>=0&&d.depth<=20&&['DL','LB','DB'].includes(d.level)&&typeof d.rush==='boolean'&&(!d.twist||Number.isFinite(d.twist.to)))))throw Error('Geçerli eski OL Atölye yedeği değil.');
  const signature=hash(old);if(db.legacy.some(x=>x.signature===signature))return;
  db.legacy.push({id:uid('legacy'),signature,importedAt:Date.now(),data:clone(old)});
  for(const l of old.looks){const nl={...clone(l),id:l.id||uid('look'),defenders:OLDefense.fromLegacy(l.defenders||[]),legacy:clone(l)};if(db.looks.some(x=>x.id===nl.id)){if(JSON.stringify(db.looks.find(x=>x.id===nl.id).legacy)===JSON.stringify(l))continue;nl.id=uid('look');nl.name+=' (eski yedek)';}db.looks.push(nl);}
  if(['left','middle','right'].includes(old.ball))db.ball=old.ball;
 }
 const rec=x=>x&&typeof x==='object'&&!Array.isArray(x), str=x=>typeof x==='string', coord=x=>Number.isFinite(x)&&x>=0&&x<=1000;
 function checkActor(a,def=false){
  if(!rec(a)||!str(a.id)||!str(a.label)||!coord(a.x)||!Number.isFinite(a.y)||a.y<0||a.y>630||!Array.isArray(a.path)||a.path.length>300||!a.path.every(p=>rec(p)&&coord(p.x)&&Number.isFinite(p.y)&&p.y>=0&&p.y<=630&&(!Object.hasOwn(p,'delay')||Number.isFinite(p.delay)&&p.delay>=0&&p.delay<=100)))return false;
  if(def)return ['DL','LB','DB'].includes(a.level)&&typeof a.rush==='boolean';
  return Array.isArray(a.steps)&&a.steps.length<=100&&a.steps.every(s=>rec(s)&&['title','text','direction','target','condition'].every(k=>str(s[k]))&&(s.x===undefined||coord(s.x))&&(s.y===undefined||Number.isFinite(s.y)&&s.y>=0&&s.y<=630))&&['task','target','secondary','gap'].every(k=>str(a[k]));
 }
 const actorsValid=(arr,def=false)=>Array.isArray(arr)&&arr.length<=50&&new Set(arr.map(x=>x?.id)).size===arr.length&&arr.every(a=>checkActor(a,def));
 function validTeaching(p){return (p.emptyTexts===undefined||rec(p.emptyTexts)&&Object.values(p.emptyTexts).every(str))&&(p.emptyCurriculum===undefined||rec(p.emptyCurriculum)&&Object.values(p.emptyCurriculum).every(list=>Array.isArray(list)&&list.length<=100&&list.every(t=>rec(t)&&['title','text','direction','target','condition'].every(k=>str(t[k]))&&['cue','error','check'].every(k=>t[k]===undefined||str(t[k])))));}
 function validate(v){
  return rec(v)&&v.app==='ol-atolye-editor'&&v.version===3&&str(v.id)&&Array.isArray(v.plays)&&v.plays.length<=500&&new Set(v.plays.map(p=>p?.id)).size===v.plays.length&&v.plays.every(p=>rec(p)&&str(p.id)&&str(p.name)&&actorsValid(p.players)&&validTeaching(p))&&Array.isArray(v.looks)&&v.looks.length<=500&&new Set(v.looks.map(l=>l?.id)).size===v.looks.length&&v.looks.every(l=>rec(l)&&str(l.id)&&str(l.name)&&actorsValid(l.defenders,true))&&actorsValid(v.defenders,true)&&['left','middle','right'].includes(v.ball)&&Array.isArray(v.templates)&&v.templates.length<=1000&&new Set(v.templates.map(t=>t?.id)).size===v.templates.length&&v.templates.every(t=>rec(t)&&str(t.id)&&str(t.name)&&Array.isArray(t.steps)&&t.steps.length<=100&&t.steps.every(s=>rec(s)&&['title','text','direction','target','condition'].every(k=>str(s[k]))))&&Array.isArray(v.variants)&&new Set(v.variants.map(a=>a?.id)).size===v.variants.length&&v.variants.every(a=>rec(a)&&str(a.id)&&str(a.playId)&&str(a.key)&&actorsValid(a.players))&&Array.isArray(v.legacy)&&Array.isArray(v.trash);
 }
 function merge(db,incoming){
  if(incoming.version===2){migrate(db,incoming);return;}
  if(!validate(incoming))throw Error('Dosya geçerli bir OL Atölye editör yedeği değil.');
  const wasEmpty=!db.plays.length&&!db.looks.length, remap=new Map(), lookRemap=new Map();
  // Give conflicting imported variants their own playable copy instead of hiding either version.
  const variantConflicts=new Set(incoming.variants.filter(a=>db.variants.some(b=>b.playId===a.playId&&b.key===a.key&&JSON.stringify(b.players)!==JSON.stringify(a.players))).map(a=>a.playId));
  for(const list of ['plays','looks','templates','variants'])for(const raw of incoming[list]){
   const item=clone(raw);if(list==='variants'){item.playId=remap.get(item.playId)||item.playId;item.key=item.playId+item.key.slice(item.key.indexOf('|'));}
   const current=db[list].find(x=>x.id===item.id);
   if(current&&JSON.stringify(current)===JSON.stringify(item)&&!(list==='plays'&&variantConflicts.has(item.id)))continue;
   if(current){const oldId=item.id;item.id=uid(list);if(list==='plays')remap.set(oldId,item.id);if(list==='looks')lookRemap.set(oldId,item.id);if(item.name)item.name+=' (içe aktarılan)';}
   db[list].push(item);
  }
  const incomingDefense=JSON.stringify(incoming.defenders);
  if(incomingDefense!==JSON.stringify(db.defenders)&&!db.looks.some(l=>JSON.stringify(l.defenders)===incomingDefense))db.looks.push({id:uid('look'),name:'Çalışma savunması (içe aktarılan)',front:incoming.front||'43over',defenders:clone(incoming.defenders),updatedAt:Date.now()});
  if(wasEmpty){db.defenders=clone(incoming.defenders);db.front=incoming.front||'43over';db.ball=incoming.ball;db.selectedPlayId=remap.get(incoming.selectedPlayId)||incoming.selectedPlayId||'';db.selectedLookId=lookRemap.get(incoming.selectedLookId)||incoming.selectedLookId||'';}
  for(const a of incoming.legacy)if(!db.legacy.some(b=>b.signature===a.signature))db.legacy.push(clone(a));
  for(const a of incoming.trash)if(!db.trash.some(b=>JSON.stringify(a)===JSON.stringify(b)))db.trash.push(clone(a));
 }
 const emptyTexts={field:'Field yönündeki tehditlere kay. İlk hedef: {target}. {blitz}',combo:'LB blitz yok: center, 1 teknik üzerinde guard ile birlikte çalışır; göz ve gövde LB’ye dönük, ayaklar yeni tehdide hazırdır.',boundary:'Boundary MAN: {target} ile kal. Boundary LB gelse de tackle kendi adamını bırakmaz.',qb:'Empty’de RB yok. Boundary LB baskısını QB kendisi görüp hareket eder. Tehdit: {boundary}. Belirli bir hot rota veya kaçış yönü atanmadı.',receiver:'Rota ve ayrıntılı okuma koçun düzenlediği adımlardadır.'};
 function emptySuggestions(db,p){return OLEmpty.analyze(db,p).jobs;}
 function suggestions(db,p){
  if(p?.emptyProtection)return emptySuggestions(db,p);
  if(!p?.halfSlide)return {};
  const field=db.ball==='right'?'L':'R', side=field==='R'?'sağ':'sol', defs=db.defenders.filter(d=>d.rush), out={},used=new Set();
  const slots=field==='R'?{C:'A',RG:'B',RT:'C'}:{C:'A',LG:'B',LT:'C'};
  // Gap ownership comes from the team's stated rule; matching defenders is only a visual suggestion.
  for(const a of p.players.filter(a=>['LT','LG','C','RG','RT'].includes(a.position))){
   const gap=slots[a.position],gx=500+(field==='R'?1:-1)*({A:45,B:135,C:225}[gap]||0);
   const candidates=defs.filter(d=>!used.has(d.id)&&(!gap||Math.abs(d.x-gx)<75));
   const target=candidates.sort((b,c)=>Math.abs(b.x-(gap?gx:a.x))-Math.abs(c.x-(gap?gx:a.x)))[0];if(target)used.add(target.id);
   out[a.id]={task:gap?`GAP/SLIDE · ${side} ${gap} gap`:'MAN · boundary tarafı',gap:gap?`${side} ${gap}`:'',target:target?.id||'',source:'suggestion'};
  }
  return out;
 }
 return {emptyTexts,emptySuggestions,clone,uid,steps,actor,fresh,newPlay,hash,variantKey,migrate,validate,merge,suggestions};
})();
