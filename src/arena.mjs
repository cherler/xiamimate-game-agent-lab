import { fingerprint, noise } from './common.mjs';
import { initSnake, stepSnake, snakeOptions, snakeRule } from './snake.mjs';
import { planSnake } from './snake-planner.mjs';
import { initPong, stepPong, motor, pongRule, TACTICS } from './pong.mjs';

export const RULES='round2.3';
export const GAMES={
  snake:{name:'双蛇争食',init:initSnake,step:stepSnake,max:180,interval:500},
  pong:{name:'球台对攻',init:initPong,step:stepPong,max:7200,interval:1000/60}
};
export const LABELS={up:'向上',right:'向右',down:'向下',left:'向左',upper:'压上侧',lower:'压下侧',steady:'守中',change:'变落点'};
export function describeAction(game, value) {
  return LABELS[value] ?? String(value);
}
export function startingState(game, seed, opening=[],rules=RULES) {
  if(!Object.hasOwn(GAMES,game)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff) throw new Error('无效游戏或种子');
  if(!Array.isArray(opening)||opening.length) throw new Error('无效起始局面');
  return game==='snake'?initSnake(seed,{legacy:rules==='round2.1'}):initPong(seed,{legacy:rules!=='round2.3'});
}
export function begin(game,seed,opening=[],rules=RULES) {
  return {state:startingState(game,seed,opening,rules),record:{format:1,rules,game,seed,opening:[...opening],
    frames:[],decisions:[],end:null}};
}
export function advance(match,input) {
  const before=match.state;
  const next=GAMES[before.game].step(before,input);
  const val=Array.isArray(input)?[...input]:input;
  const frames=match.record.frames, last=frames.at(-1);
  if(before.game==='pong'&&last&&last[1][0]===val[0]&&last[1][1]===val[1]) last[0]++;
  else frames.push([1,val]);
  match.state=next;
  if(next.winner!==null) seal(match);
  return next;
}
export function seal(match) {
  const s=match.state;
  match.record.end={tick:s.tick,score:[...s.score],winner:s.winner,hash:fingerprint(s)};
  return match.record;
}
export function* playback(record) {
  if(record?.format!==1||!['round2.1','round2.2',RULES].includes(record.rules)||!Object.hasOwn(GAMES,record.game)||!Array.isArray(record.frames)||
    !Array.isArray(record.decisions)||record.decisions.length>2000) throw new Error('回放格式或版本不匹配');
  let s=startingState(record.game,record.seed,record.opening,record.rules), total=s.tick;
  for(const frame of record.frames) {
    if(!Array.isArray(frame)||frame.length!==2) throw new Error('回放帧无效');
    const [n,input]=frame;
    if(!Number.isInteger(n)||n<1||(total+=n)>GAMES[record.game].max) throw new Error('回放超出局长');
    for(let i=0;i<n;i++){s=GAMES[record.game].step(s,input); yield s;}
  }
  if(!record.end||record.end.tick!==s.tick||record.end.hash!==fingerprint(s)||
    record.end.winner!==s.winner||JSON.stringify(record.end.score)!==JSON.stringify(s.score)) throw new Error('回放终态校验失败');
}
export function checkReplay(record) {
  let state=startingState(record.game,record.seed,record.opening,record.rules);
  for(const frame of playback(record)) state=frame;
  return state;
}
export function pick(s,actor,policy='rule',salt=0) {
  const entropy=Math.floor(noise(s.seed^salt,s.tick,actor+31)*0xffffffff);
  if(s.game==='pong') {
    if(policy==='fixed') return 'steady';
    if(policy==='random') return TACTICS[Math.floor(noise(entropy,s.epoch)*TACTICS.length)];
    return pongRule(s,actor);
  }
  const opts=snakeOptions(s,actor);
  if(policy==='random') return opts[Math.floor(noise(entropy,7)*opts.length)].id;
  return policy==='rule'?snakeRule(opts,entropy):planSnake(s,actor).id;
}
export function simulate(game,seed,policies,opts={}) {
  const match=begin(game,seed,opts.opening||[]);
  let s=match.state, epoch=-1, tactics=['steady','steady'], decisions=0;
  const choose=(actor)=>{
    const t=performance.now(), id=pick(s,actor,policies[actor],opts.salt||0);
    if(opts.record) match.record.decisions.push({tick:s.tick,actor,id,source:policies[actor],ms:Math.round((performance.now()-t)*100)/100});
    decisions++; return id;
  };
  while(s.winner===null) {
    let action;
    if(game==='snake') action=[choose(0),choose(1)];
    else {
      if(s.epoch!==epoch){epoch=s.epoch;tactics=[choose(0),choose(1)];}
      action=tactics.map((t,i)=>motor(s,i,t));
    }
    s=opts.record?advance(match,action):GAMES[game].step(s,action);
  }
  return {state:s,decisions,record:opts.record?match.record:null};
}
