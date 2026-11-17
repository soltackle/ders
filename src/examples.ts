import {createFieldZone} from './zone.ts';
import {Scenario,type ScenarioType} from './model.ts';
import {protectionFront} from './protection.ts';
const base:ScenarioType={version:1,name:'Pas koruması',scheme:'Takım pas koruması',hash:'left',fieldSide:'right',blitz:'none',players:[...(['LT','LG','C','RG','RT'] as const).map((id,i)=>({id,pos:id,side:'OFF' as const,at:[(i-2)*1.2,0] as [number,number],stance:'3pt' as const})),{id:'QB',pos:'QB',side:'OFF',at:[0,-4],stance:'2pt'},{id:'RB',pos:'RB',side:'OFF',at:[.8,-2.5],stance:'2pt'}],actions:[],steps:[{title:'Savunmayı yerleştir',start:0,end:2.8,description:'DL’leri yerleştir; savunma panelinden blitz seç ve Oynat’a bas.',notes:{},focus:[]}]};
export function defaultProtection(){const s=protectionFront(base,4);s.name='Pas koruması';return Scenario.parse(s)}
export function defaultFieldZone(){return createFieldZone(defaultProtection())}
export const examples:ScenarioType[]=[defaultProtection(),defaultFieldZone()];
