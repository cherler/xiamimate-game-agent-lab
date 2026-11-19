import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {project} from './paths.mjs';
import {PRESETS} from '../src/catalog.mjs';
import {PRESETS as OLD_PRESETS} from '../src/catalog-v3.mjs';
import * as cards from '../src/cards.mjs';
import * as oldCards from '../src/cards-v3.mjs';
import * as chess from '../src/chess.mjs';
import * as oldChess from '../src/chess-v2.mjs';
import {rescueScenario} from './rescue-scenarios.mjs';
const out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/strategy-depth-2026-11-18');await fs.mkdir(out,{recursive:true});
const seeds=Number(process.env.ARENA_COMPARE_SEEDS||6);if(!Number.isInteger(seeds)||seeds<1||seeds>30)throw Error('比较种子数必须为 1–30');
const cardRows=[];
for(const [version,engine,presets]of [['before',oldCards,OLD_PRESETS],['after',cards,PRESETS]]){
 for(let i=0;i<PRESETS.length;i++)for(let j=i+1;j<PRESETS.length;j++)for(let n=0;n<seeds;n++)for(const side of [0,1]){
  const decks=side?[presets[j],presets[i]]:[presets[i],presets[j]],seed=71101+n,usage={cycle:0,alternate:0,power:0};let s=engine.initCards(seed,decks);
  for(const actor of [0,1])s=engine.stepCards(s,actor,engine.chooseCard(s,actor,'standard'));
  while(s.winner===null&&s.seq<1500){const action=engine.chooseCard(s,s.turn,'standard');if(action.type==='cycle')usage.cycle++;if(action.type==='power')usage.power++;if(action.mode)usage.alternate++;s=engine.stepCards(s,s.turn,action);}
  assert.notEqual(s.winner,null);cardRows.push({version,seed,decks:decks.map(d=>d.id),first:s.first,winner:s.winner===-1?'draw':decks[s.winner].id,turns:Math.max(...s.players.map(p=>p.turns)),...usage});
 }
 console.log('cards',version,cardRows.filter(r=>r.version===version).length);
}
const cardSummary=['before','after'].map(version=>{
 const rows=cardRows.filter(r=>r.version===version);return {version,games:rows.length,draws:rows.filter(r=>r.winner==='draw').length,meanTurns:rows.reduce((n,r)=>n+r.turns,0)/rows.length,cycles:rows.reduce((n,r)=>n+r.cycle,0),alternatePowers:rows.reduce((n,r)=>n+r.alternate,0),decks:PRESETS.map(p=>{const games=rows.filter(r=>r.decks.includes(p.id));return {id:p.id,name:p.name,games:games.length,wins:games.filter(r=>r.winner===p.id).length,draws:games.filter(r=>r.winner==='draw').length};})};
});await fs.writeFile(path.join(out,'cards-comparison.json'),JSON.stringify({summary:cardSummary,rows:cardRows},null,2));

const chessRows=[];for(const [version,engine]of [['before',oldChess],['after',chess]])for(let seed=72101;seed<72109;seed++){
 let s=engine.initChess(seed),loot=0,forecastChecks=0;while(s.winner===null){
  const rival=version==='after'?chess.nextChessOpponent(s):null;
  for(const actor of [1,2,3,4,5,6,7,0])if(s.players[actor].hp>0)for(const a of engine.chessPlan(s,actor)){if(a.type==='loot'&&actor===0)loot++;s=engine.stepChess(s,actor,a);}
  if(version==='after'){assert.equal(s.battle.opponent,rival);forecastChecks++;}s=engine.stepChess(s,-1,{type:'advance'});
 }
 chessRows.push({version,seed,round:s.round,winner:s.winner,placement:s.players[0].placement||1,lootChoices:loot,forecastChecks});console.log('chess',version,seed,s.round);
}await fs.writeFile(path.join(out,'chess-comparison.json'),JSON.stringify({rows:chessRows},null,2));

const rescueRows=[];for(const config of [{name:'before',version:3,tactics:false},{name:'after',version:4,tactics:false},{name:'after-tactics',version:4,tactics:true}])for(const level of [1,2,3]){
 const runs=[];for(let seed=41003;seed<41013;seed++){const r=rescueScenario({level,seed,version:config.version,tactics:config.tactics}),s=r.state;runs.push({seed,win:s.winner,seconds:s.tick/30,saved:s.saved,lost:s.lost,soldiersAlive:s.soldiers.filter(u=>u.hp>0).length,totalHP:s.soldiers.reduce((n,u)=>n+u.hp,0),support:s.supportUsed||null});if(seed===41003)await fs.writeFile(path.join(out,`rescue-${config.name}-${level}.json`),JSON.stringify(r.record));}
 rescueRows.push({version:config.name,level,wins:runs.filter(r=>r.win).length,total:runs.length,meanSeconds:runs.reduce((n,r)=>n+r.seconds,0)/runs.length,meanHP:runs.reduce((n,r)=>n+r.totalHP,0)/runs.length,runs});console.log('rescue',config.name,level,runs.filter(r=>r.win).length);
}await fs.writeFile(path.join(out,'rescue-comparison.json'),JSON.stringify({rows:rescueRows},null,2));
console.log(JSON.stringify({cards:cardSummary,chess:{games:chessRows.length,forecastChecks:chessRows.reduce((n,r)=>n+r.forecastChecks,0)},rescue:rescueRows.map(({runs,...row})=>row)},null,2));
