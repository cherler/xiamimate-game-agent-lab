import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {project} from './paths.mjs';
import {rescueScenario} from './rescue-scenarios.mjs';
import {initRescue,stepRescue,rescueStats} from '../src/rescue.mjs';
const out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/rescue-2026-11-17');await fs.mkdir(out,{recursive:true});
const rows=[];
for(let level=1;level<=3;level++)for(const plan of ['idle','defend','escort']){
 const runs=[];for(let i=0;i<10;i++){const seed=41003+i,result=rescueScenario({level,plan,seed});runs.push({seed,win:result.state.winner,tick:result.state.tick,...rescueStats(result.state)});
  if(i===0){await fs.writeFile(path.join(out,`rescue-${level}-${plan}.json`),JSON.stringify(result.record));if(plan==='escort')await fs.writeFile(path.join(out,`rescue-${level}-near-win.json`),JSON.stringify(result.beforeEnd));}}
 rows.push({level,plan,wins:runs.filter(r=>r.win).length,total:runs.length,meanSaved:runs.reduce((n,r)=>n+r.saved,0)/runs.length,runs});
 if(plan==='escort')assert.ok(runs.every(r=>r.win),'救援方案必须能通过第 '+level+' 关');if(plan==='idle')assert.ok(runs.every(r=>!r.win),'挂机不应通过');
}
// Stress only the simulation: 100 simultaneous enemies; no claim about browser FPS.
let stress=initRescue({level:3});stress.phase='running';stress.schedule=[{tick:5000,entry:0,fast:false,wave:1}];stress.zombies=Array.from({length:100},(_,i)=>({id:'z'+i,kind:'zombie',x:9.3+i%6*.7,y:1.3+Math.floor(i/6)*.35,r:.23,hp:45,maxHp:45,fast:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:0,hitTick:-100}));stress.uid=100;
const times=[];for(let i=0;i<120;i++){const start=performance.now();stress=stepRescue(stress);times.push(performance.now()-start);}times.sort((a,b)=>a-b);
const perf={entities:100,samples:times.length,meanMs:times.reduce((n,x)=>n+x,0)/times.length,p95Ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1)};
await fs.writeFile(path.join(out,'rescue-benchmark.json'),JSON.stringify({rows,simulationPerformance:perf},null,2));console.log(JSON.stringify({rows:rows.map(({runs,...r})=>r),simulationPerformance:perf},null,2));
