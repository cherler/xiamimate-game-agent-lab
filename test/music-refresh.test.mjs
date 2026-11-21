import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SONGS,rhythmArrangement} from '../src/rhythm-music.mjs';
import {createRhythm,advanceRhythm,pressRhythm,releaseRhythm,sealRhythm,replayRhythm} from '../src/rhythm.mjs';
import {fingerprint} from '../src/common.mjs';
import {audibleTime} from '../web/audio-clock.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/rhythm-1-before-music.json',import.meta.url),'utf8'));
test('music refresh preserves a recording made before this change',()=>{assert.equal(fingerprint(replayRhythm(fixture)),fixture.end.hash);assert.equal(replayRhythm(fixture).version,1);});
test('all six music charts can be completed perfectly and replayed',()=>{
 assert.equal(Object.keys(SONGS).length,6);
 for(const song of Object.keys(SONGS))for(const difficulty of ['practice','standard']){
  const options={song,difficulty,seed:17,offset:50};let state=createRhythm(options);const inputs=state.notes.flatMap(n=>[{type:'down',lane:n.lane,time:n.at+50},{type:'up',lane:n.lane,time:n.at+50+(n.duration||20)}]).sort((a,b)=>a.time-b.time||a.lane-b.lane),ends=[-1,-1,-1,-1];
  for(const n of state.notes){assert.ok(n.at>ends[n.lane]+80,song+' lane spacing');ends[n.lane]=n.at+n.duration;assert.ok(n.at+n.duration<state.duration);}
  for(const e of inputs)state=e.type==='down'?pressRhythm(state,e.lane,e.time):releaseRhythm(state,e.lane,e.time);
  state=advanceRhythm(state,state.duration);assert.equal(state.players[0].counts.perfect,state.notes.length,song+'/'+difficulty);
  assert.equal(fingerprint(replayRhythm(sealRhythm(options,inputs,state))),fingerprint(state));
 }
});
test('recorded plucked melody stays short; sustained melody includes source note-offs',()=>{
 assert.ok(rhythmArrangement('street').every(n=>n.duration===0));assert.ok(rhythmArrangement('raspberry').filter(n=>n.duration>0).length>8);
 for(const id of ['street','raspberry'])assert.ok(rhythmArrangement(id).every(n=>Number.isInteger(n.sourceRow)&&Number.isInteger(n.sourceChannel)));
});
test('judgment clock follows audible device output, not the render queue',()=>{
 const context={currentTime:10.3,outputLatency:.15,getOutputTimestamp:()=>({contextTime:10,performanceTime:950})};assert.equal(audibleTime(context,1000),10.05);
 assert.equal(audibleTime({...context,getOutputTimestamp:()=>({contextTime:0,performanceTime:0})},1000),10.15);
 assert.equal(audibleTime({...context,getOutputTimestamp:()=>({contextTime:11,performanceTime:999})},1000),10.3);
 assert.equal(audibleTime({currentTime:.01,baseLatency:.03},1000),0);
});
