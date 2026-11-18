import test from 'node:test';
import assert from 'node:assert/strict';
import {PONG_VIEWS,pongPoint,pongTarget,pongAxis,foodEvents} from '../web/arcade-view.mjs';
import {initCards,stepCards,cardActions,chooseCard,cardInfo} from '../src/cards.mjs';
import {initChess,stepChess,chessPlan,board,bench,interest,streakBonus,synergyDetails} from '../src/chess.mjs';
import {UNITS,POOL_COPIES} from '../src/chess-catalog.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';

test('乒乓四个方位的指针投影与可见方向一致',()=>{
 for(const view of PONG_VIEWS)for(const y of [0,70,300,590,600])assert.equal(pongTarget(view,...pongPoint(view,35,y)),y);
 assert.equal(pongAxis('bottom','left'),-1);assert.equal(pongAxis('bottom','right'),1);
 assert.equal(pongAxis('top','left'),1);assert.equal(pongAxis('right','up'),1);assert.equal(pongAxis('left','up'),-1);
 assert.equal(pongAxis('bottom','up'),0);
 assert.deepEqual(pongPoint('bottom',35,300),[300,965]);assert.deepEqual(pongPoint('top',35,300),[300,35]);
});
test('吃食物反馈对应吃掉的格子与双方得分，不使用新食物位置',()=>{
 const a={game:'snake',tick:1,score:[0,0],food:16},b={...a,tick:2,food:90,score:[1,0]};
 assert.deepEqual(foodEvents(a,b,100),[{actor:0,cell:16,at:100,points:1}]);
 assert.deepEqual(foodEvents(b,b,101),[]);assert.equal(foodEvents(a,{...b,score:[0,1]},100)[0].actor,1);
});
test('后手水晶在换牌之后首次行动时发放，临时能量只生效一次',()=>{
 let s=initCards(42);const first=s.first,second=1-first;
 assert.ok(s.players.every(p=>p.hand.every(c=>c.cardId!=='T06')));
 for(const actor of [0,1])s=stepCards(s,actor,{type:'mulligan',replace:[]});
 assert.ok(s.players[first].hand.every(c=>c.cardId!=='T06'));
 s=stepCards(s,first,{id:'end'});const coin=s.players[second].hand.find(c=>c.cardId==='T06');assert.ok(coin);
 const max=s.players[second].maxMana,mana=s.players[second].mana;
 s=stepCards(s,second,cardActions(s,second).find(a=>a.uid===coin.uid));
 assert.equal(s.players[second].mana,mana+1);assert.equal(s.players[second].maxMana,max);
 assert.throws(()=>stepCards(s,second,{id:'play:'+coin.uid+':-'}));
 s=stepCards(s,second,{id:'end'});s=stepCards(s,first,{id:'end'});
 assert.equal(s.players[second].mana,2);assert.ok(s.players[second].hand.every(c=>c.cardId!=='T06'));
 s.players[second].hand.push({uid:'cap',cardId:'T06'});s.players[second].mana=8;
 assert.equal(stepCards(s,second,{id:'play:cap:-'}).players[second].mana,8);
 assert.equal(cardInfo('W02',2).health,2);assert.equal(cardInfo('W02',3).health,3);
});
test('三个规则难度只选合法动作，练习档确定且不偷看隐藏牌',()=>{
 let s=initCards(66);for(const actor of [0,1])s=stepCards(s,actor,{type:'mulligan',replace:[]});
 for(let n=0;n<15&&s.winner===null;n++){
  for(const difficulty of ['practice','standard','challenge']){const a=chooseCard(s,s.turn,difficulty);assert.ok(cardActions(s,s.turn).some(b=>b.id===a.id));}
  const t=structuredClone(s);t.players[1-s.turn].hand=t.players[1-s.turn].hand.map(c=>({...c,cardId:'S11'}));t.players.forEach(p=>p.deck.reverse());
  assert.deepEqual(chooseCard(s,s.turn,'practice'),chooseCard(t,t.turn,'practice'));s=stepCards(s,s.turn,chooseCard(s));
 }
});
test('彗星可处理未强化的古树，溅射仍只造成两点伤害',()=>{
 let s=initCards(44);for(const actor of [0,1])s=stepCards(s,actor,{type:'mulligan',replace:[]});
 const a=s.turn,b=1-a,unit=(id,uid)=>{const c=cardInfo(id);return {uid,cardId:id,attack:c.attack,hp:c.health,maxHp:c.health,guard:c.guard,fresh:false,exhausted:false};};
 s.players[a].mana=8;s.players[a].hand=[{uid:'comet',cardId:'S11'}];s.players[b].board=[unit('F05','tree'),unit('F03','healer')];
 s=stepCards(s,a,{id:'play:comet:tree'});assert.equal(s.players[b].board.length,1);assert.equal(s.players[b].board[0].hp,2);assert.equal(cardInfo('S11',2).effect.includes('6 点'),true);
});
function conserved(s){for(const [id,c] of Object.entries(UNITS))assert.equal(s.pool[id]+s.players.reduce((n,p)=>n+p.shop.filter(x=>x===id).length+p.units.filter(u=>u.type===id).reduce((a,u)=>a+3**(u.star-1),0),0),POOL_COPIES[c.cost],id+' 棋池守恒');}
test('八人棋阵共享棋池，五格商店、八格备战席与半场布阵限制',()=>{
 assert.ok(Object.values(POOL_COPIES).every(n=>n>=9),'各费用棋子都应有足够副本合成三星');
 let s=initChess(33);assert.equal(s.players.length,8);assert.ok(s.players.every(p=>p.shop.length===5));conserved(s);
 s=stepChess(s,0,{type:'buy',slot:0});const uid=s.players[0].units[0].uid;conserved(s);
 const snapshot=structuredClone(s);assert.throws(()=>stepChess(s,0,{type:'move',uid,cell:31}));assert.deepEqual(s,snapshot);
 s=stepChess(s,0,{type:'move',uid,cell:32});assert.equal(board(s.players[0]).length,1);
 s=stepChess(s,0,{type:'sell',uid});assert.equal(s.players[0].gold,1);conserved(s);
});
test('三枚棋子升星时保留装备和部署位置，溢出装备退回背包',()=>{
 let s=initChess(8),p=s.players[0],type=p.shop[0];
 p.gold=20;p.level=2;p.units=[{uid:'test-a',type,star:1,cell:35,items:['blade','shell']},{uid:'test-b',type,star:1,cell:null,items:['seed','orb']}];s.pool[type]-=2;conserved(s);
 s=stepChess(s,0,{type:'buy',slot:0});p=s.players[0];assert.equal(p.units.length,1);assert.equal(p.units[0].star,2);assert.equal(p.units[0].cell,35);assert.equal(p.units[0].items.length,3);assert.deepEqual(p.inventory,['orb']);conserved(s);
 s=stepChess(s,0,{type:'sell',uid:p.units[0].uid});assert.equal(s.players[0].inventory.length,4);conserved(s);
});
test('满备战席可通过即时合成购买，无法合成时交易原子失败',()=>{
 let s=initChess(19),p=s.players[0],type=p.shop[0];p.gold=30;
 const other=Object.keys(UNITS).find(id=>id!==type);
 p.units=Array.from({length:8},(_,i)=>({uid:'bench'+i,type:i<2?type:other,star:i<2?1:2,cell:null,items:[]}));
 s=stepChess(s,0,{type:'buy',slot:0});assert.equal(bench(s.players[0]).length,7);
 const t=initChess(20);t.players[0].gold=30;t.players[0].units=Array.from({length:8},(_,i)=>({uid:'full'+i,type:Object.keys(UNITS).filter(id=>id!==t.players[0].shop[0])[i],star:2,cell:null,items:[]}));const snap=structuredClone(t);
 assert.throws(()=>stepChess(t,0,{type:'buy',slot:0}));assert.deepEqual(t,snap);
});
test('经济阈值、经验升级与羁绊不重复计入相同棋子',()=>{
 assert.deepEqual([0,9,10,49,50,99].map(interest),[0,0,1,4,5,5]);assert.deepEqual([0,2,3,4,5,6,7,12].map(streakBonus),[0,0,1,1,2,2,3,3]);
 let s=initChess(1);s.players[0].gold=5;s=stepChess(s,0,{type:'level'});assert.equal(s.players[0].level,4);assert.equal(s.players[0].xp,0);assert.equal(s.players[0].gold,0);
 const a=synergyDetails([{type:'C01'},{type:'C01'},{type:'C02'}]);assert.equal(a.find(t=>t.id==='工坊').count,2);
});
test('完整八人联赛结束、棋池守恒、配对结算一致且可逐步重演',()=>{
 const m=beginStrategy('chess',921);let rounds=0;
 while(m.state.winner===null&&rounds<40){
  const locked=[...m.state.players[0].shop];if(rounds===0)advanceStrategy(m,0,{type:'lock'});
  for(let actor=0;actor<8;actor++)if(m.state.players[actor].hp>0){for(const action of chessPlan(m.state,actor)){advanceStrategy(m,actor,action);conserved(m.state);}}
  assert.equal(m.state.phase,'battle');const rs=m.state.battle.results;assert.equal(new Set(rs.map(r=>r.actor)).size,rs.length);
  for(const r of rs)if(!r.pve&&!r.ghost){const peer=rs.find(x=>x.actor===r.opponent);assert.equal(peer.opponent,r.actor);assert.equal(peer.draw,r.draw);if(!r.draw)assert.notEqual(peer.win,r.win);}
  for(const f of m.state.battle.frames){assert.equal(new Set(f.units.map(u=>u.cell)).size,f.units.length);assert.ok(f.units.every(u=>u.cell>=0&&u.cell<64));}
  const old=m.state;advanceStrategy(m,-1,{type:'advance'});conserved(m.state);rounds++;
  if(rounds===1){assert.deepEqual(m.state.players[0].shop,old.players[0].shop);assert.ok(locked.some(Boolean));advanceStrategy(m,0,{type:'lock'});}
 }
 assert.notEqual(m.state.winner,null);assert.ok(m.state.players[0].placement||m.state.players[0].hp>0);assert.deepEqual(replayStrategy(sealStrategy(m)),m.state);
});
