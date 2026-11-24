import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createKart,kartAI,stepKart,sealKart,replayKart,KART_DT} from '../src/kart.mjs';

test('kart rivals: existing recordings keep their original opponent decisions and result',()=>{
 for(const name of ['kart-1-pre-smoothing','kart-1-before-rivals']){
  const record=JSON.parse(fs.readFileSync(new URL('./fixtures/'+name+'.json',import.meta.url),'utf8'));
  const state=replayKart(record);assert.equal(state.version,1);assert.equal(state.tick,record.end.tick);
 }
 assert.equal(createKart({version:1}).difficulty,'practice');
 assert.equal(createKart().difficulty,'standard');
});
test('kart rivals: nitro and corner exit boost are actually accelerated through',()=>{
 for(const extra of [{boost:1.2},{nitro:1},{mini:.4}]){
  const state=createKart();state.cars[1]={...state.cars[1],z:300,x:.13,speed:270,...extra};
  const action=kartAI(state,1);assert.equal(action.gas,true);assert.equal(action.brake,false);
 }
});
test('kart rivals: a driver has no rank-based catch-up speed or hidden player input',()=>{
 const s=createKart({difficulty:'expert'});s.cars[1]={...s.cars[1],z:1400,speed:230};
 const ahead=structuredClone(s),behind=structuredClone(s);ahead.cars[0].z=8000;behind.cars[0].z=0;
 assert.deepEqual(kartAI(ahead,1),kartAI(behind,1));
});
test('kart rivals: the same driver faces progressively stronger opponents on both circuits',()=>{
 for(const track of ['harbor','ridge'])for(const seed of [17,41003,8901]){
  const rows=[];
  for(const difficulty of ['practice','standard','expert']){
   let state=createKart({track,difficulty,seed});
   while(state.phase!=='finished'){
    // Keep the tested player's strategy fixed across opponent difficulties.
    const input=kartAI({...state,difficulty:'standard'},0),next=stepKart(state,input);
    for(const c of next.cars.slice(1)){
     assert.ok(c.speed<=335);assert.ok(c.z-state.cars[c.id].z<=335*KART_DT+1e-7,'no teleporting');
     assert.ok(Math.abs(c.x)<=1,'rules opponents stay on the road');
    }
    state=next;
   }
   rows.push(state);
  }
  assert.equal(rows[0].rank,1,track+' practice');
  assert.ok(rows[1].rank<=2,track+' standard remains competitive');
  assert.ok(rows[2].rank>=3,track+' challenge rewards better driving');
  assert.ok(rows[2].cars.slice(1).filter(c=>c.finishTime!==null).length>=2);
  assert.ok(rows[2].cars.slice(1).every(c=>c.drifts>=2));
 }
});
test('kart rivals: a complete new race can be exported and reproduced exactly',()=>{
 const options={track:'ridge',difficulty:'expert',seed:17};let state=createKart(options);const inputs=[];
 while(state.phase!=='finished'){const input=kartAI(state,0);inputs.push({tick:state.tick,input});state=stepKart(state,input);}
 const record=sealKart(options,inputs,state);assert.equal(record.format,'kart-3');assert.deepEqual(replayKart(record),state);
});
