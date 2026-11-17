'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const c=vm.createContext({});for(const f of ['templates','defense','model','technique','empty','simulation','field'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f+'.js'),'utf8'),c);
const {Sim,Field,D,M,E}=vm.runInContext('({Sim:OLSimulation,Field:OLField,D:OLDefense,M:OLModel,E:OLEmpty})',c);
const svg={style:{},setAttribute(){},addEventListener(){}};const field=new Field(svg);
const sample=(a,p,m)=>field.animatedPosition(a,p,m);
function distances(sim,frame){const all=sim.actors;for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=frame.positions.get(all[i].id),b=frame.positions.get(all[j].id);const min=sim.bodies[i].radius+sim.bodies[j].radius;assert(Math.hypot(a.x-b.x,a.y-b.y)>=min-.03,`${all[i].id}/${all[j].id} overlap at ${frame.phase}`);}}
const ol={id:'C',label:'C',position:'C',x:500,y:330,target:'N',steps:[{x:500,y:330},{x:500,y:345},{x:500,y:350},{x:500,y:355},{x:500,y:360},{x:500,y:365}],path:[]};
const dl={id:'N',label:'N',level:'DL',x:500,y:250,rush:true,path:[{x:500,y:450}]};
const model={players:[ol],defenders:[dl],maxPhase:5};const before=JSON.stringify(model),sim=new Sim(model,sample);let contacted=false;
for(let i=1;i<=600;i++){const f=sim.frame(i/120);distances(sim,f);assert(f.positions.get('N').y<f.positions.get('C').y,'rusher passes through blocker');if(f.contacts.length)contacted=true;}
assert(contacted);assert(sim.frame(.5).positions.get('C').y>330,'OL must set backward, not charge DL');assert.equal(JSON.stringify(model),before);
const end=JSON.stringify([...sim.frame(5).positions]);sim.frame(.1);assert.equal(JSON.stringify([...sim.frame(5).positions]),end,'seek must be deterministic');
const camera=sim.cameraAnchor('C',3);assert.equal(camera.position.y,65);assert(Number.isFinite(camera.heading));assert(sim.frame(5).world.every(a=>a.collider.radius>0&&a.collider.height>0));
console.log('PASS set, persistent nonpenetration, contact, pressure, deterministic seek, input preservation and future camera state');
for(const front of D.fronts())for(const ball of ['left','middle','right'])for(const move of ['straight','slantL','et','overload']){
 const db=M.fresh(),p=E.newPlay();db.ball=ball;db.defenders=D.movement(D.create(front.id),move);const jobs=E.analyze(db,p).jobs;
 const model={players:p.players.map(a=>({...a,...jobs[a.id]})),defenders:db.defenders,maxPhase:5},s=new Sim(model,sample);
 for(let phase=.1;phase<=5;phase+=.1)distances(s,s.frame(phase));
}
console.log('PASS 108 front/hash/rush scenes across the full timeline with no overlapping bodies');
const bypass={...dl,path:[{x:620,y:275},{x:620,y:430},{x:500,y:460}]};const side=new Sim({players:[ol],defenders:[bypass],maxPhase:5},sample);const b=side.frame(4);distances(side,b);assert(b.positions.get('N').y>b.positions.get('C').y,'unblocked edge path should remain a real threat');
const fast=new Sim({players:[{...ol,x:200,y:330,path:[{x:800,y:330}],steps:[]}],defenders:[{...dl,x:800,y:330,path:[{x:200,y:330}]}],maxPhase:1},sample);for(let i=1;i<=120;i++){const f=fast.frame(i/120);distances(fast,f);assert(f.positions.get('C').x<f.positions.get('N').x,'fast bodies tunnel');}
console.log('PASS edge bypass allowed and high-speed head-on movement cannot tunnel');
