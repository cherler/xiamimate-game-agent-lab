import { clamp, leading, noise } from './common.mjs';
export const WIDTH=1000, HEIGHT=600, HALF=53, RADIUS=9, LEFT=47, RIGHT=WIDTH-LEFT;
export const PONG_LIMIT=7200, TACTICS=['upper','lower','steady','change'];

export const PONG_SKILLS={dash:{name:'冲刺',cooldown:180,duration:18},power:{name:'快球',cooldown:240},spin:{name:'旋球',cooldown:210}};
export function initPong(seed,{legacy=false,version=legacy?1:3}={}) {
  return {game:'pong',...(version>=2?{version}:{}),seed,tick:0,paddles:[300,300],aim:[300,300],score:[0,0],
    ball:[500,300,0,0],serve:72,serveTo:seed%2,round:0,hits:0,rally:0,bestRally:0,epoch:0,winner:null,reason:'',
    ...(version>=3?{dash:[0,0],cooldowns:[{dash:0,power:0,spin:0},{dash:0,power:0,spin:0}],armed:[null,null],swipe:[{dir:0,tick:-100},{dir:0,tick:-100}],curve:0,flight:[],lastHit:null}:{})};
}
function reflect(y) {
  const span=HEIGHT-2*RADIUS, twice=2*span;
  const phase=((y-RADIUS)%twice+twice)%twice;
  return RADIUS+(phase>span?twice-phase:phase);
}
export const DIFFICULTIES={easy:{reaction:18,error:82,offset:10},normal:{reaction:10,error:38,offset:19},hard:{reaction:6,error:16,offset:25}};
export function motor(s,side,tactic,difficulty='normal') {
  const [x,y,vx,vy]=s.ball;
  const incoming=side===0?vx<0:vx>0;
  if(!incoming) return tactic==='upper'?240:tactic==='lower'?360:300;
  const intercept=reflect(y+vy*((side===0?LEFT:RIGHT)-x)/vx);
  const cfg=DIFFICULTIES[difficulty]||DIFFICULTIES.normal;
  const error=(noise(s.seed,s.epoch,47+side)-0.5)*cfg.error;
  const urgent=Math.abs(intercept-s.paddles[side])>85;
  const offset=urgent?0:tactic==='upper'?cfg.offset:tactic==='lower'?-cfg.offset:tactic==='change'?(s.epoch%3===0?cfg.offset:-cfg.offset):0;
  return clamp(Math.round(intercept+offset+error),HALF,HEIGHT-HALF);
}
export function pongRule(s,side) {
  return s.paddles[1-side]<260?'lower':s.paddles[1-side]>340?'upper':(s.epoch+side)%2?'upper':'lower';
}
export function stepPong(s,moves) {
  if(s.version>=3)return stepSkilledPong(s,moves);
  if (s.winner!==null || !Array.isArray(moves) || moves.length!==2 ||
      !moves.every(n=>Number.isInteger(n)&&n>=0&&n<=HEIGHT)) throw new Error('球拍目标无效');
  const aim=s.version>=2||s.tick%6===0?moves.map(n=>clamp(n,HALF,HEIGHT-HALF)):s.aim;
  const speed=s.version>=2?14:8;
  const paddles=s.paddles.map((y,i)=>y+clamp(aim[i]-y,-speed,speed));
  const t={...s,tick:s.tick+1,paddles,aim,ball:[...s.ball],score:[...s.score]};
  if(s.serve>0) {
    t.serve--;
    if(!t.serve) t.ball=[500,300,s.serveTo===0?-8:8,(noise(s.seed,s.round,93)>.5?1:-1)*(3+Math.floor(noise(s.seed,s.round,94)*4))];
  } else {
    let [x,y,vx,vy]=s.ball; const oldX=x; x+=vx; y+=vy;
    if(y<RADIUS || y>HEIGHT-RADIUS) {y=reflect(y);vy=-vy;}
    const side=vx<0?0:1, plane=side===0?LEFT:RIGHT;
    const crossing=side===0?oldX>=plane&&x<=plane:oldX<=plane&&x>=plane;
    if(crossing && Math.abs(y-paddles[side])<=HALF+RADIUS) {
      x=2*plane-x; vx=(side===0?1:-1)*Math.min(22,Math.abs(vx)+.6);
      const spin=(paddles[side]-s.paddles[side])*.32;
      vy=clamp(Math.round((y-paddles[side])*.23+spin),-14,14);
      if(Math.abs(vy)<2)vy=vy<0?-2:2;
      t.hits++; t.rally++;t.bestRally=Math.max(t.bestRally,t.rally); t.epoch++;
    }
    t.ball=[x,y,vx,vy];
    if(x < -RADIUS || x > WIDTH+RADIUS) {
      const scorer=x<0?1:0; t.score[scorer]++; t.round++; t.rally=0;t.serveTo=1-scorer;
      t.serve=72;t.ball=[500,300,0,0];t.epoch++;
    }
  }
  if(t.score.some(n=>n>=7) || t.tick>=PONG_LIMIT) {
    t.winner=leading(t.score);t.reason=t.score.some(n=>n>=7)?'先得七分':'时间到';
  }
  return t;
}

