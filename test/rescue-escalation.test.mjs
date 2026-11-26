import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initRescue as createRescue,commandRescue,stepRescue,rescueMap as getRescueMap,walkable,pathTo,replayRescue,rescueZombieSpeed,entranceSealed} from '../src/rescue.mjs';
import {RESCUE_LEVELS} from '../src/rescue-maps.mjs';
import {escalationScenario} from '../scripts/rescue-escalation-scenarios.mjs';
const initRescue=(options={})=>createRescue({version:9,...options}),rescueMap=(level,version=9)=>getRescueMap(level,version);
const place=(u,x,y)=>Object.assign(u,{x,y,anchor:{x,y},path:[],goal:null,orderedAt:0});
const zombie=(id,x,y,hp=1000)=>({id,kind:'zombie',x,y,r:.23,hp,maxHp:hp,fast:false,brute:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:9999,hitTick:-100});
function quiet(level){const s=commandRescue(initRescue({level}),{type:'start'});s.schedule=[];s.civilians=[];s.reinforceAt=9999;for(const u of s.soldiers)u.cooldown=9999;for(const o of s.objectives)o.nextSpawn=9999;return s;}
function advance(s,n){for(let i=0;i<n;i++)s=stepRescue(s);return s;}
test('九关所有单位、补给、入口与目标可达，旧八版记录仍可精确恢复',()=>{
 assert.equal(RESCUE_LEVELS.length,9);
 for(const level of RESCUE_LEVELS){const s=initRescue({level}),m=rescueMap(level);assert.equal(s.version,9);
  for(const p of [...s.soldiers,...s.civilians,...s.objectives,...s.crates,...m.entrances]){assert.ok(walkable(s,p.x,p.y),level+': '+p.id);assert.ok(pathTo(s,p,s.soldiers[0]).length,level+': '+p.id);}
  assert.equal(s.civilians.length,m.total);assert.ok(m.quota<=m.total);assert.ok(s.schedule.every((w,i)=>!i||w.tick>=s.schedule[i-1].tick));
 }
 const old=replayRescue(JSON.parse(fs.readFileSync(new URL('fixtures/rescue-8.json',import.meta.url))));assert.equal(old.version,8);assert.equal(old.winner,true);assert.ok(old.overdriveUntil>0);
 assert.throws(()=>initRescue({level:7,version:8}));
});
test('原六关增兵、提速，险境进一步加压，不增加普通敌人血量',()=>{
 for(let level=1;level<=6;level++){const old=initRescue({level,version:8}),s=initRescue({level}),hard=initRescue({level,difficulty:'challenge'});
  assert.ok(s.schedule.length>=old.schedule.length*1.9);assert.ok(hard.schedule.length>=s.schedule.length*1.25);assert.ok(rescueMap(level).extraction.count>=rescueMap(level,8).extraction.count*2.5);
  assert.ok(s.schedule[0].tick<=old.schedule[0].tick);assert.ok(s.schedule.every(w=>!w.fast||!w.brute));assert.ok(hard.schedule.every(w=>!w.fast||!w.brute));
  for(const z of [{fast:false},{fast:true},{brute:true}]){assert.ok(rescueZombieSpeed(s,z)>=rescueZombieSpeed(old,z)*1.5);assert.ok(rescueZombieSpeed(hard,z)>rescueZombieSpeed(s,z));}
 }
 let s=quiet(1);s.schedule=[{tick:1,entry:0,fast:false,wave:1}];s=stepRescue(s);assert.equal(s.zombies[0].maxHp,45);
});
test('闸控需守住且受敌人打断；封锁只取消对应入口增援，不抹除现有敌人',()=>{
 let s=quiet(7),o=s.objectives[0];place(s.soldiers[0],o.x,o.y);s=advance(s,60);assert.equal(s.objectives[0].progress,60);
 s.zombies=[zombie('z100',o.x+1.2,o.y)];s=advance(s,15);assert.equal(s.objectives[0].progress,60);assert.ok(s.objectives[0].blocked);
 s.zombies=[];s=advance(s,90);assert.ok(entranceSealed(s,1));assert.equal(entranceSealed(s,2),false);
 s.zombies=[zombie('z101',19,11)];s.schedule=[{tick:s.tick+1,entry:1,fast:false,wave:1},{tick:s.tick+1,entry:2,fast:false,wave:1}];s=stepRescue(s);assert.equal(s.spawned,2);assert.equal(s.zombies.length,2);assert.ok(s.zombies.some(z=>z.id==='z101'));
 s.schedule=[];s.spawned=0;s.reinforceAt=s.tick+1;s=stepRescue(s);assert.ok(s.schedule.length>0);assert.ok(s.schedule.every(w=>w.entry===2));
 s.saved=rescueMap(7).quota;s=stepRescue(s);assert.equal(s.winner,null);s.objectives[1].progress=s.objectives[1].required;s=stepRescue(s);assert.equal(s.winner,true);
});
test('炮台占领后自动射击，受墙体限制，损毁后停火；可选炮台不阻止胜利',()=>{
 let s=quiet(8),o=s.objectives[0];place(s.soldiers[0],o.x,o.y);s=advance(s,120);assert.ok(s.objectives[0].done);
 s.zombies=[zombie('z100',13.5,5.5)];s=advance(s,30);assert.ok(s.zombies[0].hp<1000);assert.ok(s.events.some(e=>e.weapon==='turret'));
 s.zombies=[zombie('z101',17.5,5.5)];s.bullets=[];s=advance(s,15);assert.equal(s.zombies[0].hp,1000);
 s.objectives[0].hp=0;s.zombies=[zombie('z102',13.5,5.5)];s.bullets=[];s=advance(s,15);assert.equal(s.zombies[0].hp,1000);
 s.saved=rescueMap(8).quota;s.objectives[2].hp=0;s=stepRescue(s);assert.equal(s.winner,true);assert.equal(s.objectives[1].done,false);
});
test('空援显示落点后命中密集尸群，不伤平民；60 秒出勤后补给 30 秒',()=>{
 let s=quiet(9),radio=s.objectives[0];place(s.soldiers[0],radio.x,radio.y);s=advance(s,180);assert.ok(s.objectives[0].done);
 s.zombies=[zombie('z100',11.5,12),zombie('z101',12,12),zombie('z102',12.5,12)];s=advance(s,15);assert.ok(s.airstrikes.length);assert.ok(s.airstrikes.every(a=>a.impact>s.tick));assert.equal(s.zombies[0].hp,1000);
 const target=s.airstrikes[0],civilian={id:'c-test',kind:'civilian',x:target.x,y:target.y,r:.18,status:'waiting',shelter:{x:target.x,y:target.y},path:[],goal:null,nav:0,infection:0};
 // Move zombies away from contact while retaining a target inside the blast radius.
 s.civilians=[civilian];for(const z of s.zombies){z.x=target.x+1.4;z.y=target.y;z.path=[];z.target=null;}
 const impact=s.airstrikes[0].impact;s.tick=impact-1;s=stepRescue(s);assert.ok(s.events.some(e=>e.kind==='airBlast'));assert.ok(s.zombies.some(z=>z.hp<1000));assert.equal(s.lost,0);assert.equal(s.civilians[0].status,'waiting');
 s.airstrikes=[];s.tick=s.objectives[0].activatedAt+60*30;s=stepRescue(s);assert.equal(s.objectives[0].active,false);assert.ok(s.objectives[0].resupply>0);assert.equal(s.airstrikes.length,0);
 s.tick=s.objectives[0].activatedAt+90*30;s=stepRescue(s);assert.equal(s.objectives[0].active,true);assert.ok(s.airstrikes.length);
});
test('救援车在明确接应前不会被远处尸群偷偷击毁，启动后仍需护送',()=>{
 let s=quiet(6),car=s.objectives[0];s.zombies=[zombie('z100',car.x+.4,car.y)];s.zombies[0].cooldown=0;s=stepRescue(s);assert.equal(s.objectives[0].hp,600);assert.equal(s.objectives[0].started,false);
 s.zombies=[];place(s.soldiers[0],car.x,car.y);s=stepRescue(s);assert.equal(s.objectives[0].started,true);
 place(s.soldiers[0],4.5,12.5);s.zombies=[zombie('z101',s.objectives[0].x+.4,car.y)];s.zombies[0].cooldown=0;s=stepRescue(s);assert.ok(s.objectives[0].hp<600);
});
test('真实整队指令完成九关，仍可重放；挂机不能过关',()=>{
 for(const level of RESCUE_LEVELS){const r=escalationScenario({level});assert.equal(r.state.winner,true,level+': '+r.state.reason);assert.ok(r.state.saved>=rescueMap(level).quota);assert.equal(replayRescue(r.record).winner,true);assert.ok(r.record.commands.every(c=>['move','start'].includes(c.command.type)));}
 for(const level of [1,7,8,9])assert.equal(escalationScenario({level,plan:'idle'}).state.winner,false,level+': idle');
});
