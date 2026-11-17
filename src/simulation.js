/* Renderer-independent deterministic planar contact model. Diagram units, not calibrated athlete biomechanics. */
class OLSimulation {
  constructor(model,sample){
    this.model=model;this.sample=sample;this.rate=60;this.max=Math.max(1,model.maxPhase||5);
    this.actors=[...(model.players||[]).map(a=>({...a,side:'offense'})),...(model.defenders||[]).map(a=>({...a,side:'defense'}))];
    this.bodies=this.actors.map(a=>({id:a.id,radius:a.level==='DL'?24:20,mass:['LT','LG','C','RG','RT'].includes(a.position)?12:a.level==='DL'?8:6,height:72}));
    this.frames=[this.actors.map(a=>({...sample(a,0,this.max)}))];
  }
  resolve(points){
    for(let iteration=0;iteration<36;iteration++){
      let worst=0;
      for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
        const a=points[i],b=points[j],aa=this.bodies[i],bb=this.bodies[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const minimum=aa.radius+bb.radius;
        if(d>=minimum)continue;const overlap=minimum-d;worst=Math.max(worst,overlap);
        if(d<1e-8){dx=i%2?1:-1;dy=0;d=1;}const nx=dx/d,ny=dy/d,wa=1/aa.mass,wb=1/bb.mass,total=wa+wb;
        a.x-=nx*(overlap+.00001)*wa/total;a.y-=ny*(overlap+.00001)*wa/total;b.x+=nx*(overlap+.00001)*wb/total;b.y+=ny*(overlap+.00001)*wb/total;
      }
      if(worst<.0001)break;
    }
    return points;
  }
  ensure(index){
    while(this.frames.length<=index){
      const step=this.frames.length,previous=this.frames[step-1],phase=Math.min(this.max,step/this.rate);
      const points=this.actors.map((a,i)=>{const desired=this.sample(a,phase,this.max),old=previous[i];let dx=desired.x-old.x,dy=desired.y-old.y;const d=Math.hypot(dx,dy),cap=6;if(d>cap){dx*=cap/d;dy*=cap/d;}return {x:old.x+dx,y:old.y+dy};});
      this.frames.push(this.resolve(points));
    }
  }
  frame(phase){
    const time=Math.max(0,Math.min(this.max,Number(phase)||0))*this.rate,index=Math.floor(time),fraction=time-index;
    this.ensure(index+(fraction>1e-9?1:0));let points=this.frames[index].map((p,i)=>{const next=this.frames[index+1]?.[i]||p;return{x:p.x+(next.x-p.x)*fraction,y:p.y+(next.y-p.y)*fraction};});
    if(time>0)this.resolve(points);
    const positions=new Map(this.actors.map((a,i)=>[a.id,points[i]])),contacts=[],states=new Map();
    for(let i=0;i<this.actors.length;i++){
      const a=this.actors[i],p=points[i],desired=this.sample(a,phase,this.max);let state=phase===0?'Hiza':a.side==='offense'&&['LT','LG','C','RG','RT'].includes(a.position)?'Set':'Hareket';
      for(let j=0;j<this.actors.length;j++){
        const b=this.actors[j];if(a.side===b.side)continue;
        const q=points[j],distance=Math.hypot(q.x-p.x,q.y-p.y);
        if(distance<=this.bodies[i].radius+this.bodies[j].radius+.4&&phase>0){state=p.y>desired.y+7&&a.side==='offense'?'Geri itilme':'Temas / dengede';if(i<j)contacts.push({a:a.id,b:b.id,point:{x:(p.x+q.x)/2,y:(p.y+q.y)/2},normal:{x:(q.x-p.x)/(distance||1),y:(q.y-p.y)/(distance||1)}});}
      }
      if(a.side==='offense'&&a.target){const target=positions.get(a.target);if(target&&target.y>p.y+this.bodies[i].radius+20&&Math.abs(target.x-p.x)>40)state='Kenar kaybı';}
      states.set(a.id,state);
    }
    const world=this.actors.map((a,i)=>{const p=points[i],target=positions.get(a.target);return {id:a.id,side:a.side,position:{x:p.x,y:0,z:p.y},heading:target?Math.atan2(target.x-p.x,p.y-target.y):a.side==='offense'?0:Math.PI,collider:{type:'upright',radius:this.bodies[i].radius,height:this.bodies[i].height},state:states.get(a.id)};});
    return {phase,positions,contacts,states,world};
  }
  cameraAnchor(id,phase){const actor=this.frame(phase).world.find(a=>a.id===id);return actor?{position:{...actor.position,y:65},heading:actor.heading}:null;}
}
