import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fingerprint} from '../src/common.mjs';
import {createRunner,stepRunner,runnerRow,runnerScene,RUNNER_PACE,sealRunner,replayRunner} from '../src/runner.mjs';
import {runnerImpact} from '../web/runner-feedback.mjs';

function before(kind,difficulty='standard',max=false){
 const s=createRunner({seed:17,difficulty});s.phase='running';s.countdown=0;s.time=max?200:0;
 const row=Array.from({length:24},(_,i)=>runnerRow(s.seed,i)).find(r=>r.obstacles.some(o=>o.kind===kind)),o=row.obstacles.find(o=>o.kind===kind);
 const speed=RUNNER_PACE[difficulty][max?'max':'start'];s.z=o.z-speed*.3;s.x=s.lane=o.lane;return {s,row,o};
}
test('runner rush: brisk default, first dodge within two running seconds, and meaningful slow practice',()=>{
 let s=createRunner();assert.equal(s.difficulty,'standard');while(s.phase!=='finished')s=stepRunner(s);
 assert.equal(s.reason.kind,'train');assert.ok(s.time>1.4&&s.time<2);assert.ok(s.speed>=34);
 let easy=createRunner({difficulty:'practice'});while(easy.phase!=='finished')easy=stepRunner(easy);assert.ok(easy.time>s.time*1.3);
});
test('runner rush: safe routes survive both maximum speeds and later mirrored districts',()=>{
 for(const difficulty of ['practice','standard'])for(const seed of [0,17,73,41003,712,991]){
  const options={difficulty,seed},inputs=[];let s=createRunner(options);
  while(s.z<5000){const row=runnerScene(s,140).find(r=>r.z+14>s.z),target=row?.safe??1,actions=s.countdown?[]:target<s.lane?['left']:target>s.lane?['right']:[];if(actions.length)inputs.push({tick:s.tick,actions});s=stepRunner(s,actions);assert.notEqual(s.phase,'finished',JSON.stringify({difficulty,seed,z:s.z,reason:s.reason}));}
  assert.equal(s.speed,RUNNER_PACE[difficulty].max);assert.ok(s.coins>450);assert.equal(fingerprint(replayRunner(sealRunner(options,inputs,s))),fingerprint(s));
 }
});
test('runner rush: jump and roll remain viable and collect all bonus stars from starting to maximum speed',()=>{
 for(const difficulty of ['practice','standard'])for(const max of [false,true])for(const kind of ['barrier','gap','arch']){
  let {s,row}=before(kind,difficulty,max);s=stepRunner(s,[kind==='arch'?'roll':'jump']);
  while(s.z<row.z+8&&s.phase!=='finished')s=stepRunner(s);
  assert.notEqual(s.phase,'finished',JSON.stringify({kind,difficulty,max,z:s.z}));assert.equal(s.coins,6,`${kind} ${difficulty} ${max}`);
 }
});
test('runner rush: a committed dodge escapes; an input after contact cannot undo the crash; a board absorbs one full carriage',()=>{
 let {s,o}=before('train');s.z=o.z-7;while(s.z<o.z+15&&s.phase!=='finished')s=stepRunner(s,s.lane===o.lane?['left']:[]);assert.notEqual(s.phase,'finished');
 let late=before('train').s;late.z=o.z-2.1;late=stepRunner(late,['left']);assert.equal(late.phase,'finished');assert.equal(stepRunner(late,['right','jump']),late);
 let saved=before('train','standard',true).s;saved=stepRunner(saved,['board']);let hits=0;while(saved.z<o.z+15&&saved.phase!=='finished'){saved=stepRunner(saved);hits+=saved.events.filter(e=>e.kind==='saved').length;}assert.notEqual(saved.phase,'finished');assert.equal(hits,1);assert.equal(saved.board,0);assert.equal(saved.boards,0);
 let rear=before('train').s;rear.z=o.z+9;assert.equal(stepRunner(rear).phase,'finished');
});
test('runner rush: both historical versions reproduce their hashes and current recordings cannot masquerade as old rules',()=>{
 for(const version of [1,2]){const name=version===1?'runner-1-pre-courier':'runner-2-pre-rush',rec=JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url)));assert.equal(fingerprint(replayRunner(rec)),rec.end.hash);assert.equal(replayRunner(rec).version,version);}
 let s=createRunner({seed:17});while(s.phase!=='finished')s=stepRunner(s);const rec=sealRunner({seed:17},[],s);assert.equal(rec.format,'runner-3');assert.deepEqual(replayRunner(rec),s);
 assert.throws(()=>replayRunner({...rec,options:{...rec.options,rules:2}}));assert.throws(()=>replayRunner({...rec,format:'runner-2'}));assert.throws(()=>replayRunner({...rec,end:{...rec.end,hash:'broken'}}));
});
test('runner rush: impact has a readable recoil or fall, while reduced motion removes flash and camera shake',()=>{
 const impact={kind:'crash',obstacle:'train',at:100},a=runnerImpact(impact,190),reduced=runnerImpact(impact,190,true);assert.ok(a.recoil>.5);assert.notEqual(a.shake,0);assert.equal(reduced.shake,0);assert.equal(reduced.flash,0);assert.equal(reduced.recoil,0);
 const fall=runnerImpact({...impact,obstacle:'gap'},700);assert.ok(fall.scale<.7&&fall.drop>40);assert.equal(runnerImpact({...impact,kind:'saved'},1000),null);
});
