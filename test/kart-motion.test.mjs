import test from 'node:test';
import assert from 'node:assert/strict';
import {createKart,stepKart,TRACKS,SEGMENT,KART_DT} from '../src/kart.mjs';
import {drawKart,kartRenderState,kartRoadPoints,projectKartOpponent} from '../web/kart-view.mjs';

function capture(){
 let labels=[];
 const context=new Proxy({fillText(name,x,y){if(['橘子','晴空','薄荷'].includes(name))labels.push({name,x,y});}},{get(target,key){return key in target?target[key]:(()=>{});}});
 const canvas={width:1366,height:510,getContext:()=>context};
 return state=>{labels=[];drawKart(canvas,state);return labels;};
}
test('kart rendering: a moving opponent advances every frame instead of snapping between road segments',()=>{
 const draw=capture();let s=createKart(),last=null,visible=0,maxJump=0;
 for(let tick=0;tick<720;tick++){
  s=stepKart(s,{});const p=draw(s).find(p=>p.name==='橘子');if(!p)continue;
  if(last){assert.ok(p.y<last.y,'an opponent driving away must move on screen each step');maxJump=Math.max(maxJump,last.y-p.y);}
  last=p;visible++;
 }
 assert.ok(visible>150);assert.ok(maxJump<6,'a near opponent must not teleport by a whole road segment');
});
test('kart rendering: both road and cars remain continuous when the camera crosses corners and lap boundaries',()=>{
 const epsilon=1e-5;
 for(const track of Object.values(TRACKS))for(let i=1;i<=track.segments.length*2;i++){
  const s=createKart({track:track.id});s.cars[0].z=i*SEGMENT-epsilon;s.cars[1].z=i*SEGMENT+150;
  const before=kartRoadPoints(s,1366,510),a=projectKartOpponent(s.cars[1],s.cars[0],before,1366,510);
  s.cars[0].z+=2*epsilon;
  const after=kartRoadPoints(s,1366,510),b=projectKartOpponent(s.cars[1],s.cars[0],after,1366,510);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.001,track.id+' opponent boundary '+i);
  for(const n of [1,5,20])assert.ok(Math.hypot(before[n].x-after[n-1].x,before[n].y-after[n-1].y)<.001,track.id+' road boundary '+i);
 }
});
test('kart rendering: opponent projection stays continuous when the opponent crosses a road subdivision',()=>{
 const s=createKart({track:'ridge'});s.cars[0].z=35.2*SEGMENT;
 const road=kartRoadPoints(s,1366,510);
 for(let n=36;n<90;n++){
  s.cars[1].z=n*SEGMENT-1e-5;const a=projectKartOpponent(s.cars[1],s.cars[0],road,1366,510);
  s.cars[1].z+=2e-5;const b=projectKartOpponent(s.cars[1],s.cars[0],road,1366,510);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.001);
 }
});
test('kart rendering: 60, 120 and 144 Hz screens interpolate movement without changing simulation or replay state',()=>{
 for(const hz of [60,120,144]){
  let s=createKart(),previous=s,balance=0,last=null,visible=0;const draw=capture();
  for(let frame=0;frame<9*hz;frame++){
   balance+=1/hz;while(balance>=KART_DT){previous=s;s=stepKart(s,{});balance-=KART_DT;}
   const original=structuredClone(s),old=structuredClone(previous),rendered=kartRenderState(previous,s,balance/KART_DT);
   const p=draw(rendered).find(p=>p.name==='橘子');
   assert.deepEqual(s,original);assert.deepEqual(previous,old);
   if(p){if(last)assert.ok(p.y<last.y,'opponent froze at '+hz+' Hz');last=p;visible++;}
  }
  assert.ok(visible>120);
 }
});
test('kart rendering: reset and finished races use the exact current snapshot',()=>{
 const s=createKart();let next=stepKart(s);
 assert.equal(kartRenderState(s,next,1),next);
 assert.equal(kartRenderState(next,createKart(),.5).tick,0);
 const finished={...next,phase:'finished'};assert.equal(kartRenderState(s,finished,.5),finished);
 const another=createKart({track:'ridge'});assert.equal(kartRenderState(s,another,.5),another);
});
