/* Editable football field. All coordinates remain in the SVG's 1000 × 630 space. */
class OLField {
  constructor(svgElement, callbacks = {}) {
    this.svg = svgElement;
    this.callbacks = callbacks;
    this.model = null;
    this.drag = null;
    this.svg.setAttribute('viewBox', '0 0 1000 630');
    this.svg.setAttribute('role', 'group');
    this.svg.setAttribute('aria-label', 'Düzenlenebilir Amerikan futbolu sahası');
    this.svg.style.touchAction = 'none';
    this.svg.style.userSelect = 'none';
    this.svg.addEventListener('pointerdown', event => this.pointerDown(event));
    this.svg.addEventListener('pointermove', event => this.pointerMove(event));
    this.svg.addEventListener('pointerup', event => this.pointerUp(event));
    this.svg.addEventListener('pointercancel', event => this.pointerCancel(event));
    this.svg.addEventListener('keydown', event => this.keyDown(event));
  }
  escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  }
  number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  position(event) {
    const matrix = this.svg.getScreenCTM();
    if (!matrix) return {x: 500, y: 300};
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return {x: Math.round(Math.max(22, Math.min(978, transformed.x))), y: Math.round(Math.max(22, Math.min(608, transformed.y)))};
  }
  actors(side) {
    return side === 'defense' ? this.model?.defenders || [] : this.model?.players || [];
  }
  actor(side, id) {
    return this.actors(side).find(actor => actor.id === id);
  }
  callback(name, ...args) {
    if (typeof this.callbacks[name] === 'function') this.callbacks[name](...args);
  }
  animatedPosition(actor, phase, maxPhase) {
    const start = {x: this.number(actor.x, 500), y: this.number(actor.y, 330)};
    const steps = (actor.steps || []).map((step, index) => ({step, index})).filter(item => Number.isFinite(item.step.x) && Number.isFinite(item.step.y));
    const path = (actor.path || []).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    const explicitStart = steps.find(item => item.index === 0)?.step;
    if (phase <= 0 || maxPhase <= 0) return explicitStart ? {x: explicitStart.x, y: explicitStart.y} : start;
    if (!path.length) {
      // Without a drawn path, explicit step coordinates form the movement and
      // the last coordinate is held until another position is supplied.
      const timeline = [{index: 0, step: explicitStart || start}, ...steps.filter(item => item.index > 0)];
      let before = timeline[0];
      for (const item of timeline) {
        if (item.index <= phase) before = item;
        else {
          const ratio = Math.max(0, Math.min(1, (phase - before.index) / Math.max(1, item.index - before.index)));
          return {x: before.step.x + (item.step.x - before.step.x) * ratio, y: before.step.y + (item.step.y - before.step.y) * ratio};
        }
      }
      return {x: before.step.x, y: before.step.y};
    }
    const baseline = at => {
      if (at <= 0) return start;
      if (at >= maxPhase) return {x: path[path.length - 1].x, y: path[path.length - 1].y};
      const nodes = [start, ...path];
      const lengths = path.map((point, index) => Math.hypot(point.x - nodes[index].x, point.y - nodes[index].y));
      const totalLength = lengths.reduce((sum, length) => sum + length, 0) || 1;
      const delays = path.map(point => Math.max(0, this.number(point.delay)));
      const delayTotal = delays.reduce((sum, delay) => sum + delay, 0);
      const delayScale = delayTotal > maxPhase - 0.25 ? (maxPhase - 0.25) / Math.max(0.01, delayTotal) : 1;
      const movementTime = Math.max(0.25, maxPhase - delayTotal * delayScale);
      let cursor = 0;
      for (let index = 0; index < path.length; index++) {
        const from = nodes[index], to = path[index];
        const wait = delays[index] * delayScale;
        if (at <= cursor + wait) return {x: from.x, y: from.y};
        cursor += wait;
        const duration = movementTime * lengths[index] / totalLength;
        if (at <= cursor + duration) {
          const ratio = duration > 0 ? (at - cursor) / duration : 1;
          return {x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio};
        }
        cursor += duration;
      }
      return {x: path[path.length - 1].x, y: path[path.length - 1].y};
    };
    const base = baseline(phase);
    if (!steps.length) return base;
    // Keep the drawn route as the baseline. Exact step positions add a smooth
    // offset between coordinate anchors, returning to the route at its end
    // unless the coach also set an explicit final position.
    const anchors = steps.filter(item => item.index <= maxPhase).map(item => {
      const position = baseline(item.index);
      return {index: item.index, x: item.step.x - position.x, y: item.step.y - position.y};
    });
    if (!anchors.some(anchor => anchor.index === 0)) anchors.unshift({index: 0, x: 0, y: 0});
    if (!anchors.some(anchor => anchor.index === maxPhase)) anchors.push({index: maxPhase, x: 0, y: 0});
    let before = anchors[0];
    for (const anchor of anchors) {
      if (anchor.index <= phase) before = anchor;
      else {
        const ratio = Math.max(0, Math.min(1, (phase - before.index) / Math.max(1, anchor.index - before.index)));
        return {x: base.x + before.x + (anchor.x - before.x) * ratio, y: base.y + before.y + (anchor.y - before.y) * ratio};
      }
    }
    return {x: base.x + before.x, y: base.y + before.y};
  }

  focusIds(model){
    const all=[...(model.players||[]),...(model.defenders||[])],selected=all.find(a=>a.id===model.selectedId),ids=new Set();if(!selected||!model.focus)return new Set(all.map(a=>a.id));ids.add(selected.id);
    const add=a=>{if(a)ids.add(a.id);},near=(list,n)=>[...list].sort((a,b)=>Math.hypot(a.x-selected.x,a.y-selected.y)-Math.hypot(b.x-selected.x,b.y-selected.y)).slice(0,n).forEach(add);
    const offense=model.players||[],defense=model.defenders||[];[selected.target,selected.secondary,...(selected.readTargets||[])].forEach(id=>add(all.find(a=>a.id===id)));
    if(model.selectedSide==='defense'){near(offense,3);near(defense.filter(a=>a.id!==selected.id),2);return ids;}
    offense.filter(a=>['QB','RB','FB'].includes(a.position)).forEach(add);
    if(['LT','LG','C','RG','RT'].includes(selected.position)){offense.filter(a=>['LT','LG','C','RG','RT'].includes(a.position)&&Math.abs(a.x-selected.x)<=105).forEach(add);near(defense.filter(a=>a.level==='LB'),2);near(offense.filter(a=>a.position==='WR'||a.position==='TE'),1);near(defense.filter(a=>a.level==='DL'),1);}
    else if(selected.position==='QB'){offense.forEach(add);defense.filter(a=>a.rush).forEach(add);}
    else if(['RB','FB'].includes(selected.position)){near(offense.filter(a=>['LT','LG','C','RG','RT'].includes(a.position)),3);defense.filter(a=>a.level==='LB').forEach(add);near(offense.filter(a=>['WR','TE'].includes(a.position)),1);}
    else{near(defense,2);near(offense.filter(a=>a.id!==selected.id),1);}
    return ids;
  }
  prepareSimulation(model){
    if(typeof OLSimulation==='undefined'||model.simulation!==true){this.simulation=null;return;}
    const key=JSON.stringify({max:model.maxPhase,actors:[...(model.players||[]),...(model.defenders||[])].map(a=>({id:a.id,x:a.x,y:a.y,position:a.position,level:a.level,rush:a.rush,target:a.target,path:a.path,steps:(a.steps||[]).map(s=>({x:s.x,y:s.y}))}))});
    if(this.simulationKey!==key){this.simulationKey=key;this.simulation=new OLSimulation(model,(actor,phase,max)=>this.animatedPosition(actor,phase,max));}
    else if(!this.simulation)this.simulation=new OLSimulation(model,(actor,phase,max)=>this.animatedPosition(actor,phase,max));
  }
  poses(phase){
    if(this.simulation){this.lastFrame=this.simulation.frame(phase);this.model.onSimulationState?.(this.lastFrame);return this.lastFrame.positions;}
    const all=[...(this.model.players||[]),...(this.model.defenders||[])];return new Map(all.map(a=>[a.id,this.animatedPosition(a,phase,this.model.maxPhase)]));
  }
  paintContacts(positions){
    const contacts=(this.simulation?this.lastFrame?.contacts:[])||[];
    for(let i=0;i<(this.handNodes||[]).length;i++){const node=this.handNodes[i],contact=contacts[Math.floor(i/2)];if(!contact){node.setAttribute('visibility','hidden');continue;}
      const a=positions.get(contact.a),b=positions.get(contact.b),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d,offset=i%2?6:-6;
      for(const [k,v] of Object.entries({x1:a.x+nx*18-ny*offset,y1:a.y+ny*18+nx*offset,x2:b.x-nx*22-ny*offset,y2:b.y-ny*22+nx*offset}))node.setAttribute(k,String(v));node.setAttribute('visibility','visible');
    }
  }
  animate(phase){
    if(!this.model)return;const positions=this.poses(phase);this.paintContacts(positions);
    for(const node of this.actorNodes||[]){const point=positions.get(node.dataset.actorId);if(point)node.setAttribute('transform',`translate(${point.x} ${point.y})`);}
    for(const line of this.targetLines||[]){const a=positions.get(line.dataset.from),b=positions.get(line.dataset.to);if(a&&b)for(const [k,v] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(k,String(v));}
    const selected=positions.get(this.model.selectedId);if(this.gazeNode&&selected)this.gazeNode.setAttribute('transform',`translate(${selected.x} ${selected.y})`);
  }
  render(model) {
    this.model = model;this.prepareSimulation(model);
    const esc = value => this.escape(value);
    const players = model.players || [], defenders = model.defenders || [];
    const phase = this.number(model.phase), maxPhase = Math.max(1, this.number(model.maxPhase, 5));
    const focus=this.focusIds(model);
    const rendered=this.poses(phase);
    let output = `<defs>
      <filter id="ol-context-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter><pattern id="ol-turf" width="1000" height="120" patternUnits="userSpaceOnUse"><rect width="1000" height="60" fill="#102e2c"/><rect y="60" width="1000" height="60" fill="#123330"/></pattern>
      <marker id="ol-arrow-offense" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L7 3 L0 6" fill="none" stroke="#7dd9e4" stroke-width="1.5"/></marker>
      <marker id="ol-arrow-defense" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L7 3 L0 6" fill="none" stroke="#f08485" stroke-width="1.5"/></marker>
      <marker id="ol-arrow-target" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#ffac65" stroke-width="1.3"/></marker>
    </defs><rect width="1000" height="630" fill="url(#ol-turf)" data-field-background="true"/>`;
    for (let y = 60; y < 630; y += 60) {
      output += `<line x1="25" y1="${y}" x2="975" y2="${y}" stroke="#8aafa2" stroke-opacity=".12"/>`;
      for (const x of [180, 820]) output += `<line x1="${x - 6}" y1="${y}" x2="${x + 6}" y2="${y}" stroke="#9dbcae" stroke-opacity=".4" stroke-width="2"/>`;
    }
    output += `<line x1="25" y1="300" x2="975" y2="300" stroke="#e1b46e" stroke-opacity=".65" stroke-dasharray="8 7"/>
      <g fill="#9fb9b0" font-family="system-ui,sans-serif" font-size="11" pointer-events="none"><text x="28" y="38">↑ HÜCUM YÖNÜ</text><text x="28" y="288">LOS</text><text x="30" y="605">Hücumun solu</text><text x="970" y="605" text-anchor="end">Hücumun sağı</text></g>`;
    for (const [x,label] of [[230,'D'],[275,'C'],[365,'B'],[455,'A'],[545,'A'],[635,'B'],[725,'C'],[770,'D']]) {
      const display = label;
      output += `<text x="${x}" y="283" text-anchor="middle" fill="#87a49a" font-size="10" font-family="system-ui,sans-serif" pointer-events="none">${display}</text>`;
    }
    if (model.assignmentsVisible) {
      for (const player of players) {
        const from = rendered.get(player.id);
        for (const [target, secondary] of [[player.target, false], [player.secondary, true]]) {
          const to = rendered.get(target);
          if (to&&(model.focus?focus.has(player.id):true)) output += `<line data-from="${esc(player.id)}" data-to="${esc(target)}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${secondary ? '#b2ce9b' : '#ffac65'}" stroke-opacity=".85" stroke-width="2" stroke-dasharray="${secondary ? '3 6' : '8 5'}" marker-end="url(#ol-arrow-target)" pointer-events="none"/>`;
        }
      }
    }
    if (model.pathsVisible !== false) {
      for (const [side, actors] of [['offense', players], ['defense', defenders]]) {
        for (const actor of actors) {
          const path = actor.path || [];
          if (!path.length) continue;
          const selected = side === model.selectedSide && actor.id === model.selectedId;if(model.focus&&!focus.has(actor.id))continue;
          const coordinates = [actor, ...path].map(point => `${this.number(point.x, 500)},${this.number(point.y, 300)}`).join(' ');
          output += `<polyline points="${coordinates}" fill="none" stroke="${side === 'offense' ? '#7dd9e4' : '#f08485'}" stroke-opacity="${selected ? '.95' : '.5'}" stroke-width="${selected ? '3.5' : '2.3'}" stroke-linejoin="round" stroke-linecap="round" marker-end="url(#ol-arrow-${side})" pointer-events="none"/>`;
        }
      }
    }
    const gaze=rendered.get(model.selectedId);if(model.focus&&gaze)output+=`<g data-gaze="true" transform="translate(${gaze.x} ${gaze.y})" pointer-events="none"><path d="M0 0 L-160 -200 Q0 -310 160 -200 Z" fill="#7dd9e4" opacity=".055" stroke="#7dd9e4" stroke-opacity=".5" stroke-dasharray="6 8"/></g><text x="500" y="26" text-anchor="middle" fill="#c6deda" font-size="11" font-family="system-ui" pointer-events="none">Görev odağı · gerçek görüş / kör nokta ölçümü değildir</text>`;
    output+='<g data-contacts="true" pointer-events="none">'+Array.from({length:48},()=>'<line data-hand-contact="true" stroke="#ffb56f" stroke-width="4" stroke-linecap="round" visibility="hidden"/>').join('')+'</g>';
    const claimed = new Set(players.flatMap(actor => [actor.target, actor.secondary]).filter(Boolean));
    for (const [side, actors] of [['defense', defenders], ['offense', players]]) {
      for (const actor of actors) {
        const selected = side === model.selectedSide && actor.id === model.selectedId;
        const position = rendered.get(actor.id);
        const x = this.number(position.x, 500), y = this.number(position.y, 300);
        const color = side === 'offense' ? '#7dd9e4' : '#f08485';
        const unassigned = side === 'defense' && model.assignmentsVisible && actor.rush && !claimed.has(actor.id);
        output += `<g data-moving="true" data-context="${focus.has(actor.id)?'clear':'blurred'}" ${model.focus&&!focus.has(actor.id)?'filter="url(#ol-context-blur)" opacity="0.22"':''} data-actor-id="${esc(actor.id)}" data-side="${side}" tabindex="0" role="button" aria-label="${side === 'offense' ? 'Hücum' : 'Savunma'} oyuncusu ${esc(actor.label)}${selected ? ', seçili' : ''}" transform="translate(${x} ${y})" style="cursor:${model.mode === 'draw' ? 'crosshair' : 'grab'}">`;
        if (selected) output += '<circle r="28" fill="none" stroke="#ffac65" stroke-width="2" stroke-dasharray="4 3"/>';
        if (unassigned) output += '<circle r="26" fill="none" stroke="#ffac65" stroke-width="1.7"/><text x="24" y="-21" fill="#ffac65" font-size="15" font-family="system-ui,sans-serif">!</text>';
        if (side === 'offense') output += `<circle class="ol-ring" r="19" fill="#173a43" stroke="${color}" stroke-width="2.2"/>`;
        else output += `<path d="M0 -23 L23 19 L-23 19 Z" fill="${actor.rush ? '#683e3e' : '#253d3a'}" stroke="${color}" stroke-width="2"/>`;
        output += `<text text-anchor="middle" y="5" fill="${color}" font-family="system-ui,sans-serif" font-size="${String(actor.label || '').length > 4 ? 10 : 12}" font-weight="700" pointer-events="none">${esc(actor.label || actor.id)}</text></g>`;
      }
    }
    const selected = this.actor(model.selectedSide, model.selectedId);
    if (selected) {
      if (phase > 0) output += `<g transform="translate(${this.number(selected.x)} ${this.number(selected.y)})" data-start="true" data-side="${esc(model.selectedSide)}" data-actor-id="${esc(selected.id)}" style="cursor:grab"><circle r="9" fill="#102d2c" stroke="#ffac65" stroke-dasharray="3 2"/></g>`;
      for (let index = 0; index < (selected.path || []).length; index++) {
        const point = selected.path[index], active = index === model.pointIndex;
        output += `<g data-point-index="${index}" data-side="${esc(model.selectedSide)}" data-actor-id="${esc(selected.id)}" transform="translate(${this.number(point.x)} ${this.number(point.y)})" tabindex="0" role="button" aria-label="Yol noktası ${index + 1}${point.delay ? ', gecikme ' + esc(point.delay) : ''}" style="cursor:${model.mode === 'erase' ? 'not-allowed' : 'grab'}"><circle r="${active ? 13 : 11}" fill="${active ? '#ffac65' : '#132b30'}" stroke="#ffac65" stroke-width="2"/><text text-anchor="middle" y="4" font-size="10" font-family="system-ui,sans-serif" font-weight="700" fill="${active ? '#14252b' : '#ffac65'}" pointer-events="none">${index + 1}</text></g>`;
      }
    }
    if (model.mode === 'draw') output += `<text x="500" y="605" text-anchor="middle" fill="#ffcf9e" font-family="system-ui,sans-serif" font-size="12" pointer-events="none">${selected ? 'Boş alana dokun: yol noktası ekle · Noktaları sürükleyerek düzelt' : 'Yol çizmek için bir oyuncu seç'}</text>`;
    if (model.mode === 'erase') output += '<text x="500" y="605" text-anchor="middle" fill="#ffcf9e" font-family="system-ui,sans-serif" font-size="12" pointer-events="none">Silmek için bir yol noktasına dokun</text>';
    this.svg.innerHTML = output;
    this.actorNodes=this.svg.querySelectorAll?.('[data-moving]')||[];this.targetLines=this.svg.querySelectorAll?.('[data-from]')||[];this.gazeNode=this.svg.querySelector?.('[data-gaze]');this.handNodes=this.svg.querySelectorAll?.('[data-hand-contact]')||[];this.paintContacts(rendered);
  }
  pointerDown(event) {
    if (!this.model || event.button !== 0 && event.button !== undefined) return;
    const element = event.target.closest('[data-actor-id]');
    const position = this.position(event);
    if (element) {
      const side = element.dataset.side, id = element.dataset.actorId;
      const index = element.hasAttribute('data-point-index') ? Number(element.dataset.pointIndex) : null;
      if (index !== null && this.model.mode === 'erase') {
        event.preventDefault();
        this.callback('deletePoint', side, id, index);
        return;
      }
      const actor = this.actor(side, id);
      if (!actor) return;
      const source = index === null ? actor : actor.path[index];
      this.drag = {pointerId: event.pointerId, side, id, index, start: position, startClient: {x: event.clientX, y: event.clientY}, origin: {x: source.x, y: source.y}, current: position, moved: false, element};
    } else if (this.model.mode === 'draw' && this.model.selectedId) {
      this.drag = {pointerId: event.pointerId, add: true, start: position, startClient: {x: event.clientX, y: event.clientY}, current: position, moved: false};
    } else return;
    event.preventDefault();
    try { this.svg.setPointerCapture(event.pointerId); } catch (_) {}
  }
  pointerMove(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const point = this.position(event);
    this.drag.current = point;
    // Measure tap jitter in screen pixels so narrow/mobile SVG scaling does not
    // turn a tiny finger movement into a cancelled tap or accidental drag.
    if (Math.hypot(event.clientX - this.drag.startClient.x, event.clientY - this.drag.startClient.y) > 6) this.drag.moved = true;
    if (!this.drag.moved || this.drag.add) return;
    const x = Math.max(22, Math.min(978, this.drag.origin.x + point.x - this.drag.start.x));
    const y = Math.max(22, Math.min(608, this.drag.origin.y + point.y - this.drag.start.y));
    this.drag.destination = {x: Math.round(x), y: Math.round(y)};
    if (this.drag.element.isConnected) this.drag.element.setAttribute('transform', `translate(${x} ${y})`);
    event.preventDefault();
  }
  pointerUp(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const drag = this.drag;
    this.drag = null;
    try { this.svg.releasePointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
    if (drag.add) {
      if (!drag.moved) this.callback('addPoint', this.model.selectedSide, this.model.selectedId, this.position(event));
      return;
    }
    if (drag.moved && drag.destination) {
      if (this.model.selectedSide !== drag.side || this.model.selectedId !== drag.id) this.callback('select', drag.side, drag.id);
      if (drag.index === null) this.callback('moveActor', drag.side, drag.id, drag.destination.x, drag.destination.y);
      else this.callback('movePoint', drag.side, drag.id, drag.index, drag.destination);
      return;
    }
    if (drag.index !== null) this.callback('pointSelect', drag.index);
    else this.callback('select', drag.side, drag.id);
  }
  pointerCancel(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    this.drag = null;
    if (this.model) this.render(this.model);
  }
  keyDown(event) {
    const element = event.target.closest('[data-actor-id]');
    if (!element) return;
    const side = element.dataset.side, id = element.dataset.actorId;
    const index = element.hasAttribute('data-point-index') ? Number(element.dataset.pointIndex) : null;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (index === null) this.callback('select', side, id);
      else this.callback('pointSelect', index);
    }
    if (index !== null && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      this.callback('deletePoint', side, id, index);
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const actor = this.actor(side, id);
      const point = index === null ? actor : actor?.path?.[index];
      if (!point) return;
      const distance = event.shiftKey ? 10 : 2;
      const next = {x: Math.max(22, Math.min(978, point.x + (event.key === 'ArrowRight' ? distance : event.key === 'ArrowLeft' ? -distance : 0))), y: Math.max(22, Math.min(608, point.y + (event.key === 'ArrowDown' ? distance : event.key === 'ArrowUp' ? -distance : 0)))};
      if (index === null) this.callback('moveActor', side, id, next.x, next.y);
      else this.callback('movePoint', side, id, index, next);
    }
  }
}

if (typeof window !== "undefined") window.OLField = OLField;
