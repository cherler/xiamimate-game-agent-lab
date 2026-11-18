import fs from 'node:fs/promises';
import path from 'node:path';
import {askTyped,layaInfo} from '../providers.mjs';
import {snakePlanPacket,snakePlans} from '../src/snake-planner.mjs';
import {snakeOptions,snakeRule} from '../src/snake.mjs';
import {begin,advance,checkReplay} from '../src/arena.mjs';
import {cardCandidates,cardPacket,chooseCard} from '../src/cards.mjs';
import {chessPlan,chessPacket} from '../src/chess.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {results,percentile} from './paths.mjs';
const info=await layaInfo(),events=[],games=[];
await fs.mkdir(results,{recursive:true});
const warm=await askTyped('laya',snakePlanPacket(begin('snake',1).state,0),10000);
let bestSnake=null,bestModelCount=-1;
for(let i=0;i<10;i++)for(const side of [0,1]){
 const seed=63001+i,m=begin('snake',seed);let trail=[],modelCount=0;
 while(m.state.winner===null){
  const s=m.state,plans=snakePlans(s,side,trail);let plan=plans[0],source='planner',ms=0;
  if(plans.length>1){try{const a=await askTyped('laya',snakePlanPacket(s,side,trail),1500);ms=a.ms;if(ms<500&&plans.some(p=>p.id===a.id)){plan=plans.find(p=>p.id===a.id);source='laya';modelCount++;}else source='fallback';}catch{source='fallback';}}
  const event={game:'snake',seed,tick:s.tick,actor:side,id:plan.move,strategy:plan.id,source,ms,candidates:plans.map(p=>p.id)};events.push(event);m.record.decisions.push(event);
  trail.push(s.bodies[side][0]);trail=trail.slice(-12);const other=snakeRule(snakeOptions(s,1-side),seed+s.tick);advance(m,side===0?[plan.move,other]:[other,plan.move]);
 }
 checkReplay(m.record);games.push({game:'snake',seed,modelSide:side,winner:m.state.winner,food:m.state.score[side],rivalFood:m.state.score[1-side],modelCount,ticks:m.state.tick});
 if(modelCount>bestModelCount){bestModelCount=modelCount;bestSnake=m.record;}
}
await fs.writeFile(path.join(results,'model-snake-replay.json'),JSON.stringify(bestSnake));console.log('真实模型：20 场蛇完成');
for(const side of [0,1]){
 const seed=74001+side,m=beginStrategy('cards',seed,[{faction:'W'},{faction:'F'}]);for(const a of [0,1])advanceStrategy(m,a,chooseCard(m.state,a));
 while(m.state.winner===null){
  const s=m.state,actor=s.turn;let action=chooseCard(s),source='rule',ms=0;
  if(actor===side){const candidates=cardCandidates(s,actor);if(candidates.length===1)source='forced';else try{const a=await askTyped('laya',cardPacket(s,actor,candidates),2500);ms=a.ms;const c=candidates.find(c=>c.id===a.id);if(c){action=c.action;source='laya';}else source='fallback';}catch{source='fallback';}}
  events.push({game:'cards',seed,seq:s.seq,actor,action:action.id,source,ms});advanceStrategy(m,actor,action);
 }
 replayStrategy(sealStrategy(m));games.push({game:'cards',seed,modelSide:side,winner:m.state.winner,actions:m.state.seq});await fs.writeFile(path.join(results,'model-cards-'+side+'.json'),JSON.stringify(sealStrategy(m)));
}
console.log('真实模型：2 场牌局完成');
for(const run of [0,1]){
 const side=0,seed=84001+run,m=beginStrategy('chess',seed);
 while(m.state.winner===null){
  for(const actor of m.state.players.map((p,i)=>p.hp>0?i:null).filter(i=>i!==null)){let style='balanced',source='rule',ms=0;if(actor===side)try{const a=await askTyped('laya',chessPacket(m.state,actor),2500);ms=a.ms;if(['balanced','economy','strength','level'].includes(a.id)){style=a.id;source='laya';}else source='fallback';}catch{source='fallback';}
   const actions=chessPlan(m.state,actor,style);events.push({game:'chess',seed,round:m.state.round,actor,style,source,ms,operations:actions.length});for(const a of actions)advanceStrategy(m,actor,a);
  }
  advanceStrategy(m,-1,{type:'advance'});
 }
 replayStrategy(sealStrategy(m));games.push({game:'chess',seed,modelSide:side,winner:m.state.winner,rounds:m.state.round});await fs.writeFile(path.join(results,'model-chess-'+run+'.json'),JSON.stringify(sealStrategy(m)));
}
const summary=Object.fromEntries(['snake','cards','chess'].map(game=>{const rows=events.filter(r=>r.game===game),calls=rows.filter(r=>r.source==='laya'),modelGames=games.filter(r=>r.game===game);return [game,{games:modelGames.length,modelWins:modelGames.filter(r=>r.winner===r.modelSide).length,draws:modelGames.filter(r=>r.winner===-1).length,applied:calls.length,fallback:rows.filter(r=>r.source==='fallback').length,programOrForced:rows.filter(r=>['planner','forced'].includes(r.source)).length,p50:percentile(calls.map(r=>r.ms),.5),p95:percentile(calls.map(r=>r.ms),.95),...(game==='snake'?{foodMean:modelGames.reduce((a,g)=>a+g.food,0)/modelGames.length}: {})}];}));
await fs.writeFile(path.join(results,'model-validation.json'),JSON.stringify({date:'2026-11-11',info,contextTokens:1024,headTokens:512,warmupMs:warm.ms,summary,games,events},null,2));console.log(JSON.stringify(summary,null,2));