const round=v=>Math.round(v*10000)/10000;
function pongInput(move){
 if(Number.isInteger(move)&&move>=0&&move<=HEIGHT)return {target:move};
 if(move&&typeof move==='object'&&!Array.isArray(move)&&Object.keys(move).every(k=>['target','skill'].includes(k))&&Number.isInteger(move.target)&&move.target>=0&&move.target<=HEIGHT&&Object.hasOwn(PONG_SKILLS,move.skill))return move;
 throw new Error('球拍目标或击球动作无效');
}
function stepSkilledPong(s,moves){
 if(s.winner!==null||!Array.isArray(moves)||moves.length!==2)throw new Error('球拍目标无效');
 const input=moves.map(pongInput),t={...s,tick:s.tick+1,aim:input.map(m=>clamp(m.target,HALF,HEIGHT-HALF)),paddles:[...s.paddles],ball:[...s.ball],score:[...s.score],armed:[...s.armed],swipe:[...s.swipe],dash:s.dash.map(n=>Math.max(0,n-1)),cooldowns:s.cooldowns.map(c=>Object.fromEntries(Object.entries(c).map(([key,n])=>[key,Math.max(0,n-1)]))),flight:s.flight.slice(-11)};
 for(const side of [0,1]){
  const skill=input[side].skill;
  if(!s.serve&&skill&&t.cooldowns[side][skill]===0){
   if(skill==='dash'){t.dash[side]=PONG_SKILLS.dash.duration;t.cooldowns[side].dash=PONG_SKILLS.dash.cooldown;}
   else t.armed[side]=t.armed[side]===skill?null:skill;
  }
  const speed=t.dash[side]>0?22:14;t.paddles[side]=s.paddles[side]+clamp(t.aim[side]-s.paddles[side],-speed,speed);
  if(t.paddles[side]!==s.paddles[side])t.swipe[side]={dir:Math.sign(t.paddles[side]-s.paddles[side]),tick:t.tick};
 }
 if(s.serve>0){
  t.serve--;t.flight=[];
  if(!t.serve)t.ball=[500,300,s.serveTo===0?-8:8,(noise(s.seed,s.round,93)>.5?1:-1)*(3+Math.floor(noise(s.seed,s.round,94)*4))];
 }else{
  let [x,y,vx,vy]=s.ball;const oldX=x;
  vy=round(clamp(vy+s.curve,-18,18));x+=vx;y+=vy;t.curve=round(s.curve*.994);if(Math.abs(t.curve)<.004)t.curve=0;
  if(y<RADIUS||y>HEIGHT-RADIUS){y=reflect(y);vy=-vy;t.curve=-t.curve;}
  const side=vx<0?0:1,plane=side===0?LEFT:RIGHT,crossing=side===0?oldX>=plane&&x<=plane:oldX<=plane&&x>=plane;
  if(crossing&&Math.abs(y-t.paddles[side])<=HALF+RADIUS){
   const motion=t.paddles[side]-s.paddles[side],offset=y-t.paddles[side],skill=t.armed[side];
   x=2*plane-x;vx=(side===0?1:-1)*Math.min(22,Math.abs(vx)+.6);vy=clamp(Math.round(offset*.23+motion*.32),-14,14);if(Math.abs(vy)<2)vy=vy<0?-2:2;
   t.curve=0;
   if(skill==='power')vx=(side===0?1:-1)*Math.min(26,Math.max(14,Math.abs(vx)*1.35));
   if(skill==='spin'){const recent=t.tick-t.swipe[side].tick<=12?t.swipe[side].dir:0,sign=recent||Math.sign(offset)||Math.sign(vy)||1;t.curve=sign*.22;vy=round(vy*.65);}
   if(skill)t.cooldowns[side][skill]=PONG_SKILLS[skill].cooldown;
   t.armed[side]=null;t.flight=[];t.lastHit={tick:t.tick,side,kind:skill||'normal',curve:t.curve};
   t.hits++;t.rally++;t.bestRally=Math.max(t.bestRally,t.rally);t.epoch++;
  }
  t.ball=[x,y,vx,vy].map(round);t.flight.push([round(x),round(y)]);
  if(x<-RADIUS||x>WIDTH+RADIUS){
   const scorer=x<0?1:0;t.score[scorer]++;t.round++;t.rally=0;t.serveTo=1-scorer;t.serve=72;t.ball=[500,300,0,0];t.curve=0;t.flight=[];t.armed=[null,null];t.dash=[0,0];t.swipe=[{dir:0,tick:-100},{dir:0,tick:-100}];t.epoch++;
  }
 }
 if(t.score.some(n=>n>=7)||t.tick>=PONG_LIMIT){t.winner=leading(t.score);t.reason=t.score.some(n=>n>=7)?'先得七分':'时间到';}
 return t;
}
