import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initRescue,commandRescue,stepRescue,replayRescue,walkable,insideExit,rescueMap} from '../src/rescue.mjs';
import {simpleRescueScenario} from '../scripts/rescue-simple-scenarios.mjs';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const zombie=(id,x,y)=>({id,kind:'zombie',x,y,r:.23,hp:1000,maxHp:1000,fast:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:0,hitTick:-100});
const running=()=>commandRescue(initRescue(),{type:'start'});
function quiet(){const s=running();s.schedule=[{tick:5000,entry:0,fast:false,wave:1}];s.tick=5;return s;}
function place(u,x,y){Object.assign(u,{x,y,anchor:{x,y},goal:null,path:[],orderedAt:-30});}

test('受伤队员自动救护：消耗真实补给，有间隔，不复活、不满血浪费',()=>{
 let s=quiet();s.soldiers[0].hp=40;s.soldiers[1].hp=0;s.soldiers[2].hp=50;const before=structuredClone(s);
 s=stepRescue(s);assert.equal(s.supplies,1);assert.equal(s.supportUsed.medic,1);assert.equal(s.soldiers[0].hp,95);assert.equal(s.soldiers[1].hp,0);assert.equal(s.soldiers[2].hp,105);assert.equal(before.supplies,2);
 s.soldiers[0].hp=40;s=stepRescue(s);assert.equal(s.supplies,1);assert.equal(s.soldiers[0].hp,40);
 s.tick=s.autoMedicAt-1;s=stepRescue(s);assert.equal(s.supplies,0);assert.equal(s.soldiers[0].hp,95);s.soldiers[0].hp=40;s.tick+=200;s=stepRescue(s);assert.equal(s.soldiers[0].hp,40);
 s=stepRescue(quiet());assert.equal(s.supplies,2);
});
test('换弹兵局部避险后回到指令点；新命令立即接管，墙后敌人不触发避险',()=>{
 let s=quiet(),u=s.soldiers[0];place(u,11.5,10.5);u.reload=20;s.zombies=[zombie('z90',12.8,10.5)];s.uid=100;
 s=stepRescue(s);assert.equal(s.soldiers[0].intent,'cover');assert.ok(dist(s.soldiers[0].goal,s.zombies[0])>dist(u,s.zombies[0]));assert.deepEqual(s.soldiers[0].anchor,{x:11.5,y:10.5});
 s=commandRescue(s,{type:'move',ids:['s0'],x:14.5,y:11.5});assert.deepEqual(s.soldiers[0].anchor,{x:14.5,y:11.5});assert.equal(stepRescue(s).soldiers[0].intent,'move');
 s.zombies=[];for(let i=0;i<180;i++)s=stepRescue(s);assert.ok(dist(s.soldiers[0],{x:14.5,y:11.5})<.15);
 s=quiet();place(s.soldiers[0],7.5,4.5);s.soldiers[0].reload=20;s.zombies=[zombie('z90',9.2,4.5)];s=stepRescue(s);assert.equal(s.soldiers[0].intent,'guard');
});
test('护卫在驻守点附近主动挡在平民前面，不离开撤离区追敌',()=>{
 let s=quiet(),u=s.soldiers[4];place(u,4.5,12.2);Object.assign(s.civilians[0],{x:4.3,y:11.7,status:'following',leader:u.id});s.zombies=[zombie('z90',4.5,10.3)];
 s=stepRescue(s);const guard=s.soldiers[4];assert.equal(guard.intent,'protect');assert.ok(insideExit(rescueMap(1),guard.goal));assert.ok(dist(guard.goal,s.zombies[0])<dist(u,s.zombies[0]));assert.ok(dist(guard.goal,guard.anchor)<=2.5);
});
test('平民会躲开可见丧尸，隔墙威胁不会触发全知逃跑，也不穿墙',()=>{
 let s=quiet(),c=s.civilians[0];Object.assign(c,{x:19.5,y:5,shelter:{x:19.5,y:5},status:'waiting'});s.zombies=[zombie('z90',20.8,5)];s.uid=100;
 s=stepRescue(s);assert.ok(s.civilians[0].avoidingUntil>s.tick);assert.ok(dist(s.civilians[0],{x:20.8,y:5})>dist(c,{x:20.8,y:5}));
 for(let i=0;i<30;i++){s=stepRescue(s);for(const c of s.civilians.filter(c=>c.status!=='infected'))assert.ok(walkable(s,c.x,c.y,'human',c.r));}
 s=quiet();Object.assign(s.civilians[0],{x:17.4,y:5,status:'waiting'});s.zombies=[zombie('z90',15.4,5)];s=stepRescue(s);assert.ok(!s.civilians[0].avoidingUntil);
});
test('接应者倒下后改跟存活士兵；掉队平民加速追赶',()=>{
 let s=quiet();place(s.soldiers[0],19.5,10);s.soldiers[0].hp=0;place(s.soldiers[1],21.5,10);Object.assign(s.civilians[0],{x:17.5,y:10,status:'following',leader:'s0'});
 s=stepRescue(s);assert.equal(s.civilians[0].leader,'s1');assert.ok(s.civilians[0].x>17.59);
});
test('返回后自动呼叫一次，仍需真实守点读秒，暂停及无护卫均不推进',()=>{
 let s=quiet();s.civilians.forEach((c,i)=>Object.assign(c,{x:2.2+i%4*.65,y:12.2+Math.floor(i/4)*.45,status:'following',leader:'s0'}));
 s=stepRescue(s);assert.equal(s.evac.phase,'loading');assert.equal(s.evac.alerts,1);assert.equal(s.saved,0);assert.equal(s.evac.progress,1);
 s=commandRescue(s,{type:'pause'});assert.equal(stepRescue(s).evac.progress,1);s=commandRescue(s,{type:'resume'});
 for(const u of s.soldiers)place(u,19.5,11.5);s=stepRescue(s);assert.equal(s.evac.phase,'unguarded');assert.equal(s.evac.progress,1);assert.equal(s.evac.alerts,1);
 place(s.soldiers[0],4.5,11.5);s=stepRescue(s);assert.equal(s.evac.progress,2);assert.equal(s.evac.alerts,1);assert.equal(s.schedule.filter(w=>w.assault).length,12);
});
test('简易操作三关可通关且能完整回放，挂机仍失败，旧版本存档不改规则',()=>{
 for(const level of [1,2,3]){
  const r=simpleRescueScenario({level});assert.equal(r.state.winner,true,'level '+level);assert.equal(r.state.saved,rescueMap(level).total);assert.equal(r.state.lost,0);assert.deepEqual(replayRescue(r.record),r.state);
  assert.ok(r.record.commands.every(c=>['start','move','gate'].includes(c.command.type)));assert.ok(r.record.commands.filter(c=>c.command.type==='move').every(c=>c.command.ids.length===5));
  assert.equal(simpleRescueScenario({level,plan:'idle'}).state.winner,false);
 }
 const old=JSON.parse(fs.readFileSync(new URL('fixtures/rescue-v5-escort.json',import.meta.url)));assert.equal(replayRescue(old).version,5);
});
