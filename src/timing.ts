import type {ScenarioType} from './model.ts';
export const protectionTiming={snap:1.1,minimumSet:1.6,rbRead:.2,anchor:2.8,rbMaxSpeed:3,olMaxSpeed:1.7,centerMaxSpeed:1.8};
export function travelDuration(length:number,maxSpeed:number){return Math.max(.35,1.5*length/maxSpeed)}
export const playbackSpeeds=[.25,.5,.75,1,1.5] as const;
export function initialPlaybackSpeed(value:string|null){const n=Number(value);return value!==null&&playbackSpeeds.some(x=>x===n)?n:.5}
export type PlaybackState={time:number;step:number;playing:boolean};
export function advancePlayback(s:ScenarioType,state:PlaybackState,delta:number,full:boolean,loop:boolean):PlaybackState{
 if(!state.playing||delta<=0)return state;let time=state.time+delta,step=state.step;for(let guard=0;guard<100;guard++){const current=s.steps[step];if(time<current.end)return {time,step,playing:true};const excess=time-current.end;if(current.decision)return {time:current.end,step,playing:false};if(full&&step<s.steps.length-1){step++;time=s.steps[step].start+excess;continue}if(loop){step=full?0:step;time=s.steps[step].start+excess;continue}return {time:current.end,step,playing:false}}return {time:s.steps[step].start,step,playing:true}
}
export function atEnd(s:ScenarioType,time:number){return time>=Math.max(...s.steps.map(x=>x.end))-.001}
