import {clamp,noise} from './common.mjs';
import {HEIGHT,HALF,LEFT,RIGHT} from './pong.mjs';

export const PONG_OPPONENTS={
 easy:{delay:20,sample:9,speed:7,lookahead:16,commit:.18,error:60},
 normal:{delay:13,sample:6,speed:9,lookahead:24,commit:.12,error:30},
 hard:{delay:10,sample:5,speed:11,lookahead:26,commit:.08,error:22}
};

// Only past visible ball motion enters the observation buffer. No shot/skill inputs.
export function createPongOpponent(){return {history:[],lastTick:-1,lastRead:-1000,goal:300,observedTick:-1,observedEpoch:-1,phase:'watch'};}
export function pongOpponentInput(s,brain,{side=1,difficulty='easy',policy='rule'}={}){
 const cfg=PONG_OPPONENTS[difficulty]||PONG_OPPONENTS.easy;
 if(s.tick<=brain.lastTick){brain.history=[];brain.lastRead=-1000;brain.goal=s.paddles[side];}
 brain.lastTick=s.tick;brain.history.push({tick:s.tick,ball:[...s.ball],serve:s.serve,epoch:s.epoch});
 while(brain.history.length>48)brain.history.shift();
 const seen=brain.history.findLast(o=>o.tick<=s.tick-cfg.delay);
 if(seen&&s.tick-brain.lastRead>=cfg.sample){
  brain.lastRead=s.tick;brain.observedTick=seen.tick;brain.observedEpoch=seen.epoch;
  const [x,y,vx,vy]=seen.ball,incoming=side===1?vx>0:vx<0,progress=side===1?(x-LEFT)/(RIGHT-LEFT):(RIGHT-x)/(RIGHT-LEFT);
  if(policy==='fixed'){brain.goal=300;brain.phase='center';}
  else if(!seen.serve&&incoming&&progress>=cfg.commit){
   // A short, straight forecast must be corrected after a bounce or a curving shot.
   const until=(side===1?RIGHT-x:LEFT-x)/vx,horizon=Math.max(0,Math.min(cfg.lookahead,until));
   const error=(noise(s.seed,seen.epoch,71+side)-.5)*cfg.error;
   brain.goal=policy==='random'?110+noise(s.seed,seen.epoch,93+side)*380:clamp(y+vy*horizon+error,HALF,HEIGHT-HALF);brain.phase='track';
  }else{brain.goal=300;brain.phase='watch';}
 }
 return clamp(Math.round(s.paddles[side]+clamp(brain.goal-s.paddles[side],-cfg.speed,cfg.speed)),HALF,HEIGHT-HALF);
}

// Expert skills use the same delayed observations as movement. The practice
// opponent stays unchanged, and no human input or armed skill is consulted.
export function pongOpponentAction(s,brain,options={}){
 const target=pongOpponentInput(s,brain,options),side=options.side??1;
 if(s.version<3||options.difficulty!=='hard'||(options.policy??'rule')!=='rule'||s.serve||brain.phase!=='track')return target;
 const seen=brain.history.find(o=>o.tick===brain.observedTick);
 if(!seen||seen.epoch!==s.epoch)return target;
 const [x,,vx]=seen.ball,until=(side===1?RIGHT-x:LEFT-x)/vx;
 if(!(until>0))return target;
 if(Math.abs(brain.goal-s.paddles[side])>100&&until<22&&!s.cooldowns[side].dash)return {target,skill:'dash'};
 if(until<32&&!s.armed[side]){
  const skill=seen.epoch%2?'spin':'power';
  if(!s.cooldowns[side][skill])return {target,skill};
 }
 return target;
}
