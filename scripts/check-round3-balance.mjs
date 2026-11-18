import fs from 'node:fs/promises';
import path from 'node:path';
import {PRESETS} from '../src/catalog.mjs';
import {chooseCard,initCards,stepCards} from '../src/cards.mjs';
const out=process.env.ARENA_RESULTS||path.resolve('../output/game-agent-lab/round-3-2026-11-17/balance-validated');
await fs.mkdir(out,{recursive:true});
function play(seed,decks,difficulties=['challenge','challenge']){
 let s=initCards(seed,decks);for(const actor of [0,1])s=stepCards(s,actor,chooseCard(s,actor,difficulties[actor]));
 while(s.winner===null&&s.seq<1000)s=stepCards(s,s.turn,chooseCard(s,s.turn,difficulties[s.turn]));
 if(s.winner===null)throw Error('unfinished');return s;
}
const rows=[];for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
 for(let seed=23101;seed<23121;seed++)for(const side of [0,1]){const decks=side?[PRESETS[j],PRESETS[i]]:[PRESETS[i],PRESETS[j]],s=play(seed,decks);rows.push({seed,decks:decks.map(d=>d.id),first:s.first,winner:s.winner===-1?'draw':decks[s.winner].id,winnerSeat:s.winner,turns:Math.max(...s.players.map(p=>p.turns))});}
 console.log('交叉对局',rows.length,'/ 600');
}
const summary=PRESETS.map(p=>{const games=rows.filter(r=>r.decks.includes(p.id));return {id:p.id,name:p.name,games:games.length,wins:games.filter(r=>r.winner===p.id).length,losses:games.filter(r=>r.winner!=='draw'&&r.winner!==p.id).length,draws:games.filter(r=>r.winner==='draw').length};});
await fs.writeFile(path.join(out,'balance.json'),JSON.stringify({summary,rows},null,2));console.log(JSON.stringify(summary));
const mirrors=[];for(const p of PRESETS){for(let seed=24101;seed<24141;seed++){const s=play(seed,[p,p]);mirrors.push({deck:p.id,seed,first:s.first,winner:s.winner,draw:s.winner===-1,firstWon:s.winner===s.first});}console.log('同卡组对照',mirrors.length,'/ 240');}
const mirrorSummary={games:mirrors.length,firstWins:mirrors.filter(r=>r.firstWon).length,secondWins:mirrors.filter(r=>!r.draw&&!r.firstWon).length,draws:mirrors.filter(r=>r.draw).length};
await fs.writeFile(path.join(out,'mirror.json'),JSON.stringify({summary:mirrorSummary,rows:mirrors},null,2));console.log(JSON.stringify(mirrorSummary));
const difficulty=[];for(const p of PRESETS)for(let seed=25101;seed<25111;seed++)for(const seat of [0,1])for(const opponent of ['practice','challenge']){
 const levels=seat?[opponent,'standard']:['standard',opponent],s=play(seed,[p,p],levels);difficulty.push({deck:p.id,seed,standardSeat:seat,opponent,winner:s.winner,draw:s.winner===-1,standardWon:s.winner===seat});
}
const difficultySummary=['practice','challenge'].map(opponent=>{const games=difficulty.filter(r=>r.opponent===opponent);return {opponent,games:games.length,standardWins:games.filter(r=>r.standardWon).length,opponentWins:games.filter(r=>!r.draw&&!r.standardWon).length,draws:games.filter(r=>r.draw).length};});
await fs.writeFile(path.join(out,'difficulty.json'),JSON.stringify({summary:difficultySummary,rows:difficulty},null,2));console.log(JSON.stringify(difficultySummary));
