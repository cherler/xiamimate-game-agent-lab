import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initRescue,commandRescue,stepRescue,replayRescue,beginRescue,issueRescue,advanceRescue,sealRescue,walkable} from '../src/rescue.mjs';
import {RESCUE_MUTANTS} from '../src/rescue-mutants.mjs';
import {reclamationScenario} from '../scripts/rescue-reclamation-scenarios.mjs';
const oldRecord=()=>JSON.parse(fs.readFileSync(new URL('fixtures/rescue-10.json',import.meta.url)));
const armed=z=>['gunner','bomber'].includes(z.mutation);
const noRanged=s=>{assert.ok(!s.zombies.some(armed));assert.ok(!s.zombies.some(z=>z.aim||z.burst));assert.equal(s.enemyBullets.length,0);assert.equal(s.enemyBombs.length,0);assert.ok(!s.events.some(e=>['enemyAim','enemyShot','enemyThrow','enemyBlast'].includes(e.kind)));};

test('十一版九关、两种难度都只生成近战敌人，波次数量和近战变异仍保留',()=>{
 assert.deepEqual(Object.keys(RESCUE_MUTANTS),['runner','breaker']);
 for(let level=1;level<=9;level++)for(const difficulty of ['normal','challenge']){
  const s=initRescue({level,difficulty}),old=initRescue({level,difficulty,version:10});assert.equal(s.version,11);assert.equal(s.schedule.length,old.schedule.length);assert.ok(s.schedule.every(w=>[null,'runner','breaker'].includes(w.mutation)));assert.ok(s.schedule.some(w=>w.mutation==='runner'));if(level>=3)assert.ok(s.schedule.some(w=>w.mutation==='breaker'));
 }
});
test('旧战斗即时取消远程攻击，保留位置、队员状态、炮击、成就与波次',()=>{
 const before=replayRescue(oldRecord());assert.ok(before.zombies.some(armed));assert.ok(before.enemyBullets.length&&before.enemyBombs.length);
 const s=commandRescue(before,{type:'melee-only'});assert.equal(s.version,11);noRanged(s);assert.equal(s.tick,before.tick);assert.equal(s.level,before.level);assert.equal(s.phase,before.phase);assert.equal(s.saved,before.saved);assert.equal(s.lost,before.lost);assert.equal(s.kills,before.kills);assert.deepEqual(s.achievements,before.achievements);assert.deepEqual(s.artillery,before.artillery);assert.deepEqual(s.bullets,before.bullets);assert.deepEqual(s.civilians,before.civilians);assert.deepEqual(s.refuges,before.refuges);assert.deepEqual(s.gates,before.gates);assert.equal(s.spawned,before.spawned);assert.equal(s.schedule.length,before.schedule.length);
 assert.deepEqual(s.soldiers.map(({evadeUntil,...u})=>u),before.soldiers.map(({evadeUntil,...u})=>u));assert.deepEqual(s.zombies.map(({id,x,y})=>({id,x,y})),before.zombies.map(({id,x,y})=>({id,x,y})));
 for(const z of s.zombies){assert.ok(z.hp>0&&z.hp<=z.maxHp);assert.ok(walkable(s,z.x,z.y,'human',z.r));}assert.ok(before.zombies.some(armed),'转换不修改原存档');assert.throws(()=>commandRescue(s,{type:'melee-only'}));
 let after=s;for(let i=0;i<300&&after.winner===null;i++){after=stepRescue(after);noRanged(after);}
});
test('取消远程攻击的旧行动可保存、继续和重放，原十版录像仍能精确回放',()=>{
 const original=oldRecord(),m={state:replayRescue(original),record:{...structuredClone(original),end:null}};
 issueRescue(m,{type:'pause'});issueRescue(m,{type:'melee-only'});const paused=sealRescue(m);assert.equal(paused.format,'rescue-10');assert.deepEqual(replayRescue(paused),m.state);assert.equal(m.state.version,11);assert.equal(stepRescue(m.state),m.state);
 issueRescue(m,{type:'resume'});for(let i=0;i<90&&m.state.winner===null;i++)advanceRescue(m);noRanged(m.state);assert.deepEqual(replayRescue(sealRescue(m)),m.state);assert.ok(replayRescue(original).zombies.some(armed));
});
test('旧版在部署和暂停时均可切换，已经结束的结果不被重写',()=>{
 for(const phase of ['deploy','paused']){let s=initRescue({version:10,level:2});if(phase==='paused')s=commandRescue(commandRescue(s,{type:'start'}),{type:'pause'});const next=commandRescue(s,{type:'melee-only'});assert.equal(next.phase,phase);assert.equal(next.tick,0);assert.equal(next.version,11);assert.ok(next.schedule.every(w=>!armed(w)));}
 const ended=initRescue({version:10});ended.phase='ended';ended.winner=true;assert.throws(()=>commandRescue(ended,{type:'melee-only'}));
});
test('原本远距离攻击门障的感染者切换后会走近砸门，不会原地卡死',()=>{
 let s=commandRescue(initRescue({version:10}),{type:'gate',door:'door0'});s=commandRescue(s,{type:'start'});s.refuges=[];s.civilians=[];s.crates=[];s.schedule=[{tick:9999,entry:0,wave:1}];s.supplies=0;s.soldiers=s.soldiers.slice(0,1);Object.assign(s.soldiers[0],{x:6.5,y:8.5,hp:1000,maxHp:1000,anchor:{x:6.5,y:8.5},cooldown:99999,orderedAt:99999});
 s.zombies=[{id:'z0',kind:'zombie',x:13.5,y:8.5,r:.23,hp:96,maxHp:96,mutation:'gunner',brute:false,fast:false,angle:Math.PI,path:[],goal:null,target:'door0',gateId:'door0',nav:s.nav,cooldown:0,hitTick:-100,attackAt:99999,aim:{x:8.5,y:8.5,until:99999},burst:null}];
 s=commandRescue(s,{type:'melee-only'});s=stepRescue(s);assert.ok(s.zombies[0].path.length>0);assert.ok(s.zombies[0].x<13.5);for(let i=0;i<450;i++)s=stepRescue(s);assert.equal(s.gates[0].hp,0);assert.ok(s.zombies[0].x<8.5);noRanged(s);
});
test('只取消敌方远程能力，我方机枪、榴弹、炮击继续造成伤害',()=>{
 const m=beginRescue({level:3});issueRescue(m,{type:'start'});m.state.schedule=[{tick:9999,entry:0,wave:1}];m.state.refuges=[];m.state.civilians=[];m.state.crates=[];
 m.state.zombies=[{id:'z-test',kind:'zombie',x:5.5,y:13.5,r:.34,hp:900,maxHp:900,mutation:'breaker',brute:true,fast:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:99999,hitTick:-100,gateId:null,attackAt:0,aim:null,burst:null}];
 for(let i=0;i<18;i++)advanceRescue(m);assert.ok(m.state.zombies[0].hp<900);assert.ok(m.state.events.some(e=>e.weapon==='gunner'));assert.ok(m.state.events.some(e=>e.weapon==='grenadier'));const z=m.state.zombies[0],hp=z.hp;issueRescue(m,{type:'artillery',x:z.x,y:z.y});for(let i=0;i<24;i++)advanceRescue(m);assert.ok(!m.state.zombies.length||m.state.zombies[0].hp<hp-300);assert.ok(m.state.events.some(e=>e.kind==='airBlast'&&e.manual));noRanged(m.state);
 const fresh=beginRescue({level:2});issueRescue(fresh,{type:'start'});issueRescue(fresh,{type:'artillery',x:18.5,y:11.5});for(let i=0;i<30;i++)advanceRescue(fresh);assert.equal(sealRescue(fresh).format,'rescue-11');assert.deepEqual(replayRescue(sealRescue(fresh)),fresh.state);
});
test('九关完整流程覆盖常规波次、撤离增援、感染巢与据点增援，全程没有敌方远程攻击',()=>{
 const types=new Set();let artillery=0;
 for(let level=1;level<=9;level++){
  const r=reclamationScenario({version:11,level,plan:'tactical',onStep(s){noRanged(s);for(const z of s.zombies)types.add(z.mutation);}});assert.notEqual(r.state.winner,null);artillery+=r.state.artillery.used;
  if([1,9].includes(level))assert.deepEqual(replayRescue(r.record),r.state);
 }
 assert.ok(types.has('runner')&&types.has('breaker'));assert.ok(artillery>0);
});
