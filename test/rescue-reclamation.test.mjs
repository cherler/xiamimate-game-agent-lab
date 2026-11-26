import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initRescue,commandRescue,stepRescue,beginRescue,issueRescue,advanceRescue,sealRescue,replayRescue,rescueMap,walkable,pathTo,rescueZombieSpeed} from '../src/rescue.mjs';
import {RESCUE_MUTANTS} from '../src/rescue-mutants.mjs';
import {reclamationScenario} from '../scripts/rescue-reclamation-scenarios.mjs';
const put=(u,x,y)=>Object.assign(u,{x,y,anchor:{x,y},path:[],goal:null,orderedAt:99999,cooldown:99999});
const advance=(s,n)=>{for(let i=0;i<n;i++)s=stepRescue(s);return s;};
const zombie=(id,x,y,mutation=null,hp=1000)=>({id,kind:'zombie',x,y,r:RESCUE_MUTANTS[mutation]?.r||.23,hp,maxHp:hp,mutation,brute:mutation==='breaker',fast:mutation==='runner',angle:0,path:[],goal:null,target:null,nav:-1,cooldown:0,hitTick:-100,gateId:null,attackAt:0,aim:null,burst:null});
function quiet(level=1){const s=commandRescue(initRescue({level}),{type:'start'});s.schedule=[{tick:9999,entry:0,wave:1,fast:false}];s.civilians=[];s.refuges=[];s.crates=[];s.reinforceAt=99999;s.supplies=0;for(const u of s.soldiers)put(u,u.x,u.y);for(const o of s.objectives)o.nextSpawn=99999;return s;}
function targetFixture(mutation){const s=quiet();s.soldiers=s.soldiers.slice(0,1);put(s.soldiers[0],13.5,11.5);s.zombies=[zombie('z0',9.5,11.5,mutation)];return s;}

