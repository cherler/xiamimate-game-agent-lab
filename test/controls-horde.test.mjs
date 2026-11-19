import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initPong,stepPong,HALF} from '../src/pong.mjs';
import {begin,advance,seal,checkReplay} from '../src/arena.mjs';
import {initRescue,commandRescue,stepRescue,replayRescue,rescueMap} from '../src/rescue.mjs';
import {rescueScenario} from '../scripts/rescue-scenarios.mjs';
const fixture=name=>JSON.parse(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)));
test('球拍逐帧反向响应，速度增加75%，不穿越边缘或目标',()=>{
 let s=stepPong(initPong(1),[0,600]);assert.deepEqual(s.paddles,[286,314]);s=stepPong(s,[600,0]);assert.deepEqual(s.paddles,[300,300]);
 s=stepPong(s,[307,298]);assert.deepEqual(s.paddles,[307,298]);for(let i=0;i<40;i++)s=stepPong(s,[0,600]);assert.deepEqual(s.paddles,[HALF,600-HALF]);
});
test('旧乒乓和救援存档保留历史速度、火力和完整校验，新球拍也能回放',()=>{
 assert.equal(checkReplay(fixture('pong-round2.2.json')).tick,180);assert.equal(replayRescue(fixture('rescue-v4-firefight.json')).version,4);
 const m=begin('pong',41003);for(let t=0;t<180;t++)advance(m,[t%48<24?60:540,300]);assert.deepEqual(checkReplay(seal(m)),m.state);
});
test('新版连续火力更强且仍受墙体遮挡，挂机不会获胜',()=>{
 const fired=[];for(const version of [4,5]){
  let s=commandRescue(initRescue({version}),{type:'start'});s.civilians=[];s.schedule=[{tick:5000,entry:0,fast:false,wave:1}];s.soldiers=s.soldiers.slice(0,1);s.soldiers[0].x=11.5;s.soldiers[0].y=8.5;
  s.zombies=[{id:'z0',kind:'zombie',x:13.5,y:8.5,r:.23,hp:100000,maxHp:100000,fast:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:10000,hitTick:-100}];s.uid=1;
  for(let i=0;i<180;i++)s=stepRescue(s);fired.push({shots:s.stats.shots,damage:100000-s.zombies[0].hp});
 }
 assert.ok(fired[1].shots>fired[0].shots*1.35,JSON.stringify(fired));assert.ok(fired[1].damage>fired[0].damage*1.5,JSON.stringify(fired));
 let s=commandRescue(initRescue(),{type:'start'});for(let i=0;i<270;i++)s=stepRescue(s);assert.equal(s.stats.shots,0);
 assert.equal(rescueScenario({version:5,plan:'idle'}).state.winner,false);
});
test('三关增量尸潮与火力匹配：有效护送仍可通关，并可完整回放',()=>{
 for(const level of [1,2,3]){
  const old=rescueMap(level,4),now=rescueMap(level,5);assert.ok(now.waves.reduce((n,w)=>n+w.count,0)>old.waves.reduce((n,w)=>n+w.count,0)*1.7);assert.ok(now.extraction.count>old.extraction.count);
  const r=rescueScenario({level,version:5});assert.equal(r.state.winner,true,'level '+level);assert.equal(r.state.saved,now.total);assert.deepEqual(replayRescue(r.record),r.state);
 }
});
