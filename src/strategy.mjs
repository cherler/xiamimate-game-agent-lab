import {initCards,stepCards} from './cards.mjs';
import {initCards as initCardsV1,stepCards as stepCardsV1} from './cards-v1.mjs';
import {initCards as initCardsV2,stepCards as stepCardsV2} from './cards-v2.mjs';
import {initCards as initCardsV3,stepCards as stepCardsV3} from './cards-v3.mjs';
import {fingerprint} from './common.mjs';
import {initChess,stepChess} from './chess.mjs';
import {initChess as initChessV1,stepChess as stepChessV1} from './chess-v1.mjs';
import {initChess as initChessV2,stepChess as stepChessV2} from './chess-v2.mjs';
export function beginStrategy(game,seed,configs,format='glimmer-4'){
 if(!['cards','chess'].includes(game))throw Error('未知游戏');
 if(!['glimmer-1','glimmer-2','glimmer-3','glimmer-4'].includes(format))throw Error('未知规则版本');
 return {state:game==='cards'?(format==='glimmer-1'?initCardsV1:format==='glimmer-2'?initCardsV2:format==='glimmer-3'?initCardsV3:initCards)(seed,configs||undefined):(format==='glimmer-1'?initChessV1:format==='glimmer-4'?initChess:initChessV2)(seed),record:{format,game,seed,configs:configs||null,actions:[],end:null}};
}
export function advanceStrategy(match,actor,action){
 match.state=(match.state.game==='cards'?(match.state.version===1?stepCardsV1:match.state.version===2?stepCardsV2:match.state.version===3?stepCardsV3:stepCards):(match.state.version===1?stepChessV1:match.state.version===2?stepChessV2:stepChess))(match.state,actor,action,{trace:true});match.record.actions.push({actor,action:structuredClone(action)});return match.state;
}
export function sealStrategy(match){match.record.end={seq:match.state.seq,winner:match.state.winner,hash:fingerprint(match.state)};return structuredClone(match.record);}
export function replayStrategy(record){
 if(!['glimmer-1','glimmer-2','glimmer-3','glimmer-4'].includes(record?.format)||!['cards','chess'].includes(record.game)||!Array.isArray(record.actions)||record.actions.length>(record.game==='chess'?10000:3000))throw Error('无法识别此回放');
 const match=beginStrategy(record.game,record.seed,record.configs,record.format);for(const row of record.actions)advanceStrategy(match,row.actor,row.action);
 if(!record.end||record.end.hash!==fingerprint(match.state)||record.end.seq!==match.state.seq||record.end.winner!==match.state.winner)throw Error('回放校验失败');
 return match.state;
}
