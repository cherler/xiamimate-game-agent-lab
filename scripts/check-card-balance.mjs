import fs from 'node:fs/promises';
import path from 'node:path';
import {PRESETS} from '../src/catalog.mjs';
import {chooseCard,validateDeck} from '../src/cards.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {beginDraft,draftOptions,pickDraft} from '../src/draft.mjs';
import {project} from './paths.mjs';
const out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/cards-expansion-2026-11-17');
const rows=[];await fs.mkdir(out,{recursive:true});
function play(seed,decks){const m=beginStrategy('cards',seed,decks);for(const actor of [0,1])advanceStrategy(m,actor,chooseCard(m.state,actor));while(m.state.winner===null&&m.state.seq<1000){advanceStrategy(m,m.state.turn,chooseCard(m.state));if(m.state.players.some(p=>p.hand.length>8||p.board.length>5||p.mana<0))throw Error('invalid limits');}if(m.state.winner===null)throw Error('unfinished');replayStrategy(sealStrategy(m));return m;}
for(let i=0;i<PRESETS.length;i++)for(let j=i+1;j<PRESETS.length;j++){
 for(let seed=19001;seed<19011;seed++)for(const side of [0,1]){const decks=side?[PRESETS[j],PRESETS[i]]:[PRESETS[i],PRESETS[j]],m=play(seed,decks),winner=m.state.winner;rows.push({seed,decks:decks.map(d=>d.id),winner:winner===-1?'draw':decks[winner].id,seat:winner,turns:Math.max(...m.state.players.map(p=>p.turns)),actions:m.state.seq});if(seed===19001&&side===0)await fs.writeFile(path.join(out,`replay-${i}-${j}.json`),JSON.stringify(sealStrategy(m)));}
 console.log(PRESETS[i].name+' / '+PRESETS[j].name+' 完成');
}
const drafts=[];for(const faction of ['W','F','S'])for(let seed=20001;seed<20011;seed++){let draft=beginDraft(seed,faction);for(let i=0;i<20;i++)draft=pickDraft(draft,draftOptions(draft)[(seed+i)%3]);if(!validateDeck(faction,draft.picks))throw Error('draft invalid');const m=play(seed,[{faction,deck:draft.picks},PRESETS[seed%6]]);drafts.push({seed,faction,deck:draft.picks,winner:m.state.winner,actions:m.state.seq});}
const summary=PRESETS.map(p=>{const games=rows.filter(r=>r.decks.includes(p.id));return {id:p.id,name:p.name,games:games.length,wins:games.filter(r=>r.winner===p.id).length,draws:games.filter(r=>r.winner==='draw').length};});
await fs.writeFile(path.join(out,'balance.json'),JSON.stringify({date:'2026-11-17',summary,rows,drafts},null,2));console.log(JSON.stringify({matches:rows.length,drafts:drafts.length,summary},null,2));
