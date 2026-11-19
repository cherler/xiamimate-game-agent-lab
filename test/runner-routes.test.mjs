import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fingerprint} from '../src/common.mjs';
import {createRunner,stepRunner,runnerRow,runnerScene,runnerRoute,sealRunner,replayRunner} from '../src/runner-v2.mjs';
import {runnerProjection,runnerRenderState} from '../web/runner-view.mjs';

function approach(kind){
 const s=createRunner({seed:17});s.phase='running';s.countdown=0;
 const row=Array.from({length:24},(_,i)=>runnerRow(s.seed,i)).find(r=>r.obstacles.some(o=>o.kind===kind)),o=row.obstacles.find(o=>o.kind===kind);
 s.z=o.z-7;s.x=s.lane=o.lane;return {s,o,row};
}
test('runner routes: three districts, authored action lines, resting phrases and an unobstructed option',()=>{
 for(let seed=0;seed<32;seed++)for(let index=0;index<120;index++){
  const row=runnerRow(seed,index);assert.ok(!row.obstacles.some(o=>o.lane===row.safe));assert.equal(row.zone,runnerRoute(row.z).zone.id);
  assert.ok(row.coins.filter(c=>!c.bonus).every(c=>c.lane===row.safe));
  if(row.rest)assert.equal(row.obstacles.length,0);
  for(const coin of row.coins.filter(c=>c.bonus)){const o=row.obstacles.find(o=>o.lane===coin.lane);assert.ok(['arch','barrier','gap'].includes(o.kind));assert.equal(coin.value,2);}
  if(index%8===7){assert.ok(row.rest);assert.ok(row.item);}
 }
 assert.equal(runnerRoute(399.9).zone.id,'station');assert.equal(runnerRoute(400).zone.id,'market');assert.equal(runnerRoute(800).zone.id,'river');assert.equal(runnerRoute(1200).zone.id,'station');
 assert.ok(new Set(Array.from({length:32},(_,seed)=>runnerRow(seed,24).obstacles.map(o=>o.kind+o.lane).join(','))).size>2,'later districts vary action phrases as well as mirror them');
});
test('runner routes: both difficulties remain traversable at maximum speed, including mirrors and district boundaries',()=>{
 for(const difficulty of ['practice','standard'])for(const seed of [17,73,41003]){
  const options={seed,difficulty},inputs=[];let s=createRunner(options);
  while(s.z<5000){const row=runnerScene(s,140).find(r=>r.z+14>s.z),target=row?.safe??1,actions=s.countdown?[]:target<s.lane?['left']:target>s.lane?['right']:[];if(actions.length)inputs.push({tick:s.tick,actions});s=stepRunner(s,actions);assert.notEqual(s.phase,'finished',JSON.stringify({difficulty,seed,z:s.z,reason:s.reason}));}
  assert.ok(s.coins>450);assert.equal(s.speed,difficulty==='practice'?27:34);assert.equal(fingerprint(replayRunner(sealRunner(options,inputs,s))),fingerprint(s));
 }
});
test('runner routes: jump and roll reward lines pay double stars, while ordinary ground running misses airborne stars',()=>{
 for(const kind of ['barrier','gap','arch']){
  let {s,row}=approach(kind);s=stepRunner(s,[kind==='arch'?'roll':'jump']);
  while(s.z<row.z+8&&s.phase!=='finished')s=stepRunner(s);
  assert.notEqual(s.phase,'finished',kind);assert.equal(s.coins,6,kind+' should collect three double stars');
 }
 let {s,row}=approach('barrier');while(s.z<row.z-3&&s.phase!=='finished')s=stepRunner(s);assert.equal(s.coins,0);
});
test('runner routes: passing a carriage front does not allow walking through its rear; a board covers the entire collision',()=>{
 let {s,o}=approach('train');s.z=o.z+6;s=stepRunner(s);assert.equal(s.phase,'finished');assert.equal(s.reason.kind,'train');
 let safe=approach('train').s;safe=stepRunner(safe,['board']);let saved=0;while(safe.z<o.z+15){safe=stepRunner(safe);saved+=safe.events.filter(e=>e.kind==='saved').length;assert.notEqual(safe.phase,'finished');}
 assert.equal(saved,1);assert.equal(safe.boards,0);
});
test('runner routes: old and new recordings retain their own rules, and cross-version records are rejected',()=>{
 const old=JSON.parse(fs.readFileSync(new URL('./fixtures/runner-1-pre-courier.json',import.meta.url),'utf8')),restored=replayRunner(old);assert.equal(restored.version,1);assert.equal(restored.phase,'finished');assert.equal(fingerprint(restored),old.end.hash);
 let s=createRunner({seed:17});while(s.phase!=='finished')s=stepRunner(s);const record=sealRunner({seed:17},[],s);assert.equal(record.format,'runner-2');assert.equal(fingerprint(replayRunner(record)),fingerprint(s));
 assert.throws(()=>replayRunner({...record,options:{...record.options,rules:1}}));assert.throws(()=>replayRunner({...record,format:'runner-1'}));assert.throws(()=>replayRunner({...record,end:{...record.end,hash:'bad'}}));
});
test('runner routes: scenery bends continuously at district borders and interpolating does not alter a replay state',()=>{
 for(const z of [400,800,1200,1600]){
  const s=createRunner();s.z=z-1e-5;const a=runnerProjection(s,390,580)(0,z+100);s.z=z+1e-5;const b=runnerProjection(s,390,580)(0,z+100);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.001);
 }
 const s=createRunner();s.countdown=0;s.phase='running';const next=stepRunner(s,['right','jump']),copy=structuredClone(next),frame=runnerRenderState(s,next,.5);assert.deepEqual(next,copy);assert.ok(frame.x>s.x&&frame.x<next.x);assert.equal(frame.version,2);
});
