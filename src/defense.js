/* Generic defensive examples. Every alignment, rush flag and path remains editable. */
const OLDefense = (() => {
  const copy = v => JSON.parse(JSON.stringify(v));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const techX = {'0':0,'1':35,'1i':18,'2i':62,'2':90,'3':125,'3i':108,'4i':153,'4':180,'5':215,'6':245,'7':260,'9':300};
  const frontNames = [
    ['43over','4–3 Over'], ['43under','4–3 Under'], ['425','4–2–5'],
    ['34','3–4'], ['33stack','3–3 Stack'], ['tite','3–3 Tite'],
    ['bear','Bear'], ['52','5–2'], ['goalline','Goal-line 6–2']
  ];
  const moveNames = [
    ['straight','Düz rush'],['slantL','Sola slant'],['slantR','Sağa slant'],
    ['pinch','Pinch / içe'],['widen','Dışa açılma'],['et','E–T stunt'],
    ['tt','T–T stunt'],['lbblitz','Gecikmeli LB blitz'],['overload','Sağ overload'],
    ['clear','Bütün yolları sil']
  ];
  function make(id,label,level,offset,depth,tech='') {
    return {id,label,level,x:500+offset,y:Math.max(43,300-depth*24),depth,tech:String(tech),side:offset<0?'L':'R',rush:level==='DL',path:[]};
  }
  const dl = (id,label,side,tech) => make(id,label,'DL',(side==='L'?-1:1)*techX[tech],1.3,tech);
  const lb = (id,label,x,depth=4.6) => make(id,label,'LB',x,depth);
  const db = (id,label,x,depth=8) => make(id,label,'DB',x,depth);
  const secondary = () => [db('CL','CB-L',-390,6),db('CR','CB-R',390,6),db('SS','SS',220,10),db('FS','FS',-40,13)];
  function create(frontId='43over') {
    const aliases={over:'43over',under:'43under',even:'425',odd:'34',stack:'33stack',five:'52',six:'goalline'};
    frontId=aliases[frontId]||frontId;
    let a;
    if (['43over','43under','425'].includes(frontId)) {
      a=frontId==='43under'
        ? [dl('EL','E-L','L',5),dl('T','T','L',3),dl('N','N','R',1),dl('ER','E-R','R',5)]
        : [dl('EL','E-L','L',5),dl('N','N','L',1),dl('T','T','R',3),dl('ER','E-R','R',5)];
      if(frontId==='425')a.push(lb('M','M',-65),lb('S','S',100),db('W','NICKEL',-270,4),...secondary());
      else a.push(lb('W','W',-155),lb('M','M',0),lb('S','S',190),...secondary());
    } else if (['34','33stack','tite'].includes(frontId)) {
      const t=frontId==='tite'?'4i':'4';
      a=[dl('EL','E-L','L',t),dl('N','N','R',0),dl('ER','E-R','R',t)];
      if(frontId==='34')a.push(lb('W','W',-290,1.5),lb('M','M',-75),lb('S','S',75),lb('J','J',290,1.5),...secondary());
      else a.push(lb('W','W',-165),lb('M','M',0),lb('S','S',165),db('J','STAR',285,4),...secondary());
    } else if (['bear','52'].includes(frontId)) {
      const t=frontId==='bear'?'3':'4i';
      a=[dl('EL','E-L','L',5),dl('TL','T-L','L',t),dl('N','N','R',0),dl('TR','T-R','R',t),dl('ER','E-R','R',5),lb('M','M',-75),lb('S','S',90),...secondary()];
    } else if(frontId==='goalline') {
      a=[dl('OL','E-L','L',7),dl('EL','T-L','L',5),dl('TL','G-L','L','2i'),dl('TR','G-R','R','2i'),dl('ER','T-R','R',5),dl('OR','E-R','R',7),lb('M','M',-70,3),lb('S','S',70,3),db('CL','CB-L',-385,3),db('CR','CB-R',385,3),db('FS','FS',0,8)];
    } else return create('43over');
    return movement(a,'straight');
  }
  const point = (x,y,delay) => ({x:clamp(x,15,985),y:clamp(y,15,615),...(delay?{delay}: {})});
  function rushPath(d,dx=0) {
    return [point(d.x+dx*.3,d.y+28),point(d.x+dx,310),point(d.x+dx,400)];
  }
  function movement(defenders,kind='straight') {
    const a=copy(defenders);
    if(kind==='clear'){a.forEach(d=>d.path=[]);return a;}
    a.forEach(d=>{
      if(!d.rush){d.path=[];return;}
      const dx=kind==='slantL'?-90:kind==='slantR'?90:kind==='pinch'?-Math.sign(d.x-500)*75:kind==='widen'?Math.sign(d.x-500)*80:0;
      d.path=rushPath(d,dx);
    });
    function twist(outside,inside) {
      if(!outside||!inside)return;
      outside.rush=true;inside.rush=true;
      const sign=Math.sign(outside.x-500)||1;
      outside.path=[point(outside.x, outside.y+24),point(inside.x,310),point(inside.x-sign*20,385)];
      inside.path=[point(inside.x,inside.y-10),point(inside.x+sign*45,inside.y-25,0.25),point(outside.x+sign*35,310),point(outside.x+sign*35,405)];
    }
    const line=a.filter(d=>d.level==='DL').sort((x,y)=>x.x-y.x);
    if(kind==='et') {
      const right=line.filter(d=>d.x>500);
      const left=line.filter(d=>d.x<500);
      if(right.length>=2)twist(right[right.length-1],right[right.length-2]);
      else if(left.length>=2)twist(left[0],left[1]);
    }
    if(kind==='tt') {
      const inner=[...line].sort((x,y)=>Math.abs(x.x-500)-Math.abs(y.x-500));
      if(inner.length>=2)twist(inner[0],inner[1]);
    }
    if(kind==='lbblitz') {
      const d=a.filter(d=>d.level==='LB').sort((x,y)=>Math.abs(x.x-500)-Math.abs(y.x-500))[0];
      if(d){d.rush=true;d.path=[point(d.x,d.y,0.5),point(d.x,275),point(535,340),point(535,430)];}
    }
    if(kind==='overload') {
      const lbs=a.filter(d=>d.level==='LB').slice(0,2);
      lbs.forEach((d,i)=>{d.x=735+i*70;d.y=265;d.depth=(300-d.y)/24;d.side='R';d.rush=true;d.path=[point(d.x,300),point(680+i*60,365),point(600+i*75,440)];});
    }
    return a;
  }
  function legacyPath(d,x,y) {
    const move=d.move||'straight';
    if(move==='drop')return [point(x,y-35),point(x+(d.side==='L'?-45:45),Math.max(35,y-100))];
    if(!d.rush)return [];
    let endX=x;
    if(d.twist&&Number.isFinite(Number(d.twist.to)))endX=500+Number(d.twist.to);
    else if(move==='left')endX-=90;
    else if(move==='right')endX+=90;
    else if(move==='pinch')endX-=Math.sign(x-500)*78;
    else if(move==='wide')endX+=Math.sign(x-500)*78;
    else if(move==='loopLeft')endX-=140;
    else if(move==='loopRight')endX+=140;
    const loop=d.twist?.kind==='looper'||move.startsWith('loop');
    const delay=move==='delay'?.5:undefined;
    return [point(x+(endX-x)*.18,y+17,delay),point(x+(endX-x)*.43,y+(loop?-5:25)),point(x+(endX-x)*.8,302),point(endX,375),point(endX,445)];
  }
  function fromLegacy(defenders) {
    if(!Array.isArray(defenders))return [];
    return defenders.map((old,i)=>{
      const d=copy(old);
      const x=clamp(500+Number(d.x||0),15,985), y=clamp(Math.max(43,300-Number(d.depth||0)*24),15,615);
      let path;
      if(Array.isArray(d.path))path=d.path.map(p=>Array.isArray(p)?point(500+Number(p[0]),p[1]):point(500+Number(p.x||0),p.y,p.delay));
      else path=legacyPath(d,x,y);
      return {...d,id:String(d.id||'legacy-'+i),label:String(d.label||d.id||'D'+(i+1)),level:['DL','LB','DB'].includes(d.level)?d.level:'DL',x,y,side:d.side==='L'?'L':'R',tech:String(d.tech??''),rush:!!d.rush,path,legacy:copy(old)};
    });
  }
  return {fronts:()=>frontNames.map(([id,name])=>({id,name})),moves:()=>moveNames.map(([id,name])=>({id,name})),create,movement,fromLegacy,techX};
})();
