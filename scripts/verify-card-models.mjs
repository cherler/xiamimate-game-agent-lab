import fs from 'node:fs/promises';import path from 'node:path';
import {PRESETS} from '../src/catalog.mjs';import {chooseCard,cardCandidates,cardPacket} from '../src/cards.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';import {askTyped,layaInfo} from '../providers.mjs';import {project,percentile} from './paths.mjs';
const out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/cards-expansion-2026-11-17'),info=await layaInfo(),events=[],games=[];
await fs.mkdir(out,{recursive:true});
const warm=beginStrategy('cards',21000);for(const actor of [0,1])advanceStrategy(warm,actor,chooseCard(warm.state,actor));await askTyped('laya',cardPacket(warm.state,warm.state.turn),5000);
for(let i=0;i<6;i++){
 const side=i%2,pair=[PRESETS[i],PRESETS[(i+3)%6]],decks=side?pair.toReversed():pair,m=beginStrategy('cards',21001+i,decks);
 for(const actor of [0,1])advanceStrategy(m,actor,chooseCard(m.state,actor));
 while(m.state.winner===null&&m.state.seq<1000){
  const s=m.state,actor=s.turn,candidates=cardCandidates(s,actor);let action=chooseCard(s),source='rule',ms=0;
  if(actor===side){if(candidates.length===1)source='forced';else try{const reply=await askTyped('laya',cardPacket(s,actor,candidates),2500);const pick=candidates.find(c=>c.id===reply.id);if(!pick)throw Error('invalid');action=pick.action;source='laya';ms=reply.ms;}catch{source='fallback';}}
  const row={seq:s.seq,actor,source,ms,action:action.id};events.push({game:i,...row});m.record.decisions??=[];m.record.decisions.push(row);advanceStrategy(m,actor,action);
 }
 if(m.state.winner===null)throw Error('unfinished');replayStrategy(sealStrategy(m));games.push({seed:21001+i,decks:decks.map(d=>d.id),modelSide:side,winner:m.state.winner});await fs.writeFile(path.join(out,'model-replay-'+i+'.json'),JSON.stringify(sealStrategy(m)));console.log('真实模型牌局 '+(i+1)+' / 6 完成');
}
const calls=events.filter(e=>e.source==='laya'),summary={games:games.length,modelWins:games.filter(g=>g.winner===g.modelSide).length,draws:games.filter(g=>g.winner===-1).length,applied:calls.length,fallback:events.filter(e=>e.source==='fallback').length,forced:events.filter(e=>e.source==='forced').length,p50:percentile(calls.map(e=>e.ms),.5),p95:percentile(calls.map(e=>e.ms),.95)};
await fs.writeFile(path.join(out,'model-validation.json'),JSON.stringify({date:'2026-11-17',info,summary,games,events},null,2));console.log(JSON.stringify(summary,null,2));
