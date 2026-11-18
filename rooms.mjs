import {randomBytes,randomInt} from 'node:crypto';
import {beginStrategy,advanceStrategy,sealStrategy} from './src/strategy.mjs';
import {cardView,validateDeck,STARTERS} from './src/cards.mjs';
import {chessView} from './src/chess-v1.mjs';
import {cardPresentation} from './src/card-events.mjs';
const token=()=>randomBytes(24).toString('hex');
function config(value){const faction=value?.faction||'W',deck=value?.deck||STARTERS[faction];if(!validateDeck(faction,deck))throw Error('卡组无效');return {faction,deck};}
export class RoomStore {
 constructor(){this.rooms=new Map();}
 create(game,settings){
  if(!['cards','chess'].includes(game))throw Error('房间游戏无效');
  for(const [id,r] of this.rooms)if(Date.now()-r.touched>6*3600_000)this.rooms.delete(id);
  if(this.rooms.size>=50)throw Error('房间已满，请稍后重试');
  let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(code));
  const auth=token();this.rooms.set(code,{game,touched:Date.now(),tokens:[auth],configs:[game==='cards'?config(settings):{}],match:null,record:null,deadline:null,seatSeq:[0,0],phaseSeq:0,recent:[]});
  return {code,token:auth,actor:0};
 }
 join(code,settings){const r=this.rooms.get(code);if(!r||r.tokens.length!==1)throw Error('房间不存在或已经满员');
  if(settings?.game&&settings.game!==r.game)throw Error('请先切换到房间对应的游戏再加入');
  const cfg=r.game==='cards'?config(settings):{},auth=token();r.tokens.push(auth);r.configs.push(cfg);r.match=beginStrategy(r.game,randomInt(0x100000000),r.configs,r.game==='chess'?'glimmer-1':'glimmer-3');r.touched=Date.now();r.deadline=Date.now()+(r.game==='cards'?60000:45000);return {code,token:auth,actor:1};
 }
 get(code,auth){const r=this.rooms.get(code),actor=r?.tokens.indexOf(auth);if(!r||actor<0||actor===undefined)throw Error('房间凭据无效');return {r,actor};}
 advance(r,actor,action){
  const s=advanceStrategy(r.match,actor,action);
  if(r.game==='cards'){const cue=cardPresentation(s);if(cue){r.recent.push({cue,views:[cardView(s,0),cardView(s,1)]});r.recent=r.recent.slice(-24);}}
  return s;
 }
 tick(r){
  if(!r.match||r.match.state.winner!==null||Date.now()<r.deadline)return;
  const s=r.match.state;
  if(r.game==='chess'){
   if(s.phase==='battle')advanceStrategy(r.match,-1,{type:'advance'});
   else for(const a of [0,1])if(!r.match.state.players[a].ready)advanceStrategy(r.match,a,{type:'ready'});
   r.phaseSeq=r.match.state.seq;r.deadline=Date.now()+(r.match.state.phase==='battle'?Math.max(1000,r.match.state.battle.ticks*100):45000);return;
  }
  if(s.phase==='mulligan'){for(const a of [0,1])if(!r.match.state.kept[a])this.advance(r,a,{type:'mulligan',replace:[]});}
  else this.advance(r,s.turn,{id:'end'});
  if(s.phase!==r.match.state.phase)r.phaseSeq=r.match.state.seq;r.deadline=Date.now()+60000;
 }
 view(code,auth){const {r,actor}=this.get(code,auth);this.tick(r);r.touched=Date.now();return {code,actor,game:r.game,waiting:!r.match,state:r.match?(r.game==='cards'?cardView:chessView)(r.match.state,actor):null,...(r.game==='cards'?{presentations:r.recent.map(x=>({cue:x.cue,state:x.views[actor]}))}:{}),deadline:r.deadline,now:Date.now()};}
 act(code,auth,seq,action){const {r,actor}=this.get(code,auth);this.tick(r);if(!r.match)throw Error('等待另一位玩家');
  const before=r.match.state,independent=r.game==='chess'&&before.phase==='prep'||r.game==='cards'&&before.phase==='mulligan';
  // Concurrent shop operations and mulligans touch separate seats. An old own
  // action or previous phase still cannot be submitted twice.
  if(seq!==before.seq&&!(independent&&Number.isInteger(seq)&&seq>=Math.max(r.seatSeq[actor],r.phaseSeq)&&seq<before.seq))throw Error('局面已经更新，请重试');
  this.advance(r,actor,action);r.seatSeq[actor]=r.match.state.seq;if(before.phase!==r.match.state.phase)r.phaseSeq=r.match.state.seq;
  if(before.turn!==r.match.state.turn||before.phase!==r.match.state.phase)r.deadline=Date.now()+(r.game==='cards'?60000:r.match.state.phase==='battle'?Math.max(1000,r.match.state.battle.ticks*100):45000);r.touched=Date.now();return this.view(code,auth);
 }
 replay(code,auth){const {r}=this.get(code,auth);if(!r.match||r.match.state.winner===null)throw Error('对局结束后才能导出包含双方手牌的回放');return sealStrategy(r.match);}
}
