import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createKart,stepKart,replayKart} from '../src/kart.mjs';
import {initChess,stepChess,chessPlan,board,bench} from '../src/chess.mjs';
import {runBattle,combatUnits} from '../src/chess-battle.mjs';
import {replayStrategy,beginStrategy,sealStrategy,advanceStrategy} from '../src/strategy.mjs';
import {GUARD_SKILLS,chessSkillText} from '../src/chess-catalog.mjs';

test('recorded pre-audit races and chess rounds retain their exact original results',()=>{
 const fixture=name=>JSON.parse(fs.readFileSync(new URL('fixtures/'+name,import.meta.url)));
 const race=replayKart(fixture('kart-2-before-recovery.json'));assert.equal(race.version,2);assert.equal(race.cars[0].speed,0);
 const chess=replayStrategy(fixture('chess-glimmer4-before-audit.json'));assert.equal(chess.version,3);assert.equal(chess.round,5);
});
test('a stopped car can steer back from either verge on both tracks without a free speed boost',()=>{
 for(const track of ['harbor','ridge'])for(const side of [-1,1]){
  let s=createKart({track});s.countdown=0;s.phase='racing';s.cars[0].x=side*1.32;
  for(let i=0;i<180;i++)s=stepKart(s,{gas:true,steer:-side});
  assert.ok(Math.abs(s.cars[0].x)<1,track+' '+side);assert.ok(s.cars[0].speed>0);assert.ok(s.cars[0].speed<200);
 }
});
test('guard shields keep their own amount, protect neighbours, and match displayed numbers',()=>{
 for(const type of ['C14','C17']){
  const unit=(uid,type,cell,items=[])=>({uid,type,cell,star:1,items});
  const units=[unit('c1',type,35,['orb','orb','orb']),unit('c2','C07',36)];
  const enemy=[unit('c3',type,27,['orb','orb','orb']),unit('c4','C07',28)];
  const battle=runBattle({version:4,seed:20261124,round:4,players:[{units},{units:enemy}]});
  const cast=battle.frames.find(f=>f.events.some(e=>e.kind==='cast'&&e.source==='c1'));
  assert.ok(cast);assert.equal(cast.units.find(u=>u.uid==='c1').shield,GUARD_SKILLS[type].self);
  assert.equal(cast.units.find(u=>u.uid==='c2').shield,100);assert.match(chessSkillText(type),new RegExp(String(GUARD_SKILLS[type].self)));
 }
 const u={uid:'c1',type:'C14',cell:35,star:1,items:['blade']};
 assert.equal(combatUnits({players:[{units:[u]}]})[0].attack,58);
});
test('a full low-health AI bench can make room for an upgrade while conserving the shared pool',()=>{
 let s=initChess(20261124),p=s.players[1];s.round=22;p.hp=12;p.gold=80;p.level=6;s.uid=114;
 p.units=Array.from({length:14},(_,i)=>({uid:'c'+(100+i),type:'C'+String(i+1).padStart(2,'0'),star:1,cell:i<6?32+i:null,items:[]}));
 for(const u of p.units)s.pool[u.type]--;
 for(const type of p.shop)if(type)s.pool[type]++;
 p.shop=['C23','C24','C17','C23','C18'];for(const type of p.shop)s.pool[type]--;
 const count=s=>Object.values(s.pool).reduce((a,b)=>a+b,0)+s.players.reduce((n,p)=>n+p.shop.filter(Boolean).length+p.units.reduce((n,u)=>n+3**(u.star-1),0),0),total=count(s);
 const actions=chessPlan(s,1,'economy');assert.ok(actions.some(a=>a.type==='sell'));assert.ok(actions.some(a=>a.type==='buy'));
 for(const a of actions){s=stepChess(s,1,a);assert.equal(count(s),total);assert.ok(bench(s.players[1]).length<=8);assert.ok(board(s.players[1]).length<=s.players[1].level);}
 assert.ok(s.players[1].gold<80);assert.ok(s.players[1].units.some(u=>u.type==='C23'||u.type==='C24'));
});
test('new chess rounds export the new rules while old formats remain selectable',()=>{
 const m=beginStrategy('chess',83);assert.equal(m.record.format,'glimmer-5');
 for(let actor=0;actor<8;actor++)for(const a of chessPlan(m.state,actor))advanceStrategy(m,actor,a);
 advanceStrategy(m,-1,{type:'advance'});assert.deepEqual(replayStrategy(sealStrategy(m)),m.state);
 assert.equal(beginStrategy('chess',83,null,'glimmer-4').state.version,3);
});
