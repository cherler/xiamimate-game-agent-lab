import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CARD_LIST,CARDS,PRESETS,TOKENS} from '../src/catalog.mjs';
import {initCards,stepCards,cardActions,cardInfo,validateDeck,chooseCard,rankCardActions,cardPacket} from '../src/cards.mjs';
import {beginDraft,draftOptions,pickDraft} from '../src/draft.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
const unit=(uid,id,extra={})=>{const c=cardInfo(id);return {uid,cardId:id,attack:c.attack,hp:c.health,maxHp:c.health,guard:!!c.guard,shield:!!c.shield,rush:!!c.rush,drain:!!c.drain,frozen:false,silenced:false,spellTriggers:0,fresh:false,exhausted:false,...extra};};
function ready(faction='S'){let s=initCards(7,[{faction},{faction:'W'}]);for(const actor of [0,1])s=stepCards(s,actor,{type:'mulligan',replace:[]});s.turn=0;s.players[0].mana=s.players[0].maxMana=8;s.players[0].cardsPlayed=s.players[0].spellsPlayed=0;s.players[0].board=[];s.players[1].board=[];return s;}
function play(s,id,target=null,choice){s.players[0].hand.push({uid:'test'+id,cardId:id});const a=cardActions(s,0).find(a=>a.uid==='test'+id&&a.target===target&&(!choice||a.choice===choice));assert.ok(a,'expected legal play '+id);return stepCards(s,0,a);}
test('48 张唯一可构筑卡、六套合法预组，生成物不能进入构筑',()=>{
 assert.equal(CARD_LIST.length,48);assert.equal(new Set(CARD_LIST.map(c=>c.id)).size,48);assert.equal(PRESETS.length,6);
 for(const p of PRESETS)assert.ok(validateDeck(p.faction,p.deck));
 for(const c of CARD_LIST){assert.ok(c.effect&&Number.isInteger(c.cost)&&c.cost>=0);assert.equal(c.kind==='unit',c.health>0);}
 assert.equal(validateDeck('S',[...PRESETS[4].deck.slice(0,-1),'T05']),false);
});
test('连奏需要先出牌，英雄技能不算；额外效果只结算一次',()=>{
 let s=ready();s.players[0].hand=[];s=stepCards(s,0,{id:'power:-'});assert.equal(s.players[0].cardsPlayed,0);
 s=play(s,'S04');assert.equal(s.players[0].board[0].shield,false);
 let t=ready();t.players[0].hand=[];t.players[1].board=[unit('target','N05')];t=play(t,'T05','target');t=play(t,'S04');assert.equal(t.players[0].board[0].shield,true);
 const before=t.players[0].deck.length;t=play(t,'S03');assert.equal(t.players[0].deck.length,before-1);assert.equal(t.players[0].cardsPlayed,3);
});
test('冰封穿过护盾，阻止目标的下一回合攻击并在其回合末解除',()=>{
 let s=ready();s.players[0].hand=[];s.players[1].board=[unit('target','W02')];s=play(s,'S02','target');assert.equal(s.players[1].board[0].hp,3);assert.equal(s.players[1].board[0].frozen,true);
 s=stepCards(s,0,{id:'end'});assert.equal(cardActions(s,1).filter(a=>a.type==='attack').length,0);s=stepCards(s,1,{id:'end'});assert.equal(s.players[1].board[0].frozen,false);
 s=stepCards(s,0,{id:'end'});assert.ok(cardActions(s,1).some(a=>a.type==='attack'));
});
test('汲取只按实际生命伤害回复，护盾与过量伤害不算',()=>{
 let s=ready();s.players[0].hp=10;s.players[0].board=[unit('own','N10')];s.players[1].board=[unit('target','N01',{hp:1})];let t=stepCards(s,0,{id:'attack:own:target'});assert.equal(t.players[0].hp,11);
 s.players[1].board[0].shield=true;t=stepCards(s,0,{id:'attack:own:target'});assert.equal(t.players[0].hp,10);
 s.players[0].hand=[];s.players[1].board=[unit('target','N01',{hp:2})];t=play(s,'S08','target');assert.equal(t.players[0].hp,12);
});
test('沉默移除强化与触发效果，不能治疗目标或留下遗赠',()=>{
 let s=ready();s.players[0].hand=[];s.players[1].board=[unit('target','W05',{attack:8,maxHp:9,hp:7,guard:true,shield:true,frozen:true})];s=play(s,'N11','target');
 const u=s.players[1].board[0];assert.equal(u.attack,5);assert.equal(u.maxHp,5);assert.equal(u.hp,5);assert.equal(u.guard||u.shield||u.frozen,false);assert.equal(u.silenced,true);
 s.players[0].mana=8;s=play(s,'S11','target');assert.equal(s.players[1].board.length,0);
});
test('余辉只在己方回合末触发，实际治疗使古藤成长，满血不触发',()=>{
 const s=ready('F');s.players[0].hp=15;s.players[0].board=[unit('a','F10'),unit('b','F11')];s.players[1].board=[unit('enemy','F10')];
 const t=stepCards(s,0,{id:'end'});assert.equal(t.players[0].hp,17);assert.equal(t.players[0].board[1].attack,3);assert.equal(t.players[0].board[1].maxHp,CARDS.F11.health+1);assert.equal(t.players[1].hp,20);
 s.players[0].hp=20;assert.equal(stepCards(s,0,{id:'end'}).players[0].board[1].attack,2);
});
test('装配师只强化召唤物，已同批死亡的装配师不能继续强化',()=>{
 let s=ready('W');s.players[0].hand=[];s.players[0].board=[unit('magnet','W10')];s=play(s,'W09');assert.equal(s.players[0].board.find(u=>u.cardId==='W09').attack,1);assert.equal(s.players[0].board.find(u=>u.cardId==='T01').attack,2);
 let t=ready('W');t.players[0].hand=[];t.players[1].board=[unit('m','W10',{hp:1}),unit('mouse','W01')];t=play(t,'W08');assert.equal(t.players[1].board.length,1);assert.equal(t.players[1].board[0].attack,1);
});
test('抉择只执行一个分支，满场不会多召唤，非法分支不生效',()=>{
 let s=ready('F');s.players[0].hand=[{uid:'choice',cardId:'F12'}];s.players[0].hp=10;s.players[0].board=Array.from({length:4},(_,i)=>unit('u'+i,'F01'));
 const before=s.players[0].deck.length,bloom=stepCards(s,0,{id:'play:choice:bloom:-'}),renew=stepCards(s,0,{id:'play:choice:renew:-'});
 assert.equal(bloom.players[0].board.length,5);assert.equal(bloom.players[0].hp,10);assert.equal(bloom.players[0].mana,5);assert.equal(bloom.players[0].deck.length,before);
 assert.equal(renew.players[0].board.length,4);assert.equal(renew.players[0].hp,14);assert.equal(renew.players[0].deck.length,before-1);assert.throws(()=>stepCards(s,0,{id:'play:choice:both:-'}));
});
test('施法成长每回合两次封顶，导师余辉要求施法，生成火花也能触发',()=>{
 let s=ready();s.players[0].hand=[];s.players[0].board=[unit('pupil','S01'),unit('mentor','S10')];s.players[1].board=[unit('enemy','N05')];
 for(let i=0;i<3;i++)s=play(s,'T05','enemy');assert.equal(s.players[0].board[0].attack,3);s=stepCards(s,0,{id:'end'});assert.equal(s.players[0].board.filter(u=>u.cardId==='T04').length,1);
 const t=ready();t.players[0].board=[unit('mentor','S10')];assert.equal(stepCards(t,0,{id:'end'}).players[0].board.length,1);
});
test('轮抽三选一可重现，三阵营都能完成 20 张且不超过两张同牌',()=>{
 for(const faction of ['W','F','S'])for(let seed=1;seed<=20;seed++){
  let d=beginDraft(seed,faction);for(let i=0;i<20;i++){const opts=draftOptions(d);assert.equal(new Set(opts).size,3);assert.deepEqual(opts,draftOptions(structuredClone(d)));d=pickDraft(d,opts[(seed+i)%3]);}
  assert.ok(validateDeck(faction,d.picks));assert.deepEqual(draftOptions(d),[]);assert.throws(()=>pickDraft(d,'N01'));
 }
});
test('新 AI 候选不受隐藏牌序、对方手牌与随机种子影响',()=>{
 const s=ready();s.players[0].hand=[{uid:'draw',cardId:'S05'},{uid:'combo',cardId:'S03'},{uid:'spell',cardId:'N12'}];s.players[1].board=[unit('e','N02')];
 const t=structuredClone(s);t.players[0].deck.reverse();t.players[1].deck.reverse();t.players[1].hand=t.players[1].hand.map(c=>({...c,cardId:'S11'}));t.seed=999;
 assert.deepEqual(rankCardActions(s),rankCardActions(t));assert.deepEqual(cardPacket(s,0),cardPacket(t,0));
});
test('扩展版完整对局重演与上一版回放兼容',()=>{
 const old=JSON.parse(fs.readFileSync(new URL('./fixtures/cards-v1.json',import.meta.url)));assert.equal(replayStrategy(old).version,1);
 for(let i=0;i<6;i++){
  const decks=[PRESETS[i],PRESETS[(i+1)%6]],m=beginStrategy('cards',100+i,decks.map(d=>({faction:d.faction,deck:d.deck})));
  for(const actor of [0,1])advanceStrategy(m,actor,chooseCard(m.state,actor));
  while(m.state.winner===null&&m.state.seq<1000)advanceStrategy(m,m.state.turn,chooseCard(m.state));
  assert.notEqual(m.state.winner,null);assert.equal(m.record.format,'glimmer-3');assert.deepEqual(replayStrategy(sealStrategy(m)),m.state);
 }
});
