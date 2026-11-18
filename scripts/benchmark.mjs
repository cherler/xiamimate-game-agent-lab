import fs from 'node:fs/promises';
import path from 'node:path';
import {initCards,stepCards,chooseCard,STARTERS} from '../src/cards.mjs';
import {initSnake,stepSnake,snakeOptions,snakeRule} from '../src/snake.mjs';
import {planSnake,snakePlans} from '../src/snake-planner.mjs';
import {chessPlan} from '../src/chess.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {begin,advance,checkReplay} from '../src/arena.mjs';
import {initPong,stepPong,motor,pongRule,DIFFICULTIES} from '../src/pong.mjs';
import {results} from './paths.mjs';
await fs.mkdir(results,{recursive:true});
const all={snake:[],cards:[],chess:[],pong:[]};
for(let i=0;i<100;i++)for(const side of [0,1]){
 const seed=62001+i,m=begin('snake',seed);let trail=[],choices=0;
 while(m.state.winner===null){const s=m.state,own=planSnake(s,side,'forage',trail).id,rival=snakeRule(snakeOptions(s,1-side),seed+s.tick);choices+=snakePlans(s,side,trail).length>1;trail.push(s.bodies[side][0]);trail=trail.slice(-12);advance(m,side===0?[own,rival]:[rival,own]);}
 checkReplay(m.record);all.snake.push({seed,side,food:m.state.score[side],rivalFood:m.state.score[1-side],winner:m.state.winner,ticks:m.state.tick,choices});
 if(i===0&&side===0)await fs.writeFile(path.join(results,'snake-planner-replay.json'),JSON.stringify(m.record));
}
console.log('蛇：200 场完成');
for(let i=0;i<100;i++)for(const side of [0,1]){
 const seed=72001+i,m=beginStrategy('cards',seed,[{faction:side===0?'F':'W'},{faction:side===0?'W':'F'}]);
 for(const actor of [0,1])advanceStrategy(m,actor,chooseCard(m.state,actor));
 while(m.state.winner===null)advanceStrategy(m,m.state.turn,chooseCard(m.state));
 replayStrategy(sealStrategy(m));all.cards.push({seed,forestSide:side,winner:m.state.winner,turns:m.state.players.map(p=>p.turns),actions:m.state.seq});
 if(i===0&&side===0)await fs.writeFile(path.join(results,'cards-replay.json'),JSON.stringify(sealStrategy(m)));
}
console.log('牌局：200 场完成');
for(let i=0;i<100;i++){
 const side=0,seed=82001+i,m=beginStrategy('chess',seed);
 while(m.state.winner===null){for(const actor of m.state.players.map((p,i)=>p.hp>0?i:null).filter(i=>i!==null))for(const action of chessPlan(m.state,actor,actor===side?'strength':'balanced'))advanceStrategy(m,actor,action);advanceStrategy(m,-1,{type:'advance'});}
 replayStrategy(sealStrategy(m));all.chess.push({seed,strengthSide:side,winner:m.state.winner,round:m.state.round,actions:m.state.seq});
 if(i===0&&side===0)await fs.writeFile(path.join(results,'chess-replay.json'),JSON.stringify(sealStrategy(m)));
}
console.log('棋阵：100 场完成');
for(const difficulty of ['easy','normal','hard'])for(let seed=92001;seed<92021;seed++){
 const m=begin('pong',seed),aims=[300,300];
 while(m.state.winner===null){const s=m.state;if(s.tick%10===0)aims[0]=motor(s,0,pongRule(s,0),'normal');if(s.tick%DIFFICULTIES[difficulty].reaction===0)aims[1]=motor(s,1,pongRule(s,1),difficulty);advance(m,aims);}
 checkReplay(m.record);all.pong.push({seed,difficulty,score:m.state.score,winner:m.state.winner,bestRally:m.state.bestRally});
}
const summary={snake:{games:all.snake.length,foodMean:all.snake.reduce((n,r)=>n+r.food,0)/200,rivalFoodMean:all.snake.reduce((n,r)=>n+r.rivalFood,0)/200,wins:all.snake.filter(r=>r.winner===r.side).length,draws:all.snake.filter(r=>r.winner===-1).length,choiceSteps:all.snake.reduce((n,r)=>n+r.choices,0),steps:all.snake.reduce((n,r)=>n+r.ticks,0)},cards:{games:all.cards.length,forestWins:all.cards.filter(r=>r.winner===r.forestSide).length,draws:all.cards.filter(r=>r.winner===-1).length,meanTurns:all.cards.reduce((n,r)=>n+Math.max(...r.turns),0)/200},chess:{games:all.chess.length,strengthWins:all.chess.filter(r=>r.winner===r.strengthSide).length,draws:all.chess.filter(r=>r.winner===-1).length,meanRounds:all.chess.reduce((n,r)=>n+r.round,0)/100},pong:Object.fromEntries(['easy','normal','hard'].map(d=>[d,{games:20,opponentWins:all.pong.filter(r=>r.difficulty===d&&r.winner===1).length,draws:all.pong.filter(r=>r.difficulty===d&&r.winner===-1).length}]))};
await fs.writeFile(path.join(results,'validation-matches.json'),JSON.stringify({date:'2026-11-11',summary,rows:all},null,2));console.log(JSON.stringify(summary,null,2));
