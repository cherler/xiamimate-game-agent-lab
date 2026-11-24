import test from 'node:test';
import assert from 'node:assert/strict';
import {cardGuidance} from '../web/card-guidance.mjs';
import {beginStrategy,advanceStrategy} from '../src/strategy.mjs';
import {cardActions,cardInfo} from '../src/cards.mjs';
import {RhythmFeedback} from '../web/rhythm-feedback.mjs';
import {createRhythm,pressRhythm,releaseRhythm,advanceRhythm} from '../src/rhythm.mjs';
import {RunnerPractice,runnerMistake} from '../web/runner-practice.mjs';
import {createRunner,stepRunner,sealRunner,replayRunner} from '../src/runner.mjs';
import {initPong,stepPong,motor} from '../src/pong.mjs';
import {createPongOpponent,pongOpponentAction} from '../src/pong-opponent.mjs';

test('card guidance distinguishes cost, full board, missing target and partial summons using legal plays',()=>{
 const m=beginStrategy('cards',1);for(let actor=0;actor<2;actor++)advanceStrategy(m,actor,{type:'mulligan',replace:[]});
 const s=m.state,a=s.turn,p=s.players[a],c={uid:'test',cardId:'N06'};p.hand=[c];p.mana=0;
 assert.match(cardGuidance(s,a,c,cardInfo(c.cardId),cardActions(s,a)),/差/);
 p.mana=8;assert.equal(cardGuidance(s,a,c,cardInfo(c.cardId),cardActions(s,a)),'没有可选目标');
 c.cardId='W09';p.board=Array.from({length:5},(_,i)=>({uid:'b'+i,cardId:'N01',exhausted:true}));
 assert.equal(cardGuidance(s,a,c,cardInfo(c.cardId),cardActions(s,a)),'战场已满');
 p.board.pop();assert.equal(cardGuidance(s,a,c,cardInfo(c.cardId),cardActions(s,a)),'附带召唤 0 / 1');
});
test('rhythm feedback retains both chord lanes, detects early release and declines noisy calibration',()=>{
 let s=createRhythm({difficulty:'standard'});const f=new RhythmFeedback(),receive=next=>{f.capture(s,next);s=next;};
 const chord=s.notes.find(n=>!n.duration&&s.notes.some(o=>o.id!==n.id&&o.at===n.at&&!o.duration));assert.ok(chord);
 for(const n of s.notes.filter(n=>n.at===chord.at&&!n.duration))receive(pressRhythm(s,n.lane,n.at+40));
 assert.ok(f.lanes.filter(n=>n?.kind==='perfect'&&n.at===chord.at+40).length>=2);
 s=createRhythm();const h=s.notes.find(n=>n.duration);receive(pressRhythm(s,h.lane,h.at));receive(releaseRhythm(s,h.lane,h.at+100));assert.equal(f.earlyRelease,1);
 f.samples=Array(12).fill(60);assert.equal(f.summary(10).suggested,70);
 f.samples=[-120,-110,-100,-70,-50,10,70,80,90,110,120,140];assert.equal(f.summary().suggested,null);
 f.samples=[70,70];assert.equal(f.summary().suggested,null);
});
test('runner local practice returns to a real prior state and remains a valid replay',()=>{
 const options={seed:17,difficulty:'standard'},coach=new RunnerPractice();let s=createRunner(options);
 while(s.phase!=='finished'){s=stepRunner(s,[]);coach.capture(s);}
 const cp=coach.checkpoint(s.tick);assert.ok(cp);assert.ok(cp.state.tick<s.tick);assert.ok(s.tick-cp.state.tick<=195);
 s=structuredClone(cp.state);const inputs=[{tick:s.tick,actions:['left']}];s=stepRunner(s,['left']);
 for(let i=0;i<30;i++)s=stepRunner(s,[]);
 assert.deepEqual(replayRunner(sealRunner(options,inputs,s)),s);
 assert.match(runnerMistake({reason:{kind:'barrier'},time:10,jump:-1,roll:0},9),/跳早/);
 assert.match(runnerMistake({reason:{kind:'barrier'},time:10,jump:.05,roll:0}),/跳晚/);
});
test('expert pong can use skills from delayed ball observations; practice never does',()=>{
 let expertUsed=false;
 for(const difficulty of ['easy','hard']){let s=initPong(17),brain=createPongOpponent();
  for(let i=0;i<5000&&s.winner===null;i++){
   const duplicate=structuredClone(brain),hidden={...s,armed:[s.armed[0]==='spin'?'power':'spin',s.armed[1]]};
   const a=pongOpponentAction(s,brain,{difficulty,policy:'rule'});
   assert.deepEqual(pongOpponentAction(hidden,duplicate,{difficulty,policy:'rule'}),a);
   if(typeof a==='object'){assert.equal(difficulty,'hard');assert.ok(brain.observedTick<=s.tick-10);expertUsed=true;}
   s=stepPong(s,[motor(s,0,'steady'),a]);
  }
 }
 assert.ok(expertUsed);
});
