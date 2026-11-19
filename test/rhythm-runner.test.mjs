import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/common.mjs';
import {rhythmArrangement,rhythmChart} from '../src/rhythm-music.mjs';
import {createRhythm,advanceRhythm,pressRhythm,releaseRhythm,rhythmAccuracy,sealRhythm,replayRhythm} from '../src/rhythm.mjs';
import {createRunner,stepRunner,runnerRow,runnerScene,jumpHeight,sealRunner,replayRunner} from '../src/runner.mjs';

test('rhythm charts use audible notes, have no same-lane overlap, and include holds and chords',()=>{
 for(const song of ['bay','metro'])for(const difficulty of ['practice','standard']){
  const audio=rhythmArrangement(song),notes=rhythmChart(song,difficulty),ends=[0,0,0,0];
  for(const n of notes){assert.ok(audio.some(a=>a.at===n.at&&a.lane===n.lane&&a.midi===n.midi&&a.duration===n.duration));assert.ok(n.at>ends[n.lane]);ends[n.lane]=n.at+n.duration;}
  assert.ok(notes.some(n=>n.duration>0));assert.ok(notes.some((n,i)=>notes[i+1]?.at===n.at));
 }
});
test('rhythm: wrong lane and key repeat do not score; short notes need a correctly timed press',()=>{
 let s=createRhythm(),n=s.notes[0];s=pressRhythm(s,(n.lane+1)%4,n.at);assert.equal(s.players[0].score,0);
 s=pressRhythm(s,n.lane,n.at);assert.equal(s.players[0].counts.perfect,1);const score=s.players[0].score;s=pressRhythm(s,n.lane,n.at+20);assert.equal(s.players[0].score,score);
});
test('rhythm: a full hold scores, releasing early misses, and another lane remains playable during a hold',()=>{
 const hold=createRhythm().notes.find(n=>n.duration>0);let s=createRhythm();s=pressRhythm(s,hold.lane,hold.at);assert.equal(s.holds[hold.lane].id,hold.id);
 const other=s.notes.find(n=>n.at>hold.at&&n.at<hold.at+hold.duration&&n.lane!==hold.lane);assert.ok(other);s=pressRhythm(s,other.lane,other.at);assert.equal(s.judgments[other.id],'perfect');s=releaseRhythm(s,other.lane,other.at+10);
 s=releaseRhythm(s,hold.lane,hold.at+hold.duration);assert.equal(s.judgments[hold.id],'perfect');assert.equal(s.holds[hold.lane],null);
 let early=createRhythm();early=pressRhythm(early,hold.lane,hold.at);early=releaseRhythm(early,hold.lane,hold.at+100);assert.equal(early.judgments[hold.id],'miss');assert.equal(early.feedback.reason,'松手太早');
});
test('rhythm: simultaneous chord lanes both count once',()=>{
 let s=createRhythm();const n=s.notes.find((n,i)=>s.notes[i+1]?.at===n.at),pair=s.notes.filter(v=>v.at===n.at);
 for(const note of pair)s=pressRhythm(s,note.lane,note.at);assert.equal(pair.filter(n=>s.judgments[n.id]==='perfect').length,pair.length);assert.ok(s.held.filter(Boolean).length===2);
});
test('rhythm: complete perfect charts and mixed misses replay identically across different frame schedules',()=>{
 for(const song of ['bay','metro'])for(const difficulty of ['practice','standard']){
  const options={song,difficulty,offset:80,seed:17};let s=createRhythm(options);const inputs=s.notes.flatMap(n=>[{type:'down',lane:n.lane,time:n.at+80},{type:'up',lane:n.lane,time:n.at+80+(n.duration||25)}]).sort((a,b)=>a.time-b.time||a.lane-b.lane);
  for(const e of inputs){s=advanceRhythm(s,e.time-1);s=e.type==='down'?pressRhythm(s,e.lane,e.time):releaseRhythm(s,e.lane,e.time);}
  s=advanceRhythm(s,s.duration);assert.equal(s.players[0].counts.perfect,s.notes.length);assert.equal(rhythmAccuracy(s.players[0]),100);assert.equal(s.players[0].bestCombo,s.notes.length);assert.equal(fingerprint(replayRhythm(sealRhythm(options,inputs,s))),fingerprint(s));
  const mixed=inputs.filter((e,i)=>i%9!==0);let m=createRhythm(options);for(const e of mixed)m=e.type==='down'?pressRhythm(m,e.lane,e.time):releaseRhythm(m,e.lane,e.time);m=advanceRhythm(m,m.duration);assert.equal(fingerprint(replayRhythm(sealRhythm(options,mixed,m))),fingerprint(m));
 }
});
test('rhythm recordings reject invalid lanes, broken order, and altered results',()=>{
 const s=createRhythm(),r=sealRhythm({},[],s);assert.throws(()=>replayRhythm({...r,inputs:[{type:'down',lane:5,time:0}]}));assert.throws(()=>replayRhythm({...r,end:{...r.end,hash:'bad'}}));
});
test('runner: generated rows always retain a clear route, even across many seeds and speeds',()=>{
 for(let seed=0;seed<40;seed++)for(let i=0;i<100;i++){const row=runnerRow(seed,i);assert.ok(!row.obstacles.some(o=>o.lane===row.safe));assert.ok(row.obstacles.every(o=>o.lane>=0&&o.lane<=2));assert.ok(row.coins.every(c=>c.lane===row.safe));}
});
function approach(kind){const s=createRunner({seed:17});s.phase='running';s.countdown=0;const row=Array.from({length:30},(_,i)=>runnerRow(s.seed,i)).find(r=>r.obstacles.some(o=>o.kind===kind)),o=row.obstacles.find(o=>o.kind===kind);s.z=o.z-7;s.x=s.lane=o.lane;return {s,o};}
test('runner: low barriers need jumping, overhead beams need rolling; trains cannot be jumped',()=>{
 for(const kind of ['barrier','arch','train','gap']){
  let {s}=approach(kind);const action=kind==='arch'?'roll':'jump';s=stepRunner(s,[action]);for(let i=0;i<40&&s.phase!=='finished';i++)s=stepRunner(s);
  if(kind==='train'){assert.equal(s.phase,'finished');assert.equal(s.reason.kind,'train');}else assert.notEqual(s.phase,'finished',kind);
  let fail=approach(kind).s;for(let i=0;i<40&&fail.phase!=='finished';i++)fail=stepRunner(fail);assert.equal(fail.phase,'finished',kind+' without input');
 }
});
test('runner: lane switches work in midair and rolling cancels a jump',()=>{
 let s=createRunner();s.phase='running';s.countdown=0;s=stepRunner(s,['jump','left']);for(let i=0;i<10;i++)s=stepRunner(s);assert.equal(s.lane,0);assert.ok(s.x<.1);assert.ok(jumpHeight(s)>0);s=stepRunner(s,['roll']);assert.equal(s.jump,-1);assert.ok(s.roll>0);
});
test('runner: a board absorbs one collision, spends one charge, and prevents repeated collision on that object',()=>{
 let {s}=approach('train');s=stepRunner(s,['board']);assert.equal(s.boards,0);let saved=false;
 for(let i=0;i<45;i++){s=stepRunner(s);saved||=s.events.some(e=>e.kind==='saved');assert.notEqual(s.phase,'finished');}assert.ok(saved);assert.equal(s.board,0);
});
test('runner: magnet gathers adjacent-lane coins and safe driving has no impossible sequences',()=>{
 const options={seed:73,difficulty:'standard'};let s=createRunner(options);const inputs=[];
 while(s.z<2000){const row=runnerScene(s,120).find(r=>r.z+7>s.z),target=row?.safe??s.lane,actions=s.countdown?[]:target<s.lane?['left']:target>s.lane?['right']:[];if(actions.length)inputs.push({tick:s.tick,actions});s=stepRunner(s,actions);assert.notEqual(s.phase,'finished');}
 assert.ok(s.coins>100);assert.ok(s.speed>20);assert.equal(fingerprint(replayRunner(sealRunner(options,inputs,s))),fingerprint(s));
 let a=createRunner(),b=createRunner();a.countdown=b.countdown=0;a.phase=b.phase='running';const row=runnerRow(a.seed,0);a.z=b.z=row.coins[0].z-.1;a.x=b.x=a.lane=b.lane=(row.safe+1)%3;b.magnet=5;a=stepRunner(a);b=stepRunner(b);assert.equal(a.coins,0);assert.equal(b.coins,1);
});
test('runner: complete crashed recordings and malformed recordings are handled deterministically',()=>{
 const options={seed:11};let s=createRunner(options);while(s.phase!=='finished')s=stepRunner(s);assert.ok(s.z>80);assert.equal(fingerprint(replayRunner(sealRunner(options,[],s))),fingerprint(s));assert.throws(()=>replayRunner({format:'runner-1',game:'runner',inputs:[],end:{tick:1e9,hash:''}}));
});
