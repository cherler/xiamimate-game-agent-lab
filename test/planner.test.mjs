import test from 'node:test';
import assert from 'node:assert/strict';
import {initSnake} from '../src/snake.mjs';
import {planSnake,snakePlans,routeOptions} from '../src/snake-planner.mjs';
test('争食对手直接取安全食物，也能绕过静态障碍',()=>{
 const s={...initSnake(1),bodies:[[60,59,58],[10,9,8]],dirs:['right','left'],food:61};assert.equal(planSnake(s,0).id,'right');
 const blocked={...s,bodies:[[60,59,58],[61,62,63,64]],dirs:['right','up'],food:65};assert.notEqual(planSnake(blocked,0).id,'right');
});
test('安全分析包含对手增长时不会离开的尾格，不依赖未来食物种子',()=>{
 const s={...initSnake(1),bodies:[[55,44],[57,56]],dirs:['down','right'],food:58};assert.ok(routeOptions(s,0).find(o=>o.id==='right').risk>0);
 assert.deepEqual(snakePlans(s,0),snakePlans({...s,seed:1234567},0));
});
