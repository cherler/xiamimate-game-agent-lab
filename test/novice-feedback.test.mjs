import test from 'node:test';import assert from 'node:assert/strict';
import {recruitPreview,placementPreview,battleMoment} from '../web/chess-feedback.mjs';
import {stepChess,initChess,synergyDetails} from '../src/chess.mjs';
const unit=(uid,type,cell=null,star=1)=>({uid,type,cell,star,items:[]});
test('招募预览按实际副本升星，同名不会重复计入羁绊',()=>{
 const p={level:3,units:[unit('a','C01',35),unit('b','C01'),unit('c','C01',null,2),unit('d','C01',null,2)]};
 assert.equal(recruitPreview(p,'C01').mergeStar,3);assert.equal(recruitPreview(p,'C01').traits.length,0);
});
test('落格预览包含换下棋子的羁绊影响，拒绝人口超限，撤销布阵不返还经济',()=>{
 let s=initChess(23);s.players[0].level=1;s.players[0].units=[unit('a','C01',35),unit('b','C04')];
 const before=s.players[0].units.map(u=>({...u})),prediction=placementPreview(s.players[0],'b',35);
 assert.equal(prediction.legal,true);assert.equal(prediction.population,1);assert.equal(placementPreview(s.players[0],'b',36).legal,false);
 s=stepChess(s,0,{type:'move',uid:'b',cell:35});const actual=synergyDetails(s.players[0].units.filter(u=>u.cell!==null));
 assert.ok(prediction.traits.every(t=>actual.some(a=>a.id===t.id&&a.count===t.count)));
 const gold=s.players[0].gold;s=stepChess(s,0,{type:'arrange',layout:[{uid:'a',cell:35}]});assert.deepEqual(s.players[0].units,before);assert.equal(s.players[0].gold,gold);
});
test('战后高亮使用实际退场格，不将伤害榜伪称战败原因',()=>{
 const a={...unit('a','C01',35),actor:0},b={...unit('b','C04',36),actor:0};
 const result=battleMoment({winner:1,frames:[{tick:0,units:[a,b]},{tick:30,units:[b]}]});assert.equal(result.uid,'a');assert.equal(result.cell,35);assert.equal(result.value,'3 秒');
});
import {createKart,DRIFT_READY} from '../src/kart.mjs';
import {driftFeedback} from '../web/kart-view.mjs';
test('漂移提示的可释放刻度等于真实小喷门槛，直道按漂移不会假报就绪',()=>{
 const s=createKart();s.cars[0].speed=180;s.cars[0].drifting=true;s.cars[0].slip=1;s.cars[0].drift=DRIFT_READY-.001;
 assert.equal(driftFeedback(s).stage,'charging');s.cars[0].drift=DRIFT_READY;assert.equal(driftFeedback(s).stage,'ready');s.cars[0].x=1.2;assert.notEqual(driftFeedback(s).stage,'ready');s.cars[0].drift=0;assert.equal(driftFeedback(s).progress,0);
});
import fs from 'node:fs';
import {initRescue,commandRescue,stepRescue,replayRescue,RESCUE_HZ} from '../src/rescue.mjs';
import {createRunner,stepRunner} from '../src/runner.mjs';
import {queueRunnerInput,takeRunnerInput} from '../web/runner-input.mjs';
import {SONGS,rhythmArrangement,rhythmChart} from '../src/rhythm-music.mjs';
import {createRhythm,pressRhythm,releaseRhythm,advanceRhythm,sealRhythm,replayRhythm} from '../src/rhythm.mjs';
test('救援速射补给只触发一次，额外尸潮先预警，暂停不消耗强化时间',()=>{
 let s=commandRescue(initRescue({level:2}),{type:'start'}),crate=s.crates.find(c=>c.reward==='overdrive');
 Object.assign(s.soldiers[0],{x:crate.x,y:crate.y,anchor:{x:crate.x,y:crate.y}});const initial=s.schedule.length;s=stepRescue(s);
 assert.equal(s.overdriveUntil,s.tick+25*RESCUE_HZ);assert.equal(s.schedule.length,initial+10);assert.ok(s.schedule.filter(w=>w.cache).every(w=>w.tick>=s.tick+4*RESCUE_HZ));
 const until=s.overdriveUntil;s=commandRescue(s,{type:'pause'});assert.deepEqual(stepRescue(s),s);s=commandRescue(s,{type:'resume'});s=stepRescue(s);assert.equal(s.overdriveUntil,until);assert.equal(s.schedule.length,initial+10);
});
test('发布前的七版救援完整录像仍然按原规则回放',()=>{
 const r=JSON.parse(fs.readFileSync(new URL('fixtures/rescue-v7-first-mission.json',import.meta.url)));const s=replayRescue(r);assert.equal(s.version,7);assert.equal(s.winner,true);assert.equal(s.crates.some(c=>c.reward==='overdrive'),false);
});
test('低帧率下两次同向换道按顺序执行，临近落地的跳跃输入不会丢失',()=>{
 let s=createRunner(),q=[];s.countdown=0;s.phase='running';s.lane=s.x=2;
 q=queueRunnerInput(q,'left',s.tick);q=queueRunnerInput(q,'left',s.tick);
 for(let i=0;i<2;i++){const n=takeRunnerInput(q,s);q=n.queue;s=stepRunner(s,n.actions);}assert.equal(s.lane,0);
 s.jump=.66;q=queueRunnerInput([],'jump',s.tick);let jumped=false;
 for(let i=0;i<10;i++){const n=takeRunnerInput(q,s);q=n.queue;s=stepRunner(s,n.actions);jumped||=s.events.some(e=>e.kind==='jump');}assert.ok(jumped);
 q=queueRunnerInput([],'roll',0);assert.deepEqual(takeRunnerInput(q,{tick:20,jump:-1}).actions,[]);
});
test('六首歌曲两种谱面完整按音符演奏，长音/双键/回放均一致',()=>{
 for(const song of Object.keys(SONGS))for(const difficulty of ['practice','standard']){
  const options={song,difficulty,offset:40,seed:17};let s=createRhythm(options);
  const audio=rhythmArrangement(song);assert.ok(s.notes.every(n=>audio.some(a=>a.at===n.at&&a.lane===n.lane&&a.duration===n.duration)));
  const inputs=s.notes.flatMap(n=>[{type:'down',lane:n.lane,time:n.at+40},{type:'up',lane:n.lane,time:n.at+40+(n.duration||20)}]).sort((a,b)=>a.time-b.time||(a.type==='up'?-1:1));
  for(const e of inputs)s=e.type==='down'?pressRhythm(s,e.lane,e.time):releaseRhythm(s,e.lane,e.time);
  s=advanceRhythm(s,s.duration);assert.equal(s.players[0].counts.perfect,s.notes.length,song+'/'+difficulty);assert.deepEqual(replayRhythm(sealRhythm(options,inputs,s)),s);
 }
 const first=rhythmChart('bay','practice');assert.ok(first.slice(0,4).every(n=>n.duration===0));assert.ok(first.slice(0,4).every((n,i)=>i===0||n.at>first[i-1].at));
});
