import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/common.mjs';
import {TRACKS,createKart,stepKart,kartAI,sealKart,replayKart,curveAt} from '../src/kart.mjs';
import {createDance,advanceDance,inputDance,confirmDance,sealDance,replayDance,danceJudge,danceAccuracy} from '../src/dance.mjs';
import {runBattle,distance} from '../src/chess-battle.mjs';
import {chessInfo} from '../src/chess-catalog.mjs';

test('racing: acceleration, brakes, walls and countdown affect the actual car',()=>{
 let s=createKart();for(let i=0;i<180;i++)s=stepKart(s,{gas:true});assert.equal(s.cars[0].z,0);assert.equal(s.phase,'racing');
 for(let i=0;i<120;i++)s=stepKart(s,{gas:true});assert.ok(s.cars[0].speed>100);const fast=s.cars[0].speed;
 for(let i=0;i<30;i++)s=stepKart(s,{brake:true});assert.ok(s.cars[0].speed<fast-70);
 for(let i=0;i<300;i++)s=stepKart(s,{gas:true,steer:1});assert.ok(s.cars[0].collisions>0);assert.ok(Math.abs(s.cars[0].x)<=1.32);assert.ok(s.cars[0].speed<=110);
});
test('racing: straight weaving cannot farm nitro; a clean corner gives a release boost',()=>{
 let s=createKart();s.phase='racing';s.countdown=0;s.cars[0].speed=180;s.cars[0].z=10;
 for(let i=0;i<20;i++)s=stepKart(s,{gas:true,drift:true,steer:i%2?-.3:.3});assert.equal(s.cars[0].drift,0);
 s.cars[0].z=44*24;s.cars[0].x=-.1;s.cars[0].speed=180;assert.ok(curveAt(TRACKS.harbor,s.cars[0].z)>.5);
 for(let i=0;i<42;i++)s=stepKart(s,{gas:true,drift:true,steer:.3});assert.ok(s.cars[0].drift>.18);
 s=stepKart(s,{gas:true});assert.ok(s.cars[0].mini>0);assert.equal(s.cars[0].drifts,1);assert.ok(s.cars[0].meter>0);
 s.cars[0].nitro=1;s=stepKart(s,{boost:true,gas:true});assert.equal(s.cars[0].nitro,0);assert.ok(s.cars[0].boost>2);const boost=s.cars[0].boost;s=stepKart(s,{boost:true});assert.ok(s.cars[0].boost<boost);
});
test('racing: both tracks complete two laps with reachable AI driving and stable input replays',()=>{
 for(const track of Object.keys(TRACKS))for(const difficulty of ['practice','standard']){
  const options={track,difficulty,seed:17};let s=createKart(options);const inputs=[];
  while(s.phase!=='finished'){const input=kartAI(s,0);inputs.push({tick:s.tick,input});s=stepKart(s,input);}
  assert.notEqual(s.finishTime,null,track+' '+difficulty+' should finish');assert.ok(s.finishTime<100);assert.ok(s.cars[0].drifts>1);assert.ok(s.cars[0].collisions<12);
  assert.equal(fingerprint(replayKart(sealKart(options,inputs,s))),fingerprint(s));
 }
});
test('racing: invalid and oversized recordings are rejected',()=>{
 assert.throws(()=>replayKart({format:'kart-1',inputs:[],end:{tick:1000000}}));
 let s=createKart();s=stepKart(s);const r=sealKart({},[],s);r.end.hash='bad';assert.throws(()=>replayKart(r));
});
test('dance: full arrows plus fourth-beat confirm awards one score, not repeat points',()=>{
 let s=createDance();const row=s.chart[0];for(let i=0;i<row.keys.length;i++)s=inputDance(s,row.keys[i],row.start+i*100);
 assert.equal(s.entered,row.keys.length);s=confirmDance(s,row.target);assert.equal(s.players[0].counts.perfect,1);assert.equal(s.players[0].score,1000);
 s=confirmDance(s,row.target+10);assert.equal(s.players[0].score,1000);assert.equal(s.players[0].combo,1);
});
test('dance: incomplete, wrong, early, late and missed inputs are distinct',()=>{
 let s=createDance(),row=s.chart[0];s=inputDance(s,row.keys[0],row.start);s=inputDance(s,row.keys[1]==='left'?'right':'left',row.start+50);assert.equal(s.entered,0);
 s=confirmDance(s,row.target);assert.equal(s.players[0].counts.miss,1);assert.equal(danceJudge(-56),'great');assert.equal(danceJudge(111),'good');assert.equal(danceJudge(181),'miss');
 s=advanceDance(s,s.chart[1].target+181);assert.equal(s.players[0].counts.miss,2);
});
test('dance: calibration shifts judgment and the audio-independent recording stays deterministic',()=>{
 const options={song:'metro',difficulty:'standard',seed:29,offset:80};let s=createDance(options);const inputs=[];
 for(const row of s.chart){
  if(row.index%3===0){s=advanceDance(s,row.end-20);continue;}
  for(let i=0;i<row.keys.length;i++){const event={key:row.keys[i],time:row.start+i*85};inputs.push(event);s=inputDance(s,event.key,event.time);}
  const event={key:'confirm',time:row.target+80};inputs.push(event);s=confirmDance(s,event.time);s=advanceDance(s,row.end-10);
 }
 s=advanceDance(s,s.chart.at(-1).end);assert.equal(s.phase,'finished');assert.equal(s.players[0].counts.perfect,16);assert.equal(s.players[0].counts.miss,8);assert.equal(danceAccuracy(s.players[0],24),67);
 assert.equal(fingerprint(replayDance(sealDance(options,inputs,s))),fingerprint(s));assert.ok(s.players[1].counts.miss>0);
});
test('chess: melee units cross the center and reach a remote enemy; deployment remains unchanged',()=>{
 const units=[{uid:'u1',type:'C01',star:1,cell:63,items:[]},{uid:'u2',type:'C13',star:1,cell:0,items:[]}];
 const setup={seed:17,round:4,players:units.map(u=>({units:[u]}))},before=structuredClone(setup),battle=runBattle(setup);
 assert.deepEqual(setup,before);assert.ok(battle.frames.some(f=>f.units.some(u=>u.uid==='u1'&&u.cell<32)));assert.notEqual(battle.winner,-1);
 // Focus rings use the same grid distance and catalog range as the combat engine.
 const f=battle.frames.find(f=>f.units.length===2&&distance(f.units[0].cell,f.units[1].cell)<=chessInfo('C01').range);assert.ok(f);
});