test('收复版九关的平民、避难点、据点和补给全部可达；九版回放保持原终态',()=>{
 for(let level=1;level<=9;level++){const s=initRescue({level}),m=rescueMap(level);assert.equal(s.version,10);assert.equal(s.civilians.length,m.total);assert.ok(s.civilians.every(c=>c.status==='sheltered'));for(const p of [...s.civilians,...s.refuges,...s.objectives,...s.crates]){assert.ok(walkable(s,p.x,p.y),`${level}: ${p.id}`);assert.ok(pathTo(s,s.soldiers[0],p).length,`${level}: ${p.id}`);}}
 const old=replayRescue(JSON.parse(fs.readFileSync(new URL('fixtures/rescue-9.json',import.meta.url))));assert.equal(old.version,9);assert.equal(old.winner,true);
});
test('门障即使存在绕行路径也被持续围攻，破门后继续前进；重建不重复门 ID',()=>{
 let s=quiet();s.phase='deploy';s=commandRescue(s,{type:'gate',door:'door0'});s.phase='running';s.zombies=[zombie('z0',9.45,8.5,'breaker')];s.soldiers=s.soldiers.slice(0,1);put(s.soldiers[0],7,8.5);
 assert.ok(pathTo(s,s.zombies[0],s.soldiers[0],'zombie').some(p=>p.y>10),'另一扇门可以绕行');
 s=stepRescue(s);assert.equal(s.zombies[0].gateId,'door0');assert.equal(s.gates[0].hp,85);assert.ok(s.zombies[0].x>=9.34);
 s=advance(s,65);assert.equal(s.gates[0].hp,0);assert.ok(s.events.some(e=>e.kind==='break'));s=advance(s,50);assert.ok(s.zombies[0].x<8.5);
 s=commandRescue(s,{type:'gate',door:'door0'});assert.equal(s.gates.length,1);assert.equal(s.gates[0].hp,150);
});
test('新建在丧尸脚下的门障会被破坏，门障不会令丧尸永远卡住',()=>{
 let s=quiet();s.phase='deploy';s=commandRescue(s,{type:'gate',door:'door0'});s.phase='running';s.gates[0].hp=15;s.zombies=[zombie('z0',8.5,8.5)];s=stepRescue(s);assert.equal(s.gates[0].hp,0);assert.ok(s.events.some(e=>e.kind==='break'));
});
test('避难点需实际接应，近敌打断集结；失守会暴露原本安全的群众',()=>{
 let s=quiet();const original=initRescue();s.refuges=[original.refuges[0]];s.civilians=original.civilians.filter(c=>c.refuge==='refuge0');const r=s.refuges[0];put(s.soldiers[0],r.x,r.y+1.6);s=advance(s,30);assert.equal(s.refuges[0].progress,30);assert.ok(s.civilians.every(c=>c.status==='sheltered'));
 s.zombies=[zombie('z0',r.x+1.5,r.y)];s=advance(s,10);assert.equal(s.refuges[0].progress,30);assert.equal(s.refuges[0].blocked,true);
 s.zombies=[];s=advance(s,60);assert.equal(s.refuges[0].released,true);assert.ok(s.civilians.every(c=>c.status!=='sheltered'));assert.equal(s.refuges[0].breached,false);
 s=quiet();s.refuges=[{...original.refuges[0],hp:1}];s.civilians=original.civilians.filter(c=>c.refuge==='refuge0');s.zombies=[zombie('z0',r.x+1.3,r.y,'breaker')];s=stepRescue(s);assert.equal(s.refuges[0].breached,true);assert.ok(s.civilians.every(c=>c.status==='waiting'));
});
test('疾行者比旧快尸更快，重甲减免子弹但不减免榴弹',()=>{
 assert.ok(rescueZombieSpeed(initRescue(),zombie('z0',0,0,'runner'))>rescueZombieSpeed(initRescue({version:9}),{fast:true}));
 const shot=kind=>{let s=targetFixture('breaker');s.zombies[0].x=11;s.bullets=[{id:'b0',x:10.5,y:11.5,dx:1,dy:0,left:4,damage:100,kind,origin:'s0',hitIds:[]}];return stepRescue(s).zombies[0].hp;};
 assert.equal(shot('rifle'),945);assert.equal(shot('grenade'),900);
});
test('持枪感染者先锁定瞄准线，再点射；离开瞄准线可躲开，墙和门障挡弹',()=>{
 let s=stepRescue(targetFixture('gunner'));assert.ok(s.zombies[0].aim);assert.equal(s.enemyBullets.length,0);const hp=s.soldiers[0].hp;
 s=advance(s,47);assert.ok(s.soldiers[0].hp<hp);assert.ok(s.events.some(e=>e.kind==='enemyShot'));
 s=stepRescue(targetFixture('gunner'));put(s.soldiers[0],13.5,13.5);s=advance(s,47);assert.equal(s.soldiers[0].hp,hp);
 s=quiet();s.soldiers=s.soldiers.slice(0,1);put(s.soldiers[0],7.5,4.5);s.enemyBullets=[{id:'e1',x:9.3,y:4.5,dx:-1,dy:0,left:5,damage:12}];s=advance(s,8);assert.equal(s.soldiers[0].hp,140);assert.equal(s.enemyBullets.length,0);
 s=quiet();s.phase='deploy';s=commandRescue(s,{type:'gate',door:'door0'});s.phase='running';s.soldiers=s.soldiers.slice(0,1);put(s.soldiers[0],7.5,8.5);s.enemyBullets=[{id:'e2',x:9.3,y:8.5,dx:-1,dy:0,left:5,damage:12}];s=advance(s,8);assert.equal(s.gates[0].hp,138);assert.equal(s.soldiers[0].hp,140);
});
test('投弹有落点预警、延迟爆炸与短暂危险区，撤出范围能避伤',()=>{
 let s=advance(targetFixture('bomber'),34);assert.equal(s.enemyBombs.length,1);const bomb=s.enemyBombs[0],hp=s.soldiers[0].hp;assert.ok(bomb.impact>s.tick);s=advance(s,bomb.impact-s.tick);assert.equal(s.soldiers[0].hp,hp-30);s=advance(s,15);assert.equal(s.soldiers[0].hp,hp-35);
 s=advance(targetFixture('bomber'),34);put(s.soldiers[0],13.5,13.5);s=advance(s,42);assert.equal(s.soldiers[0].hp,hp);s.zombies=[];s=advance(s,80);assert.equal(s.enemyBombs.length,0);
});
test('队员对可见投弹落点自动避险，但仍围绕玩家目的地活动',()=>{
 let s=quiet();s.tick=5;s.soldiers=s.soldiers.slice(0,1);const u=s.soldiers[0];put(u,12.5,11.5);u.orderedAt=-30;s.enemyBombs=[{id:'e1',x:u.x,y:u.y,radius:1.35,impact:70,expires:160}];s=stepRescue(s);assert.equal(s.soldiers[0].intent,'cover');assert.ok(Math.hypot(s.soldiers[0].goal.x-u.x,s.soldiers[0].goal.y-u.y)>1.5);assert.deepEqual(s.soldiers[0].anchor,{x:12.5,y:11.5});
});
test('炮击扣弹、冷却、暂停、非法落点和次数限制都有效，重甲吃足爆炸伤害且不伤己方',()=>{
 let s=targetFixture('breaker');s.zombies[0].x=11.5;s.zombies[0].cooldown=99999;assert.throws(()=>commandRescue(s,{type:'artillery',x:8.5,y:3.5}));assert.throws(()=>commandRescue(s,{type:'artillery',x:NaN,y:5}));assert.equal(s.artillery.charges,2);
 s=commandRescue(s,{type:'pause'});s=commandRescue(s,{type:'artillery',x:11.5,y:11.5});assert.equal(s.artillery.charges,1);assert.equal(stepRescue(s).tick,s.tick);assert.equal(s.zombies[0].hp,1000);assert.throws(()=>commandRescue(s,{type:'artillery',x:11.5,y:11.5}));
 s=commandRescue(s,{type:'resume'});s=advance(s,23);assert.equal(s.zombies[0].hp,1000);s=stepRescue(s);assert.equal(s.zombies[0].hp,640);assert.equal(s.soldiers[0].hp,140);assert.equal(s.airstrikes.length,0);assert.equal(s.lost,0);
 s.zombies=[];s.tick=s.artillery.readyAt;s=commandRescue(s,{type:'artillery',x:11.5,y:11.5});s.tick=s.artillery.readyAt;assert.throws(()=>commandRescue(s,{type:'artillery',x:11.5,y:11.5}));
});
test('清剿与撤离补充炮击，不在每一帧重复加弹',()=>{
 let s=quiet();s.artillery.charges=0;s.kills=60;s=stepRescue(s);assert.equal(s.artillery.charges,1);s=stepRescue(s);assert.equal(s.artillery.charges,1);s.saved=rescueMap(1).quota;s=stepRescue(s);assert.equal(s.artillery.charges,2);assert.equal(s.achievements.evacuated,s.tick);s=stepRescue(s);assert.equal(s.artillery.charges,2);
});
test('撤离达标不结束战斗，不删除未来敌人；小队牺牲后仍保留撤离成就',()=>{
 let s=quiet();s.saved=rescueMap(1).quota;s.schedule=[{tick:900,entry:0,wave:1},{tick:1800,entry:1,wave:2}];const n=s.schedule.length;s=stepRescue(s);assert.equal(s.achievements.evacuated,1);assert.equal(s.achievements.reclaimed,null);assert.equal(s.phase,'running');assert.equal(s.schedule.length,n);assert.ok(s.schedule[0].tick<900);
 for(const u of s.soldiers)u.hp=0;s=stepRescue(s);assert.equal(s.winner,false);assert.equal(s.achievements.evacuated,1);assert.ok(s.reason.includes('已保留'));
});
test('清剿需清空实际敌人、未封锁的未来增援、感染源和敌方弹药',()=>{
 let s=quiet(5);s.schedule=[];s=stepRescue(s);assert.equal(s.achievements.reclaimed,null);for(const o of s.objectives)o.done=true;s.enemyBombs=[{id:'e0',x:19.5,y:5.5,radius:1,impact:90,expires:180}];s=stepRescue(s);assert.equal(s.achievements.reclaimed,null);s.enemyBombs=[];s.enemyBullets=[{x:19.5,y:5.5,dx:1,dy:0,left:5,damage:12}];s=stepRescue(s);assert.equal(s.achievements.reclaimed,null);s.enemyBullets=[];s=stepRescue(s);assert.equal(s.achievements.reclaimed,s.tick);assert.equal(s.winner,null,'仍可继续救人');
});
test('先收复后救人，不重新刷撤离尸潮；平民损失后仍可获得收复成就',()=>{
 let s=quiet();s.schedule=[];s=stepRescue(s);assert.equal(s.achievements.reclaimed,1);s.civilians=initRescue().civilians.slice(0,1);Object.assign(s.civilians[0],{x:3,y:12,status:'boarding'});s=stepRescue(s);assert.equal(s.evac.phase,'loading');assert.equal(s.schedule.length,0);assert.equal(s.evac.alertTick,null);assert.equal(s.evac.rageUntil,0);
 s=quiet();s.lost=rescueMap(1).total;s.schedule=[];s=stepRescue(s);assert.equal(s.winner,true);assert.equal(s.achievements.evacuated,null);assert.ok(s.achievements.reclaimed!==null);
});
test('十版炮击指令可确定性重放，版本号不被截成零',()=>{
 const m=beginRescue({level:2});issueRescue(m,{type:'start'});issueRescue(m,{type:'artillery',x:18.5,y:11.5});for(let i=0;i<90;i++)advanceRescue(m);issueRescue(m,{type:'pause'});const r=sealRescue(m);assert.equal(r.format,'rescue-10');assert.deepEqual(replayRescue(r),m.state);assert.throws(()=>replayRescue({...r,format:'rescue-9'}));
});
test('正常整队指令能在撤离后继续收复；挂机不能救人，历史路线不再保证胜利',()=>{
 const r=reclamationScenario({level:1,plan:'tactical'});assert.equal(r.state.winner,true);assert.equal(replayRescue(r.record).winner,true);const evac=r.milestones.find(m=>m.key==='evacuated'),clear=r.milestones.find(m=>m.key==='reclaimed');assert.ok(evac.enemies+evac.pending>30);assert.ok(clear.tick>evac.tick+5*30);assert.ok(r.state.artillery.used>0);
 assert.equal(reclamationScenario({level:2,plan:'idle'}).state.winner,false);
});

test('新整队移动命令优先于换弹避险，队员不会被留在上一间房',()=>{
 let s=quiet();s.tick=5;put(s.soldiers[0],11.5,10.5);s.zombies=[zombie('z0',12.8,10.5)];s.soldiers[0].reload=25;s.soldiers[0].hp=30;s=commandRescue(s,{type:'move',ids:['s0'],x:11.5,y:13.5});s.soldiers[0].orderedAt=-30;s=stepRescue(s);assert.equal(s.soldiers[0].intent,'move');assert.deepEqual(s.soldiers[0].goal,{x:11.5,y:13.5});assert.ok(s.soldiers[0].y>10.5);
});
