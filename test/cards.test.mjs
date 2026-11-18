import test from 'node:test';
import assert from 'node:assert/strict';
import {initCards,stepCards,cardActions,chooseCard,rankCardActions,cardView,CARDS,STARTERS} from '../src/cards.mjs';
function ready(){let s=initCards(2);for(const a of [0,1])s=stepCards(s,a,{type:'mulligan',replace:[]});s.turn=0;s.players[0].mana=8;return s;}
const unit=(uid,cardId,extra={})=>({uid,cardId,attack:CARDS[cardId].attack,hp:CARDS[cardId].health,maxHp:CARDS[cardId].health,guard:CARDS[cardId].guard,shield:CARDS[cardId].shield,rush:CARDS[cardId].rush,fresh:false,exhausted:false,...extra});
test('卡组限制、起手交换与先后手补偿',()=>{
 assert.throws(()=>initCards(1,[{faction:'W',deck:Array(20).fill('W01')},{faction:'F'}]));
 let s=initCards(1);assert.equal(s.players[s.first].hand.length,3);assert.equal(s.players[1-s.first].hand.length,4);
 const replaced=s.players[0].hand.map(c=>c.uid);s=stepCards(s,0,{type:'mulligan',replace:replaced});
 assert.ok(s.players[0].hand.every(c=>!replaced.includes(c.uid)));assert.throws(()=>stepCards(s,0,{type:'mulligan',replace:[]}));
});
test('守护拦普通攻击，速攻当回合不能打英雄',()=>{
 const s=ready();s.players[0].board=[unit('a','W04',{fresh:true})];s.players[1].board=[unit('b','N02'),unit('c','N01')];
 assert.deepEqual(cardActions(s).filter(a=>a.type==='attack').map(a=>a.target),['b']);
 s.players[1].board=[];assert.equal(cardActions(s).filter(a=>a.type==='attack').length,0);
 s.players[0].board[0].fresh=false;assert.equal(cardActions(s).filter(a=>a.type==='attack')[0].target,'h1');
});
test('护盾抵挡一包伤害，交换同时发生',()=>{
 const s=ready();s.players[0].board=[unit('a','N04')];s.players[1].board=[unit('b','W02')];
 const t=stepCards(s,0,{id:'attack:a:b'});assert.equal(t.players[0].board.length,0);assert.equal(t.players[1].board[0].hp,3);assert.equal(t.players[1].board[0].shield,false);
});
test('群体伤害先移除同批死者，再按队列召唤，场上最多五个',()=>{
 const s=ready();s.players[0].hand=[{uid:'spell',cardId:'W08'}];
 s.players[1].board=[unit('a','W01'),unit('b','W05',{hp:1}),unit('c','W05',{hp:1}),unit('d','W05',{hp:1})];
 const t=stepCards(s,0,{id:'play:spell:-'});assert.equal(t.players[1].board.length,5);assert.equal(t.players[1].board[0].cardId,'T01');assert.equal(t.players[1].discard.length,4);
});
test('疲劳递增、手牌溢出公开，非法动作不修改状态',()=>{
 const s=ready();s.players[0].deck=[];s.players[0].hand=[{uid:'draw',cardId:'N08'}];
 const t=stepCards(s,0,{id:'play:draw:-'});assert.equal(t.players[0].hp,17);assert.equal(t.players[0].fatigue,2);assert.equal(s.players[0].hp,20);
 assert.throws(()=>stepCards(s,1,{id:'end'}));
});
test('AI 取舍不读取未来抽牌和对手手牌，玩家视图隐藏牌库',()=>{
 const s=ready();s.players[0].hand=[{uid:'draw',cardId:'N08'},{uid:'minion',cardId:'W02'}];
 const t=structuredClone(s);t.players[0].deck.reverse();t.players[1].deck.reverse();t.players[1].hand=t.players[1].hand.map(c=>({...c,cardId:'F05'}));
 assert.deepEqual(rankCardActions(s),rankCardActions(t));
 const view=cardView(s,0);assert.equal(view.seed,undefined);assert.equal(view.players[1].deck,undefined);assert.ok(view.players[1].hand.every(c=>c.cardId===null));
});
test('两个阵营能在规则上限内完成对局',()=>{
 for(let seed=1;seed<=12;seed++){
  let s=initCards(seed);for(const actor of [0,1])s=stepCards(s,actor,chooseCard(s,actor));
  while(s.winner===null&&s.seq<1000)s=stepCards(s,s.turn,chooseCard(s));
  assert.notEqual(s.winner,null);assert.ok(s.players.every(p=>p.board.length<=5&&p.hand.length<=8&&p.mana>=0));
 }
});
