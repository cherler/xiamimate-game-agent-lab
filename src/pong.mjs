import { clamp, leading, noise } from './common.mjs';
export const WIDTH=1000, HEIGHT=600, HALF=53, RADIUS=9, LEFT=47, RIGHT=WIDTH-LEFT;
export const PONG_LIMIT=7200, TACTICS=['upper','lower','steady','change'];

export function initPong(seed) {
  return {game:'pong',seed,tick:0,paddles:[300,300],aim:[300,300],score:[0,0],
    ball:[500,300,0,0],serve:72,serveTo:seed%2,round:0,hits:0,rally:0,bestRally:0,epoch:0,winner:null,reason:''};
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
  if (s.winner!==null || !Array.isArray(moves) || moves.length!==2 ||
      !moves.every(n=>Number.isInteger(n)&&n>=0&&n<=HEIGHT)) throw new Error('球拍目标无效');
  const aim=s.tick%6===0?moves.map(n=>clamp(n,HALF,HEIGHT-HALF)):s.aim;
  const paddles=s.paddles.map((y,i)=>y+clamp(aim[i]-y,-8,8));
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
