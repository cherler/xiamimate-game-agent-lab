import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/common.mjs';
import {initRescue,commandRescue,stepRescue,beginRescue,issueRescue,advanceRescue,sealRescue,replayRescue,rescueMap,pathTo,lineOfSight,walkable} from '../src/rescue.mjs';
import {rescueScenario} from '../scripts/rescue-scenarios.mjs';
import {readFileSync} from 'node:fs';

test('旧版三关回放保留原部署、波次与终态',()=>{
 for(const level of [1,2,3]){
  const record=JSON.parse(readFileSync(new URL(`fixtures/rescue-v1-level${level}.json`,import.meta.url),'utf8'));
  const s=replayRescue(record);assert.equal(s.version,1);assert.equal(s.winner,record.end.winner);assert.equal(fingerprint(s),record.end.hash);
 }
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(level=1,difficulty='normal'){
 const s=commandRescue(initRescue({level,difficulty,version:1}),{type:'start'});s.schedule=[{tick:5000,entry:0,fast:false,wave:1}];s.civilians.forEach(c=>{c.status='saved';});s.saved=rescueMap(level).total;
 return s;
}
function zombie(id,x,y,hp=45){return {id,kind:'zombie',x,y,r:.23,hp,maxHp:hp,fast:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:0,hitTick:-100};}
function contact(difficulty='normal'){
 const s=fixture(1,difficulty),c=s.civilians[0];Object.assign(c,{x:20,y:11,status:'waiting'});s.saved--;s.zombies=[zombie('z0',19.6,11)];s.uid=1;return s;
}
test('三张房间地图的军队、平民、入口均可行走，撤离区可达',()=>{
 for(let level=1;level<=3;level++){
  const s=initRescue({level}),m=rescueMap(level);assert.equal(s.civilians.length,m.total);assert.equal(s.soldiers.length,5);assert.equal(new Set(s.soldiers.map(u=>u.group)).size,3);
  for(const p of [...s.soldiers,...s.civilians,...m.entrances]){assert.ok(walkable(s,p.x,p.y));assert.ok(pathTo(s,p,{x:3.5,y:12.5}).length);}
  assert.ok(s.schedule.every((row,i)=>row.tick>=m.waves[0].at*30&&(!i||row.tick>=s.schedule[i-1].tick)));
 }
});
test('部署不消耗时间，非法指令原子拒绝，暂停允许下令但不推进',()=>{
 const s=initRescue(),before=structuredClone(s);assert.throws(()=>commandRescue(s,{type:'move',ids:['s0','s0'],x:5,y:5}));assert.throws(()=>commandRescue(s,{type:'move',ids:['s0'],x:8.5,y:3.5}));assert.deepEqual(s,before);
 assert.throws(()=>commandRescue(s,{type:'move',ids:['s0'],x:19.5,y:8.5}),/接应区/);
 const deployed=commandRescue(s,{type:'move',ids:['s0'],x:2.5,y:11.5});assert.equal(deployed.tick,0);assert.equal(deployed.soldiers[0].x,2.5);
 const paused=commandRescue(commandRescue(deployed,{type:'start'}),{type:'pause'}),ordered=commandRescue(paused,{type:'move',ids:['s0'],x:3.5,y:12.5});assert.equal(stepRescue(ordered),ordered);assert.ok(ordered.soldiers[0].path.length);assert.equal(stepRescue(commandRescue(ordered,{type:'resume'})).tick,1);
});
test('五名队员能穿过两道窄门，不穿墙、不被友方卡死',()=>{
 let s=fixture();s=commandRescue(s,{type:'move',ids:s.soldiers.map(u=>u.id),x:19.5,y:8.5});
 for(let i=0;i<600;i++){s=stepRescue(s);for(const u of s.soldiers)assert.ok(walkable(s,u.x,u.y,'human',u.r));}
 assert.ok(s.soldiers.every(u=>distance(u,{x:19.5,y:8.5})<2));assert.ok(s.soldiers.every(u=>u.path.length===0));
});
test('门障挡丧尸、放行军队和射击，消耗次数并能被摧毁',()=>{
 let s=initRescue();s=commandRescue(s,{type:'gate',door:'door0'});assert.equal(s.gateCharges,1);assert.ok(walkable(s,8.5,8.5));assert.equal(walkable(s,8.5,8.5,'zombie'),false);assert.ok(lineOfSight(s,{x:7.5,y:8.5},{x:9.5,y:8.5}));assert.throws(()=>commandRescue(s,{type:'gate',door:'door0'}));
 s=commandRescue(s,{type:'start'});s.schedule=[{tick:5000,entry:0,fast:false,wave:1}];s.civilians.forEach(c=>{c.status='saved';});s.saved=10;s.zombies=[zombie('z0',9.45,8.5)];s.uid=1;s.gates[0].hp=15;
 for(let i=0;i<30&&s.gates[0].hp>0;i++)s=stepRescue(s);assert.equal(s.gates[0].hp,0);assert.ok(walkable(s,8.5,8.5,'zombie'));assert.ok(s.events.some(e=>e.kind==='break'));
});
test('墙体遮挡瞄准与实体弹丸，不隔墙伤害',()=>{
 let s=fixture();Object.assign(s.soldiers[0],{x:7.4,y:4.5});s.soldiers.slice(1).forEach(u=>{u.hp=0;});s.zombies=[zombie('z0',9.4,4.5)];s.bullets=[{id:'b1',x:7.9,y:4.5,dx:1,dy:0,origin:'s0',left:6,damage:100}];
 assert.equal(lineOfSight(s,s.soldiers[0],s.zombies[0]),false);s=stepRescue(s);assert.equal(s.stats.shots,0);assert.equal(s.zombies[0].hp,45);assert.equal(s.bullets.length,0);assert.ok(s.events.some(e=>e.kind==='wall'));
});
test('标准感染有十八帧抢救窗口，险境接触即感染且计数仅一次',()=>{
 let s=contact();for(let i=0;i<17;i++)s=stepRescue(s);assert.equal(s.lost,0);assert.equal(s.civilians[0].infection,17);s=stepRescue(s);assert.equal(s.lost,1);assert.equal(s.civilians[0].status,'infected');assert.equal(s.zombies.length,2);s=stepRescue(s);assert.equal(s.lost,1);
 const hard=stepRescue(contact('challenge'));assert.equal(hard.lost,1);
});
test('同帧先击杀再感染；新感染者不能在同一帧连锁传染',()=>{
 let s=contact('challenge');s.bullets=[{id:'b1',x:19.3,y:11,dx:1,dy:0,origin:'s0',left:6,damage:100}];s=stepRescue(s);assert.equal(s.lost,0);assert.equal(s.kills,1);assert.ok(s.events.some(e=>e.kind==='hit'&&e.source==='s0'));assert.equal(s.civilians[0].status,'waiting');
 s=contact('challenge');Object.assign(s.civilians[1],{x:20.5,y:11,status:'waiting'});s.saved--;s=stepRescue(s);assert.equal(s.lost,1);assert.equal(s.civilians[1].status,'waiting');s=stepRescue(s);assert.equal(s.lost,2);
});
test('感染先于同帧撤离，平民进入撤离区后不再受到攻击',()=>{
 let s=contact('challenge');Object.assign(s.civilians[0],{x:2,y:11});Object.assign(s.zombies[0],{x:2.4,y:11});s.soldiers.forEach((u,i)=>{u.x=19+i*.5;u.y=4;});s=stepRescue(s);assert.equal(s.civilians[0].status,'infected');assert.equal(s.saved,9);
 s=fixture();Object.assign(s.civilians[0],{x:2,y:11,status:'following',leader:'s0'});s.saved=9;s=stepRescue(s);assert.equal(s.saved,10);assert.equal(s.civilians[0].status,'saved');s.zombies=[zombie('z0',2,11)];for(let i=0;i<20;i++)s=stepRescue(s);assert.equal(s.lost,0);assert.equal(s.saved,10);
});
test('未来波次未入场不会提前获胜，守护与清剿采用不同超时结算',()=>{
 let s=fixture();s=stepRescue(s);assert.equal(s.winner,null);s.tick=1799;s=stepRescue(s);assert.equal(s.winner,true);assert.equal(s.reason,'坚守成功');
 s=fixture(3);s.tick=3599;s=stepRescue(s);assert.equal(s.winner,false);assert.equal(s.reason,'清剿时间耗尽');
 s=fixture();s.schedule=[];s=stepRescue(s);assert.equal(s.winner,true);
 s=fixture();s.soldiers.forEach(u=>{u.hp=0;});s.schedule=[];s=stepRescue(s);assert.equal(s.winner,false);assert.equal(s.reason,'小队全部倒下');
});
test('升级改变实际门障与移动、伤害，不只有界面加成',()=>{
 const regular=initRescue(),upgraded=initRescue({upgrades:['gate','mobility']});assert.equal(upgraded.gateCharges,3);assert.equal(commandRescue(upgraded,{type:'gate',door:'door0'}).gates[0].hp,240);
 const moving=s=>stepRescue(commandRescue(commandRescue(s,{type:'start'}),{type:'move',ids:['s0'],x:6.5,y:11.5}));assert.ok(distance(moving(upgraded).soldiers[0],upgraded.soldiers[0])>distance(moving(regular).soldiers[0],regular.soldiers[0]));
 let s=fixture();s.upgrades=['fire'];s.zombies=[zombie('z0',6,11.5)];s=stepRescue(s);assert.ok(s.bullets.every(b=>[12,10.799999999999999].includes(b.damage)));
});
test('暂停与同一时刻的部署指令可确定性回放，篡改会被拒绝',()=>{
 const m=beginRescue({seed:910});issueRescue(m,{type:'move',ids:['s0','s1'],x:2.5,y:11.5});issueRescue(m,{type:'gate',door:'door0'});issueRescue(m,{type:'start'});for(let i=0;i<330;i++)advanceRescue(m);
 issueRescue(m,{type:'pause'});issueRescue(m,{type:'move',ids:['s0'],x:3,y:11});issueRescue(m,{type:'resume'});for(let i=0;i<60;i++)advanceRescue(m);issueRescue(m,{type:'pause'});
 const r=sealRescue(m);assert.equal(fingerprint(replayRescue(r)),fingerprint(m.state));const broken=structuredClone(r);broken.commands[0].command.x=3;assert.throws(()=>replayRescue(broken));assert.throws(()=>replayRescue({...r,end:{...r.end,tick:1000000}}));
});
test('三关完整救援和推进可胜，挂机失败，通关记录可重复重演',()=>{
 for(let level=1;level<=3;level++){
  const win=rescueScenario({level});assert.equal(win.state.winner,true,'第 '+level+' 关');assert.equal(win.state.saved,rescueMap(level).total);assert.equal(win.state.lost,0);assert.equal(fingerprint(replayRescue(win.record)),win.record.end.hash);
  assert.equal(rescueScenario({level,plan:'idle'}).state.winner,false);
 }
});

test('全员撤离可提前完成守护关，清剿关仍需消灭敌人',()=>{
 let s=fixture();s.version=2;s=stepRescue(s);assert.equal(s.winner,true);assert.equal(s.reason,'全员撤离');
 s=fixture(3);s.version=2;s=stepRescue(s);assert.equal(s.winner,null);
});
