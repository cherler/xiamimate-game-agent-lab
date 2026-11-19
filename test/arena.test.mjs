import test from 'node:test';
import assert from 'node:assert/strict';
import { initSnake,stepSnake,snakeMoves,snakePacket } from '../src/snake.mjs';
import { initPong,stepPong,LEFT,HALF } from '../src/pong.mjs';
import { begin,advance,seal,checkReplay,simulate } from '../src/arena.mjs';
import { openWindow } from '../src/decisions.mjs';
import {readFileSync} from 'node:fs';

test('首颗食物双方等距且不与出生身体重合',()=>{
  const distance=(a,b)=>Math.abs(a%11-b%11)+Math.abs(Math.floor(a/11)-Math.floor(b/11));
  for(const seed of [0,1,41003,0xffffffff]){
    const s=initSnake(seed);assert.equal(distance(s.bodies[0][0],s.food),distance(s.bodies[1][0],s.food));assert.ok(!s.bodies.flat().includes(s.food));
  }
});
test('死亡反馈区分墙、自身、对手身体与蛇头相撞',()=>{
  const base=initSnake(5);
  const wall=stepSnake({...base,bodies:[[44,45],[76,75]],dirs:['left','right']},['left','right']);assert.deepEqual(wall.collisions.map(x=>x.kind),['撞墙','撞墙']);assert.ok(wall.collisions.every(x=>x.x>=0&&x.x<11&&x.y>=0&&x.y<11));
  const self=stepSnake({...base,bodies:[[60,61,50,49,48],[90,89]],dirs:['up','right'],food:10},['right','up']);assert.equal(self.collisions[0].kind,'撞到自己');
  const rival=stepSnake({...base,bodies:[[60,59],[61,62,63]],dirs:['right','left'],food:10},['right','up']);assert.equal(rival.collisions[0].kind,'撞到对手');
  const heads=stepSnake({...base,bodies:[[60,59],[62,63]],dirs:['right','left'],food:10},['right','left']);assert.deepEqual(heads.collisions.map(x=>x.kind),['蛇头相撞','蛇头相撞']);
});
test('修改首颗食物与死亡反馈后仍能校验旧版蛇完整回放',()=>{
  const record=JSON.parse(readFileSync(new URL('fixtures/snake-round2.1.json',import.meta.url),'utf8'));
  const state=checkReplay(record);assert.equal(state.tick,record.end.tick);assert.equal(state.reason,'碰撞出局');assert.equal(state.rules,undefined);
});

test('同格抢食同时出局，双方不得分',()=>{
  const s={...initSnake(1),bodies:[[54,65],[52,51]],dirs:['up','right'],food:53};
  const t=stepSnake(s,['left','right']);
  assert.equal(t.winner,-1);assert.deepEqual(t.score,[0,0]);assert.deepEqual(t.alive,[false,false]);
});
test('蛇同时交换头部也碰撞',()=>{
  const s={...initSnake(9),bodies:[[55],[56]],dirs:['right','left'],food:98};
  assert.equal(stepSnake(s,['right','left']).winner,-1);
});
test('尾部当步离开可以进入，吃食时尾部仍占位',()=>{
  const s={...initSnake(2),bodies:[[55,44],[57,56]],dirs:['down','right'],food:89};
  assert.equal(stepSnake(s,['right','right']).alive[0],true);
  assert.equal(stepSnake({...s,food:58},['right','right']).winner,1);
});
test('不许掉头或横向穿墙，两侧同一规则',()=>{
  const s={...initSnake(2),bodies:[[44,45],[76,75]],dirs:['left','right'],food:66};
  assert.throws(()=>stepSnake(s,['right','right']));
  assert.equal(stepSnake(s,['left','right']).winner,-1);assert.equal(s.tick,0);
});
test('第 180 步按长度结算',()=>{
  const s={...initSnake(3),tick:179,bodies:[[24,23,22,11],[84,85]],dirs:['right','left'],food:99};
  assert.equal(stepSnake(s,['right','left']).winner,0);
});
test('模型包仅包含可观察局面，固定候选中包含可犯错的方向',()=>{
  const s=initSnake(18),packet=snakePacket(s,0),different=snakePacket({...s,seed:s.seed+99},0);
  assert.deepEqual(packet,different);assert.deepEqual(Object.keys(packet.questions.move.criteria),snakeMoves(s,0));
  assert.deepEqual(Object.keys(packet.state).sort(),['board','rival','you']);
});
test('历史对局保留双方球拍速度和 6 帧采样',()=>{
  let s=stepPong(initPong(1,{legacy:true}),[0,600]);assert.deepEqual(s.paddles,[292,308]);
  for(let i=0;i<5;i++)s=stepPong(s,[600,0]);
  assert.deepEqual(s.paddles,[252,348]);s=stepPong(s,[600,0]);assert.deepEqual(s.paddles,[260,340]);
});
test('球在拍面反弹，越过空当会失分',()=>{
  let s={...initPong(6),serve:0,ball:[LEFT+1,300,-10,0]};
  let t=stepPong(s,[300,300]);assert.ok(t.ball[2]>0);assert.equal(t.hits,1);
  s={...s,ball:[0,HALF,-15,0],score:[0,6]};t=stepPong(s,[300,300]);
  assert.equal(t.winner,1);assert.deepEqual(t.score,[0,7]);
});
test('乒乓两分钟封顶，分数相等可平局',()=>{
  assert.equal(stepPong({...initPong(2),tick:7199},[300,300]).winner,-1);
});
test('两个游戏从种子和双方输入重现终态，拒绝损坏的回放',()=>{
  for(const g of ['snake','pong']){
    const {record,state}=simulate(g,23,['rule','random'],{record:true});
    assert.deepEqual(checkReplay(record),state);
    assert.throws(()=>checkReplay({...record,end:{...record.end,hash:'deadbeef'}}));
    assert.throws(()=>checkReplay({...record,frames:[[999999,[1,2]]]}));
  }
});
test('暂停时导出的部分对局也可回放',()=>{
  const m=begin('pong',71);for(let i=0;i<40;i++)advance(m,[100,400]);
  assert.deepEqual(checkReplay(seal(m)),m.state);
});
test('500 毫秒截止、非法动作、过期、取消与重复返回',()=>{
  let clock=0;const make=()=>openWindow({matchId:'a',epoch:8,actor:1,ids:['up','left'],fallback:'left',budget:500,now:()=>clock});
  for(const d of [50,150,300,500,800]){
    clock=0;const w=make();clock=d;w.offer(w.token,{id:'up',source:'model'});
    assert.equal(w.finish().source,d<500?'model':'fallback');assert.equal(w.finish(),null);
  }
  let w=make();assert.equal(w.offer({...w.token,matchId:'b'},{id:'up'}),false);
  assert.equal(w.offer({...w.token,epoch:7},{id:'up'}),false);assert.equal(w.finish().id,'left');
  w=make();w.offer(w.token,{id:'bad'});assert.equal(w.finish().reason,'invalid');
  w=make();w.cancel();assert.equal(w.offer(w.token,{id:'up'}),false);assert.equal(w.finish(),null);
  w=make();w.offer(w.token,{id:'up',source:'model'});assert.equal(w.offer(w.token,{id:'left'}),false);assert.equal(w.finish().id,'up');
});
