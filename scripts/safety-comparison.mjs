import fs from 'node:fs/promises';
import path from 'node:path';
import { begin,advance,checkReplay,pick } from '../src/arena.mjs';
import { snakeMoves,safeOptions } from '../src/snake.mjs';
import { noise } from '../src/common.mjs';
import { openWindow } from '../src/decisions.mjs';
import { layaInfo,askProvider } from '../providers.mjs';
import { results,counts,percentile,median } from './paths.mjs';

const dir=path.join(results,'safety-comparison');await fs.mkdir(dir,{recursive:true});
const info=await layaInfo(), rows=[],groups={};
const eventsFile=path.join(dir,'decisions.jsonl');await fs.writeFile(eventsFile,'');
const modes=['direct','guarded','guarded-random','guarded-rule'];
const warm=await askProvider('laya',begin('snake',1883).state,0,'features',10000);
for(let i=0;i<6;i++) for(const side of [0,1]) {
  for(const mode of (i+side)%2?modes:[...modes].reverse()) {
    const seed=51001+i,m=begin('snake',seed),sources={},times=[];let s=m.state;
    while(s.winner===null) {
      const ids=mode==='direct'?snakeMoves(s,side):safeOptions(s,side).map(o=>o.id);
      const fallback=pick(s,side,'rule',97);
      let answer;
      if(ids.length===1) answer={id:ids[0],source:'forced',ms:0};
      else if(mode==='guarded-rule') answer={id:fallback,source:'rule',ms:0};
      else if(mode==='guarded-random') answer={id:ids[Math.floor(noise(seed,s.tick,800+side)*ids.length)],source:'random',ms:0};
      else {
        const w=openWindow({matchId:mode+seed,epoch:s.tick,actor:side,ids,fallback,budget:500});
        try{const raw=await askProvider('laya',s,side,'features',5000,undefined,ids);times.push(raw.ms);w.offer(w.token,raw);}
        catch(e){w.fail(e.name==='TimeoutError'?'timeout':'offline');}
        answer=w.finish();
      }
      sources[answer.source]=(sources[answer.source]||0)+1;
      const event={tick:s.tick,actor:side,...answer,candidates:ids};
      m.record.decisions.push(event);
      await fs.appendFile(eventsFile,JSON.stringify({seed,mode,...event})+'\n');
      const rival=pick(s,1-side,'rule',97);
      s=advance(m,side===0?[answer.id,rival]:[rival,answer.id]);
    }
    checkReplay(m.record);
    rows.push({seed,side,mode,sources,times,ticks:s.tick,outcome:s.winner===-1?'draw':s.winner===side?'win':'loss',score:s.score});
    if(mode==='guarded')await fs.writeFile(path.join(dir,'match-'+seed+'-'+side+'.json'),JSON.stringify(m.record));
  }
  console.log('Finished held-out pair member',i+1,side);
}
for(const mode of modes) {
  const games=rows.filter(r=>r.mode===mode),total={};
  for(const g of games) for(const [k,n] of Object.entries(g.sources)) total[k]=(total[k]||0)+n;
  groups[mode]={games:games.length,outcomes:counts(games.map(g=>g.outcome)),medianTicks:median(games.map(g=>g.ticks)),
    sources:total,p95:percentile(games.flatMap(g=>g.times),.95)};
}
await fs.writeFile(path.join(dir,'summary.json'),JSON.stringify({info,warmupMs:warm.ms,seeds:[51001,51006],groups,rows},null,2));
console.log(JSON.stringify(groups));
