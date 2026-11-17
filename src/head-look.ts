export class HeadLook{
 yaw=0;pitch=0;manual=false;base=0;
 move(dx:number,dy:number,heading:number){if(!Number.isFinite(dx)||!Number.isFinite(dy))return;if(!this.manual){this.base=heading;this.manual=true}this.yaw=Math.max(-1.92,Math.min(1.92,this.yaw+dx*.003));this.pitch=Math.max(-1.05,Math.min(.87,this.pitch-dy*.003))}
 reset(){this.yaw=0;this.pitch=0;this.manual=false;this.base=0}
 heading(automatic:number){return this.manual?this.base+this.yaw:automatic}
}
export function verticalFov(horizontal:number,aspect:number){return Math.max(45,Math.min(90,2*Math.atan(Math.tan(horizontal*Math.PI/360)/Math.max(.3,aspect))*180/Math.PI))}
