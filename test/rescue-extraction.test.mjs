import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initRescue,commandRescue,stepRescue,replayRescue,rescueMap} from '../src/rescue.mjs';

const z=(x,y)=>({id:'z990',kind:'zombie',x,y,r:.23,hp:1000,maxHp:1000,fast:false,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:0,hitTick:-100});
function gathering(all=false,difficulty='normal'){
 let s=commandRescue(initRescue({difficulty,version:3}),{type:'start'});
 for(const [i,c] of s.civilians.entries())if(all||i===0)Object.assign(c,{x:2.2+i%4*.65,y:12.3+Math.floor(i/4)*.45,status:'following',leader:'s0'});
 s=stepRescue(s);return s;
}
function quiet(s){s.schedule=[{tick:5000,entry:0,fast:false,wave:1}];s.spawned=0;s.zombies=[];return s;}

test('升级撤离规则后，三份 rescue-2 完整回放保持原终态',()=>{
 for(const level of [1,2,3]){const record=JSON.parse(readFileSync(new URL(`fixtures/rescue-v2-level${level}.json`,import.meta.url)));const s=replayRescue(record);assert.equal(s.version,2);assert.equal(s.evac,undefined);assert.equal(s.winner,true);assert.equal(s.saved,rescueMap(level,2).total);}
});
test('到达撤离区进入集结而非立即获救，同时只触发一轮预警尸潮',()=>{
 let s=gathering();assert.equal(s.civilians[0].status,'boarding');assert.equal(s.saved,0);assert.equal(s.winner,null);assert.equal(s.evac.alerts,1);assert.equal(s.schedule.filter(w=>w.assault).length,6);assert.ok(s.schedule.every((w,i)=>!i||w.tick>=s.schedule[i-1].tick));
 for(let i=0;i<35;i++)s=stepRescue(s);assert.equal(s.saved,0);assert.equal(s.evac.alerts,1);assert.equal(s.schedule.filter(w=>w.assault).length,6);
});
test('守满读秒后才整批撤离，抵达和最后一帧都不能提前结束',()=>{
 let s=quiet(gathering(true));while(s.evac.progress<s.evac.required-1)s=stepRescue(s);
 assert.equal(s.saved,0);assert.equal(s.winner,null);s=stepRescue(s);assert.equal(s.saved,10);assert.equal(s.winner,true);assert.equal(s.evac.batches,1);assert.equal(s.evac.phase,'complete');
});
test('没有护卫时暂停进度，返回后续接；战术暂停不消耗撤离时间',()=>{
 let s=quiet(gathering());const progress=s.evac.progress;s.soldiers.forEach((u,i)=>Object.assign(u,{x:19+i*.5,y:11,path:[]}));s=stepRescue(s);assert.equal(s.evac.phase,'unguarded');assert.equal(s.evac.progress,progress);
 Object.assign(s.soldiers[0],{x:4.5,y:11.5});s=stepRescue(s);assert.equal(s.evac.phase,'loading');assert.equal(s.evac.progress,progress+1);s=commandRescue(s,{type:'pause'});assert.equal(stepRescue(s),s);assert.equal(stepRescue(commandRescue(s,{type:'resume'})).evac.progress,progress+2);
});
test('尸群逼近会暂停接驳，清除威胁后保留原进度继续',()=>{
 let s=quiet(gathering());s.zombies=[z(6.4,12.5)];const progress=s.evac.progress;s=stepRescue(s);assert.equal(s.evac.phase,'contested');assert.equal(s.evac.progress,progress);s.zombies=[];s=stepRescue(s);assert.equal(s.evac.phase,'loading');assert.equal(s.evac.progress,progress+1);
});
test('排队接驳的平民仍可能感染，未完成读秒不享受安全状态',()=>{
 let s=quiet(gathering(false,'challenge'));const c=s.civilians[0];s.zombies=[z(c.x,c.y)];s.soldiers.forEach(u=>{u.reload=100;});s=stepRescue(s);assert.equal(s.civilians[0].status,'infected');assert.equal(s.lost,1);assert.equal(s.saved,0);
});
test('狂暴确实提高移动速度，不只是颜色变化',()=>{
 const base=commandRescue(initRescue({version:3}),{type:'start'});base.zombies=[z(3.5,6.5)];const rage=structuredClone(base);rage.evac.rageUntil=100;
 const normal=stepRescue(base).zombies[0],fast=stepRescue(rage).zombies[0];assert.ok(Math.hypot(fast.x-3.5,fast.y-6.5)>Math.hypot(normal.x-3.5,normal.y-6.5));
});
test('新版不能靠空场或耗尽时限绕过平民撤离',()=>{
 let s=commandRescue(initRescue({version:3}),{type:'start'});s.schedule=[];s=stepRescue(s);assert.equal(s.winner,null);s.tick=1799;s=stepRescue(s);assert.equal(s.winner,false);assert.equal(s.reason,'撤离时间耗尽');
});
