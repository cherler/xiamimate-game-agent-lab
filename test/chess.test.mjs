import test from 'node:test';
import assert from 'node:assert/strict';
import {initChess,stepChess,chessPlan,chessView,chessPacket,formation,synergyLabels,UNIT_LIST} from '../src/chess-v1.mjs';
import {runBattle} from '../src/chess-battle-v1.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {RoomStore} from '../rooms.mjs';
const count=s=>Object.values(s.pool).reduce((a,b)=>a+b,0)+s.players.reduce((n,p)=>n+p.shop.filter(Boolean).length+p.units.reduce((n,u)=>n+3**(u.star-1),0),0);
function offers(s,actor,types){const t=structuredClone(s),p=t.players[actor];for(const type of p.shop)if(type)t.pool[type]++;p.shop=types;for(const type of types)if(type)t.pool[type]--;p.gold=99;return t;}
test('共享池、商店、三合一与卖出保持 144 个基础副本',()=>{
 let s=offers(initChess(9),0,['C01','C01','C01','C02']);assert.equal(count(s),144);
 for(let slot=0;slot<3;slot++){s=stepChess(s,0,{type:'buy',slot});assert.equal(count(s),144);}
 assert.equal(s.players[0].units.length,1);assert.equal(s.players[0].units[0].star,2);
 s=stepChess(s,0,{type:'sell',uid:s.players[0].units[0].uid});assert.equal(count(s),144);assert.equal(s.players[0].gold,99);
 s=stepChess(s,0,{type:'roll'});assert.equal(count(s),144);
});
test('人口、半场、备战席上限和非法操作是原子检查',()=>{
 let s=offers(initChess(2),0,['C01','C02','C03','C04']);for(let slot=0;slot<4;slot++)s=stepChess(s,0,{type:'buy',slot});
 s=stepChess(s,0,formation(s,0));assert.equal(s.players[0].units.filter(u=>u.cell!==null).length,3);
 const bench=s.players[0].units.find(u=>u.cell===null);assert.throws(()=>stepChess(s,0,{type:'move',uid:bench.uid,cell:35}));assert.throws(()=>stepChess(s,0,{type:'move',uid:bench.uid,cell:1}));
 const before=JSON.stringify(s);assert.throws(()=>stepChess(s,0,{type:'buy',slot:0}));assert.equal(JSON.stringify(s),before);
});
test('同名只算一种羁绊，默认阵容激活五条羁绊',()=>{
 assert.deepEqual(synergyLabels([{type:'C01'},{type:'C01'}]),[]);
 assert.equal(synergyLabels(['C01','C02','C03','C04','C05','C06'].map(type=>({type}))).length,5);
});
test('自动战斗可重复、每格最多一个棋子、战斗有明确上限',()=>{
 let s=initChess(19);for(const actor of [0,1])for(const a of chessPlan(s,actor,'strength'))s=stepChess(s,actor,a);
 assert.equal(s.phase,'battle');assert.deepEqual(runBattle(s),s.battle);assert.ok(s.battle.ticks<=300);
 for(const f of s.battle.frames){assert.equal(new Set(f.units.map(u=>u.cell)).size,f.units.length);assert.ok(f.units.every(u=>u.hp>0&&u.hp<=u.maxHp));}
});
test('空阵平局同时扣血可结束比赛，准备期间不能直接结算',()=>{
 let s=initChess(1);s.players.forEach(p=>p.hp=2);assert.throws(()=>stepChess(s,0,{type:'advance'}));
 for(const actor of [0,1])s=stepChess(s,actor,{type:'ready'});s=stepChess(s,-1,{type:'advance'});assert.equal(s.winner,-1);
});
test('玩家视图与模型观察不泄漏对手金币、商店和未来随机序列',()=>{
 const s=initChess(8),v=chessView(s,0);assert.equal(v.seed,undefined);assert.equal(v.pool,undefined);assert.equal(v.players[1].shop,undefined);assert.equal(v.players[1].gold,undefined);
 const t=structuredClone(s);t.players[1].gold=999;t.players[1].shop=['C12','C12','C12','C12'];t.seed=987;
 assert.deepEqual(chessPacket(s,0),chessPacket(t,0));
});
test('完整经营比赛、快照和动作流能够重现最终状态',()=>{
 for(let seed=81;seed<86;seed++){
  const m=beginStrategy('chess',seed,null,'glimmer-1');
  while(m.state.winner===null){for(const actor of [0,1])for(const a of chessPlan(m.state,actor,actor?'balanced':'strength'))advanceStrategy(m,actor,a);advanceStrategy(m,-1,{type:'advance'});assert.equal(count(m.state),144);}
  const rec=sealStrategy(m);assert.deepEqual(replayStrategy(rec),m.state);assert.throws(()=>replayStrategy({...rec,end:{...rec.end,hash:'broken'}}));
 }
});
test('好友房绑定席位，隐藏卡牌与商店，拒绝未授权、抢回合和错版本',()=>{
 const store=new RoomStore(),a=store.create('cards',{faction:'W'}),b=store.join(a.code,{faction:'F'});
 assert.throws(()=>store.view(a.code,'wrong'));assert.throws(()=>store.join(a.code,{}));
 const v=store.view(a.code,a.token);assert.equal(v.state.players[1].hand[0].cardId,null);assert.throws(()=>store.act(a.code,a.token,99,{id:'end'}));
 store.act(a.code,a.token,v.state.seq,{type:'mulligan',replace:[]});const v1=store.view(a.code,b.token);store.act(a.code,b.token,v1.state.seq,{type:'mulligan',replace:[]});
 const r=store.rooms.get(a.code),other=1-r.match.state.turn;assert.throws(()=>store.act(a.code,r.tokens[other],r.match.state.seq,{id:'end'}));assert.throws(()=>store.replay(a.code,a.token));
 const ca=store.create('chess'),cb=store.join(ca.code,{game:'chess'});assert.equal(store.view(ca.code,ca.token).state.players[1].shop,undefined);assert.throws(()=>store.act(ca.code,cb.token,0,{type:'advance'}));
});
test('好友房同时经营和换牌不会互相阻塞，拒绝自身重复与跨阶段旧操作',()=>{
 const store=new RoomStore(),a=store.create('chess'),b=store.join(a.code,{game:'chess'});
 store.act(a.code,a.token,0,{type:'buy',slot:0});store.act(a.code,b.token,0,{type:'buy',slot:0});
 assert.throws(()=>store.act(a.code,a.token,0,{type:'buy',slot:1}));
 const r=store.rooms.get(a.code);for(const [actor,auth] of [[0,a.token],[1,b.token]])store.act(a.code,auth,r.match.state.seq,{type:'ready'});
 r.deadline=0;store.view(a.code,a.token);assert.equal(r.match.state.phase,'prep');assert.throws(()=>store.act(a.code,a.token,1,{type:'buy',slot:0}));
 const c=store.create('cards',{faction:'W'}),d=store.join(c.code,{faction:'F'});
 store.act(c.code,c.token,0,{type:'mulligan',replace:[]});store.act(c.code,d.token,0,{type:'mulligan',replace:[]});assert.equal(store.view(c.code,c.token).state.phase,'play');
});
test('好友房超时自动确认、结束回合与开始及结算棋阵战斗',()=>{
 const store=new RoomStore(),a=store.create('cards'),b=store.join(a.code,{}),r=store.rooms.get(a.code);
 r.deadline=0;store.view(a.code,a.token);assert.equal(r.match.state.phase,'play');const turn=r.match.state.turn;r.deadline=0;store.view(a.code,b.token);assert.equal(r.match.state.turn,1-turn);
 const c=store.create('chess');store.join(c.code,{});const q=store.rooms.get(c.code);q.deadline=0;store.view(c.code,c.token);assert.equal(q.match.state.phase,'battle');q.deadline=0;store.view(c.code,c.token);assert.equal(q.match.state.round,2);assert.deepEqual(q.match.state.players.map(p=>p.hp),[28,28]);
});
