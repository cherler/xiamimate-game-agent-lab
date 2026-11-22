import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initRescue,commandRescue,stepRescue,rescueMap,walkable,pathTo,replayRescue} from '../src/rescue.mjs';
import {RESCUE_LEVELS} from '../src/rescue-maps.mjs';
import {siegeScenario} from '../scripts/rescue-siege-scenarios.mjs';
const zombie=(id,x,y,hp=100)=>({id,kind:'zombie',x,y,r:.23,hp,maxHp:hp,fast:false,brute:false,angle:0,path:[],goal:null,target:null,nav:0,cooldown:999,hitTick:-100});
function quiet(level=1){const s=commandRescue(initRescue({level}),{type:'start'});s.schedule=[{tick:6300,entry:0,fast:false,wave:1}];s.civilians=[];for(const u of s.soldiers)u.cooldown=9999;for(const o of s.objectives)o.nextSpawn=9999;return s;}
function place(u,x,y){Object.assign(u,{x,y,anchor:{x,y},path:[],goal:null,orderedAt:0});}
function advance(s,n){for(let i=0;i<n;i++)s=stepRescue(s);return s;}
test('六关入口、补给、平民与目标均可达；多入口尸潮和五人武器分工',()=>{
 assert.equal(RESCUE_LEVELS.length,6);
 for(const level of RESCUE_LEVELS){const s=initRescue({level}),m=rescueMap(level);assert.equal(s.version,8);assert.deepEqual(s.soldiers.map(u=>u.role),['rifle','rifle','gunner','grenadier','shield']);
  for(const p of [...s.soldiers,...s.civilians,...s.objectives,...s.crates,...m.entrances]){assert.ok(walkable(s,p.x,p.y),level+': '+p.id);assert.ok(pathTo(s,p,s.soldiers[0]).length,level+': unreachable '+p.id);}
  assert.ok(new Set(s.schedule.filter(w=>w.wave===1).map(w=>w.entry)).size>=2);
  if(level<=3){const old=initRescue({level,version:6});assert.ok(s.schedule.length>old.schedule.length*2);assert.equal(m.extraction.count,rescueMap(level,6).extraction.count*3);}
 }
});
test('榴弹伤害覆盖近处敌群，射击被墙体阻挡；穿透弹不会重复击中同一敌人',()=>{
 let s=quiet();s.zombies=[zombie('z0',12,10),zombie('z1',12.7,10),zombie('z2',14.5,10)];s.uid=200;
 s.bullets=[{id:'test',x:11.85,y:10,dx:1,dy:0,left:7,damage:52,kind:'grenade',origin:'s3',pierce:1,hitIds:[]}];s=stepRescue(s);
 assert.equal(s.zombies[0].hp,48);assert.equal(s.zombies[1].hp,48);assert.equal(s.zombies[2].hp,100);assert.ok(s.events.some(e=>e.kind==='blast'));
 s=quiet();s.zombies=[zombie('z0',9.4,6)];s.bullets=[{id:'test',x:7.6,y:6,dx:1,dy:0,left:7,damage:100,origin:'s0'}];s=advance(s,5);assert.equal(s.zombies[0].hp,100);assert.equal(s.bullets.length,0);
 s=quiet();s.zombies=[zombie('z0',12,10),zombie('z1',12.7,10)];s.uid=200;s.bullets=[{id:'test',x:11.85,y:10,dx:1,dy:0,left:7,damage:17,kind:'gunner',origin:'s2',pierce:2,hitIds:[]}];s=advance(s,3);assert.deepEqual(s.zombies.map(z=>z.hp),[83,83]);assert.equal(s.stats.hits,2);
});
test('南北入口的重型丧尸均完整进入地面，不出生在墙内',()=>{
 for(const level of [2,5,6]){let s=commandRescue(initRescue({level}),{type:'start'});s.schedule=rescueMap(level).entrances.flatMap((_,entry)=>Array.from({length:13},()=>({tick:1,entry,fast:false,brute:true,wave:1})));s=stepRescue(s);assert.ok(s.zombies.length>=30);for(const z of s.zombies)assert.ok(walkable(s,z.x,z.y,'zombie',z.r),JSON.stringify({level,x:z.x,y:z.y}));}
});
test('供电必须有人守卫；敌人逼近暂停维修，恢复后才能接驳',()=>{
 let s=quiet(4),o=s.objectives[0];place(s.soldiers[0],o.x,o.y);s=advance(s,90);assert.equal(s.objectives[0].progress,90);assert.equal(s.evac.phase,'unpowered');
 s.zombies=[zombie('z1',o.x+1.3,o.y,10000)];s=stepRescue(s);assert.equal(s.objectives[0].progress,90);assert.equal(s.objectives[0].blocked,true);s.zombies=[];s=advance(s,90);assert.ok(s.objectives[0].done);assert.equal(s.gateCharges,3);assert.notEqual(s.evac.phase,'unpowered');
 const paused=commandRescue(s,{type:'pause'});assert.deepEqual(stepRescue(paused),paused);
});
test('感染巢会增援，摧毁后停止；撤离达标仍需摧毁两座巢穴',()=>{
 let s=quiet(5);s.objectives[0].nextSpawn=1;s=stepRescue(s);assert.ok(s.zombies.length>=6);assert.ok(s.events.some(e=>e.kind==='nestWave'));
 s=quiet(5);s.objectives[0].hp=0;s.objectives[0].nextSpawn=1;s.saved=rescueMap(5).quota;s=stepRescue(s);assert.ok(s.objectives[0].done);assert.equal(s.zombies.length,0);assert.equal(s.winner,null);
 s.objectives[1].hp=0;s=stepRescue(s);assert.equal(s.winner,true);assert.ok(s.objectives.every(o=>o.done));
});
test('救援车只在护卫附近前进，遭围堵会停下，被摧毁会失败',()=>{
 let s=quiet(6),x=s.objectives[0].x;s=advance(s,30);assert.equal(s.objectives[0].x,x);
 place(s.soldiers[0],x,4.5);s=advance(s,30);assert.ok(s.objectives[0].x<x-1);
 let car=s.objectives[0];s.zombies=[zombie('z9',car.x+.5,car.y,10000)];s.zombies[0].cooldown=0;const hp=car.hp;s=stepRescue(s);assert.ok(s.objectives[0].blocked);assert.equal(s.objectives[0].active,false);assert.ok(s.objectives[0].hp<hp);
 s.zombies=[];place(s.soldiers[0],4,12);x=s.objectives[0].x;s=advance(s,30);assert.equal(s.objectives[0].x,x);
 s.objectives[0].hp=0;s=stepRescue(s);assert.equal(s.winner,false);assert.equal(s.reason,'救援车被摧毁');
});
test('真实全队点击可完成六关，新长回放与旧六版回放均可重现，挂机不能赢',()=>{
 for(const level of RESCUE_LEVELS){const r=siegeScenario({level});assert.equal(r.state.winner,true,level+': '+r.state.reason);assert.ok(r.state.saved>=rescueMap(level).quota);assert.ok(r.peak>=30);assert.ok(r.record.commands.every(c=>['move','start'].includes(c.command.type)));assert.ok(r.record.commands.filter(c=>c.command.type==='move').every(c=>c.command.ids.length===5));assert.deepEqual(replayRescue(r.record),r.state);if(level===3)assert.ok(r.record.end.tick>3600);}
 for(const level of [1,4,5,6])assert.equal(siegeScenario({level,plan:'idle'}).state.winner,false);
 const old=JSON.parse(fs.readFileSync(new URL('fixtures/rescue-6.json',import.meta.url)));assert.equal(replayRescue(old).version,6);assert.equal(replayRescue(old).winner,true);
});

test('末关不强制选火力升级，一秒一次整队判断仍可通关',()=>{const r=siegeScenario({level:6,upgrades:[],decisionEvery:30});assert.equal(r.state.winner,true);assert.ok(r.state.saved>=rescueMap(6).quota);});
