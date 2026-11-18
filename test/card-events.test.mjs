import test from 'node:test';
import assert from 'node:assert/strict';
import {initCards,stepCards,cardActions,cardInfo,cardView} from '../src/cards.mjs';
import {cardPresentation} from '../src/card-events.mjs';
import {beginStrategy,advanceStrategy} from '../src/strategy.mjs';
import {RoomStore} from '../rooms.mjs';
import {decoratePresentation,projectCardEvent} from '../web/card-effects.mjs';
const unit=(uid,id,extra={})=>{const c=cardInfo(id);return {uid,cardId:id,attack:c.attack,hp:c.health,maxHp:c.health,guard:!!c.guard,shield:!!c.shield,rush:!!c.rush,drain:!!c.drain,frozen:false,silenced:false,spellTriggers:0,fresh:false,exhausted:false,...extra};};
function ready(faction='S'){let s=initCards(7,[{faction},{faction:'F'}]);for(const actor of [0,1])s=stepCards(s,actor,{type:'mulligan',replace:[]});s.turn=0;s.players[0].mana=s.players[0].maxMana=8;s.players[0].hand=[];s.players[0].board=[];s.players[1].board=[];return s;}
function cast(s,id,target=null){s.players[0].hand.push({uid:'spell',cardId:id});const a=cardActions(s,0).find(a=>a.uid==='spell'&&a.target===target);assert.ok(a);return stepCards(s,0,a,{trace:true});}
test('法术事件记录真实来源、目标和原始伤害，额外展示数据不进入局面',()=>{
 const before=ready();before.players[1].hp=2;const next=cast(before,'S06','h1'),cue=cardPresentation(next);assert.equal(cue.source.cardId,'S06');assert.equal(cue.seq,next.seq);assert.deepEqual(cue.events.filter(e=>e.kind==='damage').map(e=>[e.source.cardId,e.target,e.amount,e.actual]),[['S06','h1',2,2]]);assert.ok(!JSON.stringify(next).includes('events'));assert.deepEqual(next,stepCards(before,0,{id:'play:spell:h1'}));
});
test('冰封打破护盾后单独生效，不伪装成扣血',()=>{
 const s=ready();s.players[1].board=[unit('shield','W02')];const cue=cardPresentation(cast(s,'S02','shield'));assert.deepEqual(cue.events.map(e=>e.kind),['block','freeze']);assert.equal(cue.events[0].amount,2);assert.equal(cue.events[0].source.cardId,'S02');
});
test('伤害、退场、遗赠治疗保留因果顺序，净生命变化为零也不会丢失伤害',()=>{
 const s=ready('W');s.players[0].hp=18;s.players[0].board=[unit('attacker','N01')];s.players[1].hp=18;s.players[1].board=[unit('seed','F01',{hp:1})];
 const after=stepCards(s,0,{id:'attack:attacker:seed'},{trace:true}),cue=cardPresentation(after),events=cue.events;
 assert.deepEqual(events.map(e=>e.kind),['damage','damage','death','trigger','heal']);assert.equal(events[0].source.cardId,'N01');assert.equal(events[1].source.cardId,'F01');assert.equal(events[4].source.cardId,'F01');assert.equal(events[4].source.trigger,'遗赠');assert.equal(events[4].target,'h1');
 const display=structuredClone(s);for(const e of events)projectCardEvent(display,e);assert.deepEqual(display.players.map(p=>({hp:p.hp,board:p.board.map(u=>({uid:u.uid,hp:u.hp}))})),after.players.map(p=>({hp:p.hp,board:p.board.map(u=>({uid:u.uid,hp:u.hp}))})));
});
test('汲取分别显示伤害和实际回复，过量伤害不转成过量治疗',()=>{
 const s=ready();s.players[0].hp=12;s.players[1].board=[unit('target','N01',{hp:1})];const events=cardPresentation(cast(s,'S08','target')).events;
 assert.equal(events.find(e=>e.kind==='damage').amount,3);assert.equal(events.find(e=>e.kind==='damage').actual,1);assert.equal(events.find(e=>e.kind==='heal').amount,1);assert.equal(events.find(e=>e.kind==='heal').source.trigger,'汲取');
});
test('抽牌事件不泄露牌名、牌序或抽到的手牌编号',()=>{
 const s=ready();const beforeCards=s.players[0].deck.slice(0,2).map(c=>c.cardId);const next=cast(s,'N08'),cue=cardPresentation(next),draws=cue.events.filter(e=>e.kind==='draw');assert.equal(draws.length,2);for(const d of draws){assert.deepEqual(Object.keys(d).sort(),['actor','kind','source']);assert.equal(d.source.cardId,'N08');}assert.ok(beforeCards.every(id=>!JSON.stringify(draws).includes('"cardId":"'+id+'"')));
});
test('余辉和治疗成长分别指出祭司与古藤，不归因给结束回合',()=>{
 const s=ready('F');s.players[0].hp=15;s.players[0].board=[unit('priest','F10'),unit('vine','F11')];const cue=cardPresentation(stepCards(s,0,{id:'end'},{trace:true}));
 assert.equal(cue.events.find(e=>e.kind==='heal').source.cardId,'F10');assert.equal(cue.events.find(e=>e.kind==='buff').source.cardId,'F11');assert.equal(decoratePresentation(cue,s,stepCards(s,0,{id:'end'})).focus.cardId,'F10');
});
test('群体法术同批命中，死亡后新召唤物不会被加入原始受击名单',()=>{
 const s=ready('W');s.players[1].board=[unit('mouse','W01'),unit('other','N01')];const cue=cardPresentation(cast(s,'W08')),hits=cue.events.filter(e=>e.kind==='damage');assert.equal(hits.length,2);assert.equal(hits[0].batch,hits[1].batch);assert.deepEqual(hits.map(e=>e.target),['mouse','other']);const summon=cue.events.find(e=>e.kind==='summon');assert.equal(summon.source.cardId,'W01');assert.equal(summon.unit.cardId,'T01');
});
test('好友房为两位玩家提供逐步公开事件和各自视角的局面快照',()=>{
 const store=new RoomStore(),a=store.create('cards',{faction:'S'}),b=store.join(a.code,{game:'cards',faction:'F'}),r=store.get(a.code,a.token).r;r.match={state:ready(),record:beginStrategy('cards',7).record};r.match.state.players[0].hand=[{uid:'public-spell',cardId:'S06'},{uid:'secret-hand',cardId:'N11'}];
 const result=store.act(a.code,a.token,r.match.state.seq,{id:'play:public-spell:h1'}),other=store.view(a.code,b.token);assert.equal(result.presentations.length,1);assert.equal(other.presentations[0].cue.source.cardId,'S06');const serialized=JSON.stringify(other.presentations);assert.ok(!serialized.includes('secret-hand'));assert.ok(!serialized.includes('"seed"'));assert.ok(!serialized.includes('"deck"'));assert.ok(other.presentations.every(p=>p.state.players[0].hand.every(c=>c.cardId===null)));
 for(let i=0;i<28&&r.match.state.winner===null;i++)store.advance(r,r.match.state.turn,{id:'end'});assert.ok(r.recent.length<=24);
});
