import test from 'node:test';
import assert from 'node:assert/strict';
import {ChessPhaseClock,chessPresentationPhase} from '../web/chess-phase-clock.mjs';
const clock=()=>{let now=0;return {c:new ChessPhaseClock(()=>now),advance:ms=>now+=ms};};
test('购买、刷新和开合商店不重置同一轮的准备时间',()=>{
 const {c,advance}=clock();c.enter('prep:4',30000);advance(9000);assert.equal(c.enter('prep:4',30000),false);assert.equal(c.snapshot().remaining,21000);c.enter('prep:5',30000);assert.equal(c.snapshot().remaining,30000);
});
test('手动暂停和页面不可见分别冻结时间，恢复页面不撤销手动暂停',()=>{
 const {c,advance}=clock();c.enter('prep:4',30000);advance(5000);c.pause(true);advance(7000);c.suspend(true);advance(60000);c.suspend(false);advance(9000);assert.equal(c.snapshot().remaining,25000);c.pause(false);advance(3000);assert.equal(c.snapshot().remaining,22000);
});
test('倒计时到零只推进一次，不被后续计时回调重复开战',()=>{
 const {c,advance}=clock();c.enter('prep:4',30000);advance(31000);assert.equal(c.consumeExpiry(),true);assert.equal(c.consumeExpiry(),false);c.enter('settle:4',5000);advance(5000);assert.equal(c.consumeExpiry(),true);
});
test('存档只恢复剩余准备时间，不把离线时间算作战斗时间',()=>{
 const {c,advance}=clock();c.enter('prep:4',30000);advance(12345);c.pause(true);const save=c.snapshot();advance(86400000);const restored=new ChessPhaseClock(()=>90000000);restored.enter('prep:4',30000,save);assert.equal(restored.snapshot().remaining,17655);assert.equal(restored.snapshot().paused,true);
});
test('另一轮或非法时间快照不会污染当前回合',()=>{
 for(const checkpoint of [{key:'prep:3',duration:30000,remaining:2},{key:'prep:4',duration:30000,remaining:-1},{key:'prep:4',duration:30000,remaining:Infinity},{key:'prep:4',duration:30000,remaining:31000}]){const {c}=clock();c.enter('prep:4',30000,checkpoint);assert.equal(c.snapshot().remaining,30000);}
});
test('战利品和回放无自动推进，选择装备后才进入结算倒计时',()=>{
 const state={round:2,phase:'prep',players:[{loot:{options:['blade']}}]},review={round:1};assert.equal(chessPresentationPhase(state,{review}).kind,'loot');state.players[0].loot=null;assert.equal(chessPresentationPhase(state,{review}).duration,5000);assert.equal(chessPresentationPhase(state).duration,30000);assert.equal(chessPresentationPhase(state,{watch:true}).kind,'replay');
 const {c,advance}=clock();c.enter('loot:1',0);advance(60000);assert.equal(c.consumeExpiry(),false);state.phase='ended';assert.equal(chessPresentationPhase(state,{review}).kind,'ended');
});
