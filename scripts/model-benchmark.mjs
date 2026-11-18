import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { begin,advance,pick,checkReplay,RULES } from '../src/arena.mjs';
import { snakeMoves,stepSnake } from '../src/snake.mjs';
import { noise } from '../src/common.mjs';
import { openWindow } from '../src/decisions.mjs';
import { askProvider,layaInfo,jevModel } from '../providers.mjs';
import { results,percentile,counts } from './paths.mjs';

const provider=process.argv[2]||'laya', budget=500;
const info=provider==='laya'?await layaInfo():{model:jevModel};
const directory=path.join(results,provider);
await fs.mkdir(directory,{recursive:true});
const system={started:new Date().toISOString(),rules:RULES,provider,info,cpu:os.cpus()[0].model,
  platform:os.platform()+' '+os.release(),node:process.version,budget,encodings:['raw','features']};

function probeState(seed) {
  let s=begin('snake',seed).state;
  const states=[s],actor=seed%2;
  for(let tick=0;tick<45;tick++) {
    const t=stepSnake(s,[pick(s,0,'rule',71),pick(s,1,'rule',97)]);
    if(t.winner!==null) break;
    states.push(t);s=t;
  }
  const tests=states.filter(x=>{
    const other=pick(x,1-actor,'rule',97);
    const outcomes=snakeMoves(x,actor).map(id=>stepSnake(x,actor===0?[id,other]:[other,id]).alive[actor]);
    return outcomes.some(Boolean)&&!outcomes.every(Boolean);
  });
  const pool=seed%4<2&&tests.length?tests:states;
  return {s:pool[Math.floor(noise(seed,0,113)*pool.length)],actor};
}
const warmStart=performance.now();
const warm=await askProvider(provider,begin('snake',9701).state,0,'features',30000);
system.warmup={ms:performance.now()-warmStart,choice:warm.id};
console.log('Warm-up',provider,info.device||'',Math.round(system.warmup.ms)+'ms');

const probes=[],games=[];
const logFile=path.join(directory,'decisions.jsonl');
await fs.writeFile(logFile,'');
async function ask(s,actor,encoding,context) {
  const fallback=pick(s,actor,'rule',97);
  const token={matchId:context,epoch:s.tick,actor};
  const w=openWindow({...token,ids:snakeMoves(s,actor),fallback,budget});
  let raw=null,error=null;
  const start=performance.now();
  try {
    // Await the raw reply on the dedicated measurement lane to observe the latency tail.
    // The same 500 ms acceptance gate as interactive play decides whether it applies.
    raw=await askProvider(provider,s,actor,encoding,5000);
    w.offer(token,raw);
  }catch(e){error=e.message;w.fail(e.name==='TimeoutError'?'timeout':'offline');}
  const applied=w.finish(),other=pick(s,1-actor,'rule',97);
  const alive=id=>id!=null&&snakeMoves(s,actor).includes(id)&&stepSnake(s,actor===0?[id,other]:[other,id]).alive[actor];
  const event={context,seed:s.seed,tick:s.tick,actor,encoding,candidates:snakeMoves(s,actor),
    raw:raw?.id??null,applied:applied.id,source:applied.source,reason:applied.reason,error,
    ms:Math.round((raw?.ms??performance.now()-start)*100)/100,inputTokens:raw?.inputTokens??null,
    inferenceMs:raw?.inferenceMs??null,model:raw?.model??null,confidence:raw?.confidence??null,
    baseline:fallback,rawSurvives:raw?.id!=null?alive(raw.id):null,baselineSurvives:alive(fallback)};
  await fs.appendFile(logFile,JSON.stringify(event)+'\n');return event;
}
for(let i=0;i<100;i++) {
  const {s,actor}=probeState(31001+i);
  for(const encoding of i%2?['features','raw']:['raw','features']) probes.push(await ask(s,actor,encoding,'probe-'+i));
  if(i%25===24) console.log('Paired positions',i+1);
}
function summarize(events) {
  const good=events.filter(e=>e.raw!==null);
  return {requests:events.length,returned:good.length,applied:events.filter(e=>e.source===provider).length,
    fallbacks:counts(events.filter(e=>e.source==='fallback').map(e=>e.reason)),
    agreesWithRule:good.filter(e=>e.raw===e.baseline).length,immediateSurvival:good.filter(e=>e.rawSurvives).length,
    heuristicSurvival:events.filter(e=>e.baselineSurvives).length,latencyMs:{
      p50:percentile(good.map(e=>e.ms),.5),p95:percentile(good.map(e=>e.ms),.95),p99:percentile(good.map(e=>e.ms),.99)},
    inputTokens:good.reduce((sum,e)=>sum+(e.inputTokens||0),0)};
}
const probesSummary=Object.fromEntries(['raw','features'].map(k=>[k,summarize(probes.filter(e=>e.encoding===k))]));
await fs.writeFile(path.join(directory,'positions.json'),JSON.stringify({system,probes:probesSummary},null,2));
const liveEvents=[];let exemplar=null;
for(let i=0;i<10;i++) for(const side of [0,1]) {
  const seed=41001+i,match=begin('snake',seed);let s=match.state;
  while(s.winner===null) {
    const e=await ask(s,side,'features','match-'+i+'-'+side);liveEvents.push(e);
    match.record.decisions.push({tick:s.tick,actor:side,id:e.applied,source:e.source,ms:e.ms,reason:e.reason,
      model:e.model,inputTokens:e.inputTokens,candidates:e.candidates});
    const rival=pick(s,1-side,'rule',97);
    s=advance(match,side===0?[e.applied,rival]:[rival,e.applied]);
  }
  checkReplay(match.record);
  // Counterfactual control on the exact opening, tie-break stream and seats.
  let control=begin('snake',seed).state;
  while(control.winner===null) control=stepSnake(control,[pick(control,0,'rule',97),pick(control,1,'rule',97)]);
  const result={seed,side,ticks:s.tick,winner:s.winner,score:s.score,control:{winner:control.winner,ticks:control.tick,score:control.score}};
  games.push(result);
  if(!exemplar||match.record.end.tick>exemplar.end.tick) exemplar=match.record;
  await fs.writeFile(path.join(directory,'match-'+seed+'-'+side+'.json'),JSON.stringify(match.record));
  console.log('Match',i+1,'seat',side,'steps',s.tick,'winner',s.winner);
}
const outcomes=counts(games.map(g=>g.winner<0?'draw':g.winner===g.side?'win':'loss'));
const summary={system,probes:probesSummary,matches:{pairs:10,outcomes,decisions:summarize(liveEvents),games}};
await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify(summary,null,2));
await fs.writeFile(path.join(directory,'replay.json'),JSON.stringify(exemplar));
console.log(JSON.stringify({probes:probesSummary,outcomes,decisions:summary.matches.decisions},null,2));
