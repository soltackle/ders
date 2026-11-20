import type {ScenarioType} from './model.ts';
export function mountDefenseEdit(host:HTMLElement,api:{get:()=>{scenario:ScenarioType;selected:string};set:(s:ScenarioType)=>void;select:(id:string)=>void;subscribe:(f:()=>void)=>void;pick?:(done:(at:[number,number])=>void)=>void}){
 host.className='defense-edit-panel';host.innerHTML=`<details><summary>Defansı düzenle</summary><p>Sahadaki savunmacıya tıkla veya listeden seç.</p><label>Savunmacı<select data-def-player></select></label><label>Görev<select data-def-coverage><option value="auto">Otomatik / takım çağrısı</option><option value="man">Adam coverage</option><option value="zone">Bölge coverage</option><option value="rush">Rush / blitz</option><option value="hold">Yerinde kal</option></select></label><label>Takip edeceği oyuncu<select data-def-target></select></label><label>Coverage bölgesi X / Z<input data-def-zone-x type="number" step=".1"><input data-def-zone-z type="number" step=".1"></label><button data-def-pick-zone>Sahadan coverage bölgesi seç</button><label><input data-def-move type="checkbox">Snap öncesi hareket</label><label>Snap öncesi varış X / Z<input data-def-pre-x type="number" step=".1"><input data-def-pre-z type="number" step=".1"></label><button data-def-pick-pre>Snap öncesi varışı sahadan seç</button><p>X / Z saha koordinatlarıdır; hücum çizgisi Z = 0. Noktayı sahadan da seçebilirsin.</p><button data-def-save>Seçili savunmacıya uygula</button><p data-def-status role="status"></p></details>`;
 const q=(key:string)=>host.querySelector<HTMLInputElement&HTMLSelectElement>(`[data-def-${key}]`)!;
 let last:ScenarioType|undefined,selected='';
 function render(){const {scenario:s,selected:id}=api.get();if(s===last&&id===selected)return;last=s;selected=id;const defs=s.players.filter(p=>p.side==='DEF');const current=defs.find(p=>p.id===id)??defs[0];if(!current)return;
 q('player').replaceChildren(...defs.map(p=>Object.assign(document.createElement('option'),{value:p.id,textContent:`${p.id} · ${p.pos}`})));q('player').value=current.id;
 q('target').replaceChildren(...s.players.filter(p=>p.side==='OFF'&&!['LT','LG','C','RG','RT'].includes(p.pos)).map(p=>Object.assign(document.createElement('option'),{value:p.id,textContent:`${p.id} · ${p.pos}`})));
 const e=s.defenseEdits?.[current.id];q('coverage').value=e?.coverage??'auto';q('target').value=e?.target??q('target').options[0]?.value??'';
 q('zone-x').value=String(e?.zone?.[0]??current.at[0]);q('zone-z').value=String(e?.zone?.[1]??Math.max(4,current.at[1]));q('move').checked=!!e?.preSnap;
 q('pre-x').value=String(e?.preSnap?.[0]??current.at[0]);q('pre-z').value=String(e?.preSnap?.[1]??current.at[1]);
 enableFields();if(defs.some(p=>p.id===id))host.querySelector('details')!.open=true;
 }
 function enableFields(){const man=q('coverage').value==='man',zone=q('coverage').value==='zone';q('target').disabled=!man;for(const key of ['zone-x','zone-z'])q(key).disabled=!zone;for(const key of ['pre-x','pre-z'])q(key).disabled=!q('move').checked;}
 q('coverage').onchange=enableFields;q('move').onchange=enableFields;
 for(const kind of ['zone','pre'] as const){const button=host.querySelector<HTMLButtonElement>(`[data-def-pick-${kind}]`)!;button.hidden=!api.pick;button.onclick=()=>{q('status').textContent='Sahada varış noktasına tıkla; sonra seçili savunmacıya uygula.';api.pick?.(at=>{q(`${kind}-x`).value=String(Math.round(at[0]*10)/10);q(`${kind}-z`).value=String(Math.round(at[1]*10)/10);if(kind==='pre')q('move').checked=true;else q('coverage').value='zone';enableFields();q('status').textContent='Nokta seçildi. Seçili savunmacıya uygula.';});};}
 q('player').onchange=()=>api.select(q('player').value);
 host.querySelector<HTMLButtonElement>('[data-def-save]')!.onclick=()=>{const s=structuredClone(api.get().scenario),id=q('player').value;const nums=['zone-x','zone-z','pre-x','pre-z'].map(k=>Number(q(k).value));if(!nums.every(Number.isFinite)){q('status').textContent='Geçerli koordinat gir.';return;}
 const center=s.hash==='left'?5:s.hash==='right'?-5:0;const valid=(x:number,z:number)=>x>=center-24.08&&x<=center+24.08&&z>=-29.68&&z<=69.68;
 if((q('coverage').value==='zone'&&!valid(nums[0],nums[1]))||(q('move').checked&&!valid(nums[2],nums[3]))){q('status').textContent='Saha sınırları içinde bir nokta seç.';return;}
 s.defenseEdits??={};s.defenseEdits[id]={coverage:q('coverage').value as 'auto'|'man'|'zone'|'rush'|'hold',target:q('target').value,zone:[nums[0],nums[1]],preSnap:q('move').checked?[nums[2],nums[3]]:undefined};
 const p=s.players.find(p=>p.id===id);if(p)p.intent=q('coverage').value==='rush'?'blitz':q('coverage').value==='hold'?'hold':'auto';api.set(s);q('status').textContent=`${id} görevi ve snap öncesi hareketi kaydedildi.`;};
 api.subscribe(render);render();
}
