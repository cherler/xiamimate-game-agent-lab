import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {project} from './paths.mjs';
import {initPong,stepPong,motor,DIFFICULTIES} from '../src/pong.mjs';
import {createPongOpponent,pongOpponentInput} from '../src/pong-opponent.mjs';
import {noise} from '../src/common.mjs';
const out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/pong-skills-2026-11-19');await fs.mkdir(out,{recursive:true});
const rows=[];
// A fixed synthetic player: 250ms observation delay, reads every 200ms, short linear forecast.
// Same controller on both versions. These are not measured human win rates.
for(const version of [2,3])for(const difficulty of ['easy','normal','hard']){
 let wins=0,draws=0,hits=0,seconds=0,points=[0,0];const runs=[];
 for(let seed=41003;seed<41033;seed++){
  let s=initPong(seed,{version}),target=300,bot=300;const brain=createPongOpponent(),history=[];
  while(s.winner===null){
   history.push(s);if(history.length>30)history.shift();const seen=history.findLast(x=>x.tick<=s.tick-15);
   if(seen&&s.tick%12===0){const [x,y,vx,vy]=seen.ball;target=vx<0?Math.max(0,Math.min(600,Math.round(y+vy*Math.min(18,Math.max(0,(47-x)/vx))+(noise(seed,seen.epoch,301)-.5)*55))):300;}
   if(version===3)bot=pongOpponentInput(s,brain,{difficulty});else if(s.tick%DIFFICULTIES[difficulty].reaction===0)bot=motor(s,1,'steady',difficulty);
   s=stepPong(s,[target,bot]);
  }
  wins+=s.winner===0;draws+=s.winner===-1;hits+=s.hits;seconds+=s.tick/60;points[0]+=s.score[0];points[1]+=s.score[1];runs.push({seed,winner:s.winner,score:s.score,hits:s.hits,seconds:s.tick/60});
 }
 rows.push({version,difficulty,wins,draws,total:30,meanHits:+(hits/30).toFixed(1),points,meanSeconds:Math.round(seconds/30),runs});
}
const old=rows.find(r=>r.version===2&&r.difficulty==='normal'),modern=rows.filter(r=>r.version===3);assert.ok(modern[0].wins>old.wins);assert.ok(modern[0].wins>modern[1].wins&&modern[1].wins>modern[2].wins);assert.ok(modern[0].meanHits>15,'练习对手需要接得回来，不能只是放空');
const report={method:'同一模拟玩家、30个种子、每档对照，不代表真人胜率',rows};await fs.writeFile(path.join(out,'pong-balance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:rows.map(({runs,...r})=>r)},null,2));
