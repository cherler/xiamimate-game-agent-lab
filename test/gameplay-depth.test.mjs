import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initCards,stepCards,cardActions,cardView,rankCardActions} from '../src/cards.mjs';
import {cardPresentation} from '../src/card-events.mjs';
import {initChess,stepChess,chessPlan,formation,nextChessOpponent} from '../src/chess.mjs';
import {replayStrategy} from '../src/strategy.mjs';
import {initRescue,commandRescue,stepRescue,replayRescue,rescueMap} from '../src/rescue.mjs';

const fixture=name=>JSON.parse(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)));
function cards(faction='W'){
 let s=initCards(123,[{faction},{faction:'F'}]);for(const actor of [0,1])s=stepCards(s,actor,{type:'mulligan',replace:[]});s.turn=0;s.players[0].mana=s.players[0].maxMana=5;return s;
}
function gathering(){
 let s=commandRescue(initRescue({version:4}),{type:'start'});s.civilians.forEach((c,i)=>Object.assign(c,{x:2.2+i%4*.65,y:12.2+Math.floor(i/4)*.45,status:'following',leader:'s0'}));return stepRescue(s);
}
test('分支升级保留牌局、八人棋阵和三关救援的旧完整回放',()=>{
 assert.equal(replayStrategy(fixture('cards-practice-complete.json')).version,3);
 assert.equal(replayStrategy(fixture('chess-glimmer3-complete.json')).version,2);
 for(const level of [1,2,3]){const s=replayRescue(fixture('rescue-v3-level'+level+'.json'));assert.equal(s.version,3);assert.equal(s.winner,true);assert.equal(s.saved,rescueMap(level,3).total);}
});
test('调度花费能量，回牌库底再抽牌，不增加手牌或连奏次数',()=>{
 let s=cards(),p=s.players[0],returned=p.hand[0],top=p.deck[0],mana=p.mana,count=p.hand.length;
 const t=stepCards(s,0,{id:'cycle:'+returned.uid},{trace:true}),q=t.players[0];
 assert.equal(q.mana,mana-1);assert.equal(q.hand.length,count);assert.equal(q.hand.at(-1).uid,top.uid);assert.equal(q.deck.at(-1).uid,returned.uid);assert.equal(q.cardsPlayed,0);assert.equal(q.powerUsed,false);assert.equal(q.cycled,true);
 assert.ok(!cardActions(t,0).some(a=>a.type==='cycle'));assert.ok(cardPresentation(t).events.every(e=>!e.cardId&&!e.source?.cardId),'调度不暴露放回牌的身份');
 s=stepCards(stepCards(t,0,{id:'end'}),1,{id:'end'});assert.equal(s.players[0].cycled,false);
});
test('空牌库、生成牌、无能量不能调度；拒绝不改变原状态',()=>{
 let s=cards();s.players[0].hand=[{uid:'coin',cardId:'T06'}];assert.ok(!cardActions(s,0).some(a=>a.type==='cycle'));
 s=cards();s.players[0].deck=[];assert.ok(!cardActions(s,0).some(a=>a.type==='cycle'));
 s=cards();s.players[0].mana=0;const before=structuredClone(s);assert.throws(()=>stepCards(s,0,{id:'cycle:'+s.players[0].hand[0].uid}));assert.deepEqual(s,before);
});
test('英雄技能双选共用次数，工坊造偶与林地守护确实进入战场',()=>{
 for(const [faction,mode,type]of [['W','assemble','T01'],['F','seedling','T07']]){
  let s=cards(faction);s=stepCards(s,0,{id:'power:'+mode});const p=s.players[0];assert.equal(p.board.at(-1).cardId,type);assert.equal(p.mana,3);assert.equal(p.powerUsed,true);assert.equal(p.cardsPlayed,0);assert.ok(!cardActions(s,0).some(a=>a.type==='power'));
  if(faction==='F'){assert.equal(p.board[0].guard,true);assert.equal(p.board[0].attack,0);assert.equal(p.board[0].hp,2);}
 }
});
test('燃灯观星付出两点生命抽牌，有生命和手牌上限限制',()=>{
 const s=cards('S'),hp=s.players[0].hp,n=s.players[0].hand.length,t=stepCards(s,0,{id:'power:stargaze'});assert.equal(t.players[0].hp,hp-2);assert.equal(t.players[0].hand.length,n+1);assert.equal(t.players[0].mana,3);
 for(const change of [p=>p.hp=2,p=>p.deck=[],p=>p.hand=Array.from({length:8},(_,i)=>({uid:'c'+i,cardId:'S01'}))]){const t=structuredClone(s);change(t.players[0]);assert.ok(!cardActions(t,0).some(a=>a.mode==='stargaze'));}
});
test('新动作可从隐藏牌库视图生成，AI 不通过调度偷看下一张牌',()=>{
 const s=cards('S');s.players[0].maxMana=1;s.players[0].hand=[{uid:'high',cardId:'S11'},{uid:'cheap',cardId:'S01'}];const t=structuredClone(s);t.players.forEach(p=>p.deck.reverse());t.players[1].hand.forEach(c=>c.cardId='F05');
 assert.deepEqual(cardActions(cardView(s,0),0),cardActions(s,0));assert.deepEqual(rankCardActions(s,0),rankCardActions(t,0));
});
test('本轮预告对手在经营期间不变化，并与实际配对一致',()=>{
 let s=initChess(41003);for(let round=1;round<=6;round++){
  const forecast=nextChessOpponent(s);for(const actor of [1,2,3,4,5,6,7,0])if(s.players[actor].hp>0)for(const a of chessPlan(s,actor)){s=stepChess(s,actor,a);assert.equal(nextChessOpponent(s),forecast);}
  assert.equal(s.battle.opponent,forecast);s=stepChess(s,-1,{type:'advance'});
 }
});
test('野怪奖励提供三个不同装备，选一个后不能重复领或跳过选择',()=>{
 let s=initChess(41003);for(let actor=0;actor<8;actor++)for(const a of chessPlan(s,actor))s=stepChess(s,actor,a);s=stepChess(s,-1,{type:'advance'});
 const p=s.players[0];assert.equal(p.loot.options.length,3);assert.equal(new Set(p.loot.options).size,3);assert.equal(p.inventory.length,0);assert.throws(()=>stepChess(s,0,{type:'ready'}));
 const picked=p.loot.options[1];s=stepChess(s,0,{type:'loot',slot:1});assert.equal(s.players[0].loot,null);assert.deepEqual(s.players[0].inventory,[picked]);assert.throws(()=>stepChess(s,0,{type:'loot',slot:0}));
});
test('拆卸付出一金币，装备回到背包，棋子与棋池不变',()=>{
 let s=initChess(41003);s=stepChess(s,0,{type:'buy',slot:0});const uid=s.players[0].units[0].uid;s.players[0].gold=3;s.players[0].inventory=['shell'];s=stepChess(s,0,{type:'equip',uid,slot:0});const pool=structuredClone(s.pool);
 s=stepChess(s,0,{type:'unequip',uid,slot:0});assert.equal(s.players[0].gold,2);assert.equal(s.players[0].units[0].items.length,0);assert.deepEqual(s.players[0].inventory,['shell']);assert.deepEqual(s.pool,pool);
 const before=structuredClone(s);assert.throws(()=>stepChess(s,0,{type:'unequip',uid,slot:0}));assert.deepEqual(s,before);
});
test('平民先集结，主动呼叫才开始读秒和额外尸潮，不能重复呼叫',()=>{
 let s=gathering();for(let i=0;i<10;i++)s=stepRescue(s);assert.equal(s.evac.phase,'gathering');assert.equal(s.evac.progress,0);assert.equal(s.evac.alerts,0);assert.equal(s.saved,0);
 s=commandRescue(s,{type:'pause'});s=commandRescue(s,{type:'evacuate'});assert.equal(stepRescue(s).tick,s.tick);assert.throws(()=>commandRescue(s,{type:'evacuate'}));s=stepRescue(commandRescue(s,{type:'resume'}));assert.equal(s.evac.phase,'loading');assert.equal(s.evac.progress,1);assert.equal(s.schedule.filter(w=>w.assault).length,rescueMap(s.level,s.version).extraction.count);
});
test('战术补给拒绝隔墙、超距或空治疗；无效动作不消耗资源',()=>{
 const s=commandRescue(initRescue(),{type:'start'}),before=structuredClone(s);for(const a of [{type:'decoy',x:20,y:12},{type:'decoy',x:4,y:9},{type:'medic',x:4.5,y:12}])assert.throws(()=>commandRescue(s,a));assert.deepEqual(s,before);
});
test('急救恢复范围内存活队员，清除感染进度，不复活或过量治疗',()=>{
 const s=gathering();s.soldiers[0].hp=80;s.soldiers[1].hp=0;s.civilians[0].infection=12;const t=commandRescue(s,{type:'medic',x:4,y:12});assert.equal(t.soldiers[0].hp,110);assert.equal(t.soldiers[1].hp,0);assert.equal(t.civilians[0].infection,0);assert.equal(t.supplies,1);assert.equal(t.supportUsed.medic,1);
});
test('诱饵改变丧尸路径，六秒后失效并恢复正常追击',()=>{
 let s=commandRescue(initRescue(),{type:'start'});s.soldiers.forEach(u=>u.cooldown=1000);s.zombies=[{id:'z990',kind:'zombie',x:4.5,y:7.5,r:.23,hp:1000,maxHp:1000,fast:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:0,hitTick:-100}];s=commandRescue(s,{type:'decoy',x:4.5,y:8.5});s=stepRescue(s);assert.equal(s.zombies[0].target,'decoy0');assert.equal(s.supplies,1);while(s.tick<181)s=stepRescue(s);assert.equal(s.decoys.length,0);assert.notEqual(s.zombies[0].target,'decoy0');
});
test('补给箱需要队员实际到达，每箱只领取一次',()=>{
 let s=commandRescue(initRescue(),{type:'start'});const box=s.crates[0];s.soldiers[0].x=box.x;s.soldiers[0].y=box.y;s=stepRescue(s);assert.equal(s.supplies,3);assert.equal(s.crates[0].claimed,true);for(let i=0;i<5;i++)s=stepRescue(s);assert.equal(s.supplies,3);
});
