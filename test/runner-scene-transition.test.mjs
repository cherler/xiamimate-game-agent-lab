import test from 'node:test';
import assert from 'node:assert/strict';
import {runnerRoadSections,runnerWorld} from '../web/runner-world.mjs';
import {runnerProjection} from '../web/runner-view.mjs';

test('scene roads cover the visible range once, without camera-relative tiles or gaps',()=>{
 for(const z of [0,.1,143.9,144,351.99,352.01,391.99,392.01,399.99,400,400.01,402,800,1200,1600,2000,2400,2402]){
  const sections=runnerRoadSections(z).toReversed();assert.ok(sections.length<=2);assert.equal(sections[0].near,z-2);assert.equal(sections.at(-1).far,z+256);
  for(let i=0;i<sections.length;i++){
   const s=sections[i];assert.ok(s.far>s.near);assert.ok(s.worldZ>=Math.max(0,s.near)&&s.worldZ<s.far);
   if(i){assert.equal(s.near,sections[i-1].far);assert.equal(s.near%400,0);}
   for(const start of ['station','snow'])assert.equal(runnerWorld(s.near,start).zone.id,runnerWorld(s.worldZ,start).zone.id);
  }
 }
});

test('all six colour boundaries stay at their world position, including the old 8-metre snap points',()=>{
 for(let boundary=400;boundary<=2400;boundary+=400)for(const distance of [248,128,48,16,8,0]){
  const ys=[];
  for(const epsilon of [-.001,.001]){
   const z=boundary-distance+epsilon,sections=runnerRoadSections(z),old=sections.find(s=>s.far===boundary),next=sections.find(s=>s.near===boundary);
   assert.ok(old&&next);assert.equal(old.far,next.near);const project=runnerProjection({z,speed:52},390,560);ys.push(project(0,next.near).y);
  }
  assert.ok(Math.abs(ys[1]-ys[0])<.05,'a tiny movement cannot jump the painted colour edge');
 }
});

test('colour change reaches the same ground position as the player, and clears behind them',()=>{
 for(let z=400;z<=2400;z+=400){const project=runnerProjection({z,speed:52},390,560),next=runnerRoadSections(z).find(s=>s.near===z);assert.equal(project(0,next.near).y,project(0,z).y);assert.equal(runnerRoadSections(z+2).length,1);}
});
