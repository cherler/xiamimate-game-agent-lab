import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initPong,stepPong,LEFT,RIGHT,HALF,PONG_SKILLS} from '../src/pong.mjs';
import {begin,advance,seal,checkReplay,simulate} from '../src/arena.mjs';
import {createPongOpponent,pongOpponentInput,PONG_OPPONENTS} from '../src/pong-opponent.mjs';
const strike=(side=0)=>({...initPong(41003),serve:0,ball:[side===0?LEFT+2:RIGHT-2,300,side===0?-10:10,0]});
test('冲刺18帧加速、3秒冷却，不能连续触发或越出边界',()=>{
 let s=stepPong({...initPong(1),serve:0},[{target:0,skill:'dash'},300]);assert.equal(s.paddles[0],278);assert.equal(s.dash[0],18);assert.equal(s.cooldowns[0].dash,180);
 s=stepPong(s,[{target:0,skill:'dash'},300]);assert.equal(s.dash[0],17);assert.equal(s.cooldowns[0].dash,179);
 for(let i=0;i<20;i++)s=stepPong(s,[0,300]);assert.equal(s.dash[0],0);assert.equal(s.paddles[0],HALF);assert.equal(s.cooldowns[0].dash,159);
});
test('快球和旋球只在回击时生效，共享一拍槽位，冷却中的技巧不可重选',()=>{
 const normal=stepPong(strike(),[300,300]),power=stepPong(strike(),[{target:300,skill:'power'},300]);assert.ok(power.ball[2]>normal.ball[2]*1.3);assert.equal(power.lastHit.kind,'power');assert.equal(power.cooldowns[0].power,240);assert.equal(power.armed[0],null);
 const blocked=stepPong(power,[{target:300,skill:'power'},300]);assert.equal(blocked.armed[0],null);
 let s={...initPong(2),serve:0,ball:[400,300,-8,3]};s=stepPong(s,[{target:300,skill:'power'},300]);assert.equal(s.armed[0],'power');assert.equal(s.cooldowns[0].power,0);
 s=stepPong(s,[{target:300,skill:'spin'},300]);assert.equal(s.armed[0],'spin');s=stepPong(s,[{target:300,skill:'spin'},300]);assert.equal(s.armed[0],null);
});
test('旋球改变实际轨迹，滑拍方向控制弯曲方向，墙壁反弹后仍在球台内',()=>{
 const towardLow=stepPong(strike(),[{target:330,skill:'spin'},300]),towardHigh=stepPong(strike(),[{target:270,skill:'spin'},300]);assert.ok(towardLow.curve>0);assert.ok(towardHigh.curve<0);
 let s=stepPong(strike(),[{target:300,skill:'spin'},300]);const first=s.ball.slice();for(let i=0;i<24;i++)s=stepPong(s,[300,300]);assert.ok(Math.abs(s.ball[1]-(first[1]+first[3]*24))>50);assert.ok(s.flight.length<=12);
 const wall=stepPong({...s,ball:[500,10,10,-5],curve:-.2},[300,300]);assert.ok(wall.ball[1]>=9);assert.ok(wall.ball[3]>0&&wall.curve>0);
 const other=stepPong(strike(1),[300,{target:300,skill:'spin'}]);assert.equal(other.lastHit.side,1);assert.notEqual(other.curve,0);
 const flick=stepPong({...strike(),tick:50,paddles:[310,300],swipe:[{dir:1,tick:40},{dir:0,tick:-100}]},[{target:310,skill:'spin'},300]);assert.ok(flick.curve>0,'接球前轻扫的方向应保留200ms');
});
test('得分清理本回合蓄势，发球阶段不浪费技巧',()=>{
 const idle=stepPong(initPong(1),[{target:300,skill:'dash'},{target:300,skill:'spin'}]);assert.equal(idle.dash[0],0);assert.equal(idle.armed[1],null);
 const s=stepPong({...strike(),ball:[-8,80,-16,0],armed:['spin','power'],curve:.2},[300,300]);assert.equal(s.score[1],1);assert.deepEqual(s.armed,[null,null]);assert.deepEqual(s.flight,[]);assert.equal(s.curve,0);
});
test('旧两代录像保持原样，新技巧录像可重现且拒绝降级、非法输入',()=>{
 for(const file of ['pong-round2.2.json','pong-round2.3.json']){const r=JSON.parse(fs.readFileSync(new URL('fixtures/'+file,import.meta.url)));checkReplay(r);}
 const m=begin('pong',19);for(let i=0;i<240;i++)advance(m,[i===73?{target:300,skill:'spin'}:i===90?{target:550,skill:'dash'}:300,300]);const r=seal(m);assert.deepEqual(checkReplay(r),m.state);assert.throws(()=>checkReplay({...r,rules:'round2.3'}));
 const before=JSON.stringify(m.state);for(const move of [{target:300,skill:'hack'},{target:Infinity,skill:'power'},{target:300,skill:'power',extra:1}])assert.throws(()=>stepPong(m.state,[move,300]));assert.equal(JSON.stringify(m.state),before);
 const input={target:400,skill:'spin'},n=begin('pong',2);advance(n,[input,300]);input.target=0;assert.equal(n.record.frames[0][1][0].target,400);
});
test('规则对手不能响应尚未观察到的回击或技能选择',()=>{
 for(const difficulty of Object.keys(PONG_OPPONENTS)){
  const a=createPongOpponent(),b=createPongOpponent(),delay=PONG_OPPONENTS[difficulty].delay;
  for(let tick=0;tick<60;tick++){const s={...initPong(2),tick,serve:0,ball:[500,300,-8,0]};assert.equal(pongOpponentInput(s,a,{difficulty}),pongOpponentInput(s,b,{difficulty}));}
  for(let tick=60;tick<60+delay;tick++){
   const s={...initPong(2),tick,serve:0,ball:[600,300,10,9],armed:['spin',null]},changed={...s,ball:[600,300,10,-9],armed:['power',null]};assert.equal(pongOpponentInput(s,a,{difficulty}),pongOpponentInput(changed,b,{difficulty}));
  }
  assert.ok(a.observedTick<=a.lastTick-delay);assert.ok(b.observedTick<=b.lastTick-delay);
 }
});
test('对手只做短程判断，移动速度有限；固定守中确实不预判落点',()=>{
 const brain=createPongOpponent();let s={...initPong(2),serve:0,ball:[700,480,10,1]};
 for(let tick=0;tick<70;tick++){s={...s,tick};const target=pongOpponentInput(s,brain,{difficulty:'easy'});assert.ok(Math.abs(target-s.paddles[1])<=PONG_OPPONENTS.easy.speed);s.paddles[1]=target;}
 const fixed=createPongOpponent();for(let tick=0;tick<70;tick++)assert.equal(pongOpponentInput({...s,tick,paddles:[300,300]},fixed,{policy:'fixed'}),300);
 const result=simulate('pong',41003,['rule','rule'],{record:true});assert.ok(result.state.tick<=7200);checkReplay(result.record);
});
