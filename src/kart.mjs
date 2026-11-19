import {clamp,noise,fingerprint} from './common.mjs';

export const KART_DT=1/60, SEGMENT=24;
const sections={harbor:[[36,0],[28,.85],[24,0],[32,-.7],[20,0],[30,-1],[24,.65],[24,0]],ridge:[[24,0],[30,1.1],[16,-.9],[30,1.25],[24,0],[32,-1.15],[24,.8],[30,0]]};
export const TRACKS=Object.freeze(Object.fromEntries(Object.entries(sections).map(([id,parts])=>{
 const segments=[];
 for(const [count,curve] of parts)for(let i=0;i<count;i++)segments.push({curve:curve*Math.min(1,(i+1)/6,(count-i)/6)});
 return [id,{id,name:id==='harbor'?'晴湾环岛':'云岭弯道',description:id==='harbor'?'宽弯 · 初次上路':'连续弯 · 漂移挑战',segments,length:segments.length*SEGMENT,laps:2}];
})));
export const curveAt=(track,z)=>track.segments[((Math.floor(z/SEGMENT)%track.segments.length)+track.segments.length)%track.segments.length].curve;
export function createKart({track='harbor',difficulty='practice',seed=41003}={}){
 if(!TRACKS[track]||!['practice','standard'].includes(difficulty))throw Error('未知赛道或难度');
 return {version:1,track,difficulty,seed:seed>>>0,tick:0,time:0,phase:'countdown',countdown:3,finishTime:null,rank:null,events:[],cars:['你','橘子','晴空','薄荷'].map((name,i)=>({id:i,name,z:i?-i*18:0,x:[-.25,.3,-.45,.55][i],speed:0,slip:0,drifting:false,drift:0,drifts:0,meter:0,nitro:0,boost:0,mini:0,cooldown:0,finishTime:null,collisions:0}))};
}
export function kartInput(input={}){return {steer:clamp(Number(input.steer)||0,-1,1),gas:!!input.gas,brake:!!input.brake,drift:!!input.drift,boost:!!input.boost};}
export function kartAI(state,id){
 const c=state.cars[id],track=TRACKS[state.track],curve=curveAt(track,c.z),ahead=curveAt(track,c.z+170);
 let lane=[-.45,.1,.52,-.1][id]+(noise(state.seed,Math.floor(c.z/800),id)-.5)*.12;
 const front=state.cars.filter(v=>v.id!==id&&v.z>c.z&&v.z-c.z<100&&Math.abs(v.x-c.x)<.35).sort((a,b)=>a.z-b.z)[0];
 if(front)lane=front.x>.05?front.x-.48:front.x+.48;
 const factor=c.speed/260,steer=clamp(curve*factor*.66+(lane-c.x)*1.9-c.slip*.3,-1,1);
 const target=(state.difficulty==='practice'?207:251)-Math.abs(ahead)*26+id*2;
 return {steer,gas:c.speed<target,brake:c.speed>target+22,drift:Math.abs(curve)>.5&&Math.sign(curve)===Math.sign(steer)&&c.speed>115,boost:Math.abs(ahead)<.2&&c.nitro>0};
}
export function kartRank(state,id=0){return [...state.cars].sort((a,b)=>(a.finishTime??Infinity)-(b.finishTime??Infinity)||b.z-a.z||a.id-b.id).findIndex(c=>c.id===id)+1;}
export function stepKart(state,input={}){
 if(state.phase==='finished')return state;
 const s={...state,tick:state.tick+1,events:[],cars:state.cars.map(c=>({...c}))};
 if(s.countdown>0){s.countdown=Math.max(0,3-s.tick*KART_DT);if(s.countdown===0){s.phase='racing';s.events.push('go');}return s;}
 s.time=state.time+KART_DT;
 const track=TRACKS[s.track],finish=track.length*track.laps;
 for(const c of s.cars){
  if(c.finishTime!==null)continue;
  const action=c.id?kartAI(state,c.id):kartInput(input),oldSpeed=c.speed,curve=curveAt(track,c.z),wasDrifting=c.drifting;
  c.cooldown=Math.max(0,c.cooldown-KART_DT);c.boost=Math.max(0,c.boost-KART_DT);c.mini=Math.max(0,c.mini-KART_DT);
  if(action.boost&&c.nitro>0&&c.boost===0){c.nitro--;c.boost=2.2;if(!c.id)s.events.push('boost');}
  c.drifting=action.drift&&Math.abs(action.steer)>.15&&c.speed>95;
  const speedRatio=c.speed/260,desiredSlip=action.steer*(c.drifting?1.35:.75);
  c.slip+=(desiredSlip-c.slip)*KART_DT*(c.drifting?3.4:9);
  c.x+=(c.slip-curve*speedRatio*.5)*speedRatio*KART_DT*1.9;
  const offroad=Math.abs(c.x)>1;
  const max=c.boost>0?335:c.mini>0?295:260;
  c.speed=clamp(c.speed+(action.gas?83: -32)*KART_DT-(action.brake?175*KART_DT:0)-(c.drifting?24*KART_DT:0)-(offroad?150*KART_DT:0),0,max);
  if(Math.abs(c.x)>1.32){c.x=clamp(c.x,-1.32,1.32);c.slip*=.6;c.speed=Math.min(c.speed,110);if(!c.cooldown){c.collisions++;c.cooldown=.65;if(!c.id)s.events.push('wall');}c.drift=0;}
  // Charge requires an actual corner, speed and staying on the road. Straight weaving is not fuel.
  if(c.drifting&&!offroad&&Math.abs(curve)>.25&&Math.sign(curve)===Math.sign(action.steer))c.drift+=KART_DT*(.28+Math.abs(curve)*.18);
  if(wasDrifting&&!c.drifting){
   if(c.drift>=.18&&!offroad){c.mini=.65;c.drifts++;c.meter+=Math.min(.8,c.drift);while(c.meter>=1&&c.nitro<2){c.meter--;c.nitro++;}c.meter=Math.min(.99,c.meter);if(!c.id)s.events.push('drift');}
   c.drift=0;
  }
  c.z+=Math.max(0,(oldSpeed+c.speed)/2)*KART_DT;
  if(c.z>=finish){c.finishTime=s.time;c.z=finish;}
 }
 // Cars share the road; contact costs momentum but never traps a car in a wall.
 for(let i=0;i<s.cars.length;i++)for(let j=i+1;j<s.cars.length;j++){
  const a=s.cars[i],b=s.cars[j];if(a.finishTime!==null||b.finishTime!==null||Math.abs(a.z-b.z)>10||Math.abs(a.x-b.x)>.19||a.cooldown||b.cooldown)continue;
  const sign=a.x>=b.x?1:-1;a.x=clamp(a.x+sign*.09,-1.3,1.3);b.x=clamp(b.x-sign*.09,-1.3,1.3);a.speed*=.86;b.speed*=.86;a.cooldown=b.cooldown=.7;
  if(!i){a.collisions++;s.events.push('contact');}
 }
 if(s.cars[0].finishTime!==null||s.time>=180){s.phase='finished';s.finishTime=s.cars[0].finishTime;s.rank=kartRank(s);s.events.push('finish');}
 return s;
}
export function sealKart(initial,inputs,state){return {format:'kart-1',game:'kart',options:initial,inputs,end:{tick:state.tick,hash:fingerprint(state)}};}
export function replayKart(record){
 if(record?.format!=='kart-1'||record.game!=='kart'||!Array.isArray(record.inputs)||record.inputs.length>12000||!Number.isInteger(record.end?.tick)||record.end.tick<0||record.end.tick>11000)throw Error('无效赛车回放');
 let state=createKart(record.options),input=kartInput(),cursor=0,previous=-1;
 for(const row of record.inputs){if(!Number.isInteger(row.tick)||row.tick<0||row.tick<=previous||row.tick>=record.end.tick)throw Error('无效赛车操作');previous=row.tick;}
 while(state.tick<record.end.tick){if(record.inputs[cursor]?.tick===state.tick)input=kartInput(record.inputs[cursor++].input);const next=stepKart(state,input);if(next===state)throw Error('终点后的操作');state=next;}
 if(fingerprint(state)!==record.end.hash)throw Error('赛车回放校验失败');return state;
}
