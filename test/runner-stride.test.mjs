import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunner,stepRunner,sealRunner,replayRunner} from '../src/runner.mjs';
import {runnerWorld,RUNNER_WORLDS} from '../web/runner-world.mjs';
import {courierPose} from '../web/runner-courier.mjs';
import {runnerProjection,runnerOcclusion} from '../web/runner-view.mjs';
const active=()=>({...createRunner({seed:17}),phase:'running',countdown:0,speed:34,time:2,z:35});
test('runner scenery: six distinct worlds can start a run and all six cycle without discontinuous distance',()=>{
 assert.equal(new Set(RUNNER_WORLDS.map(w=>w.id)).size,6);
 for(const start of RUNNER_WORLDS){const visits=new Set();for(let chapter=0;chapter<6;chapter++){const r=runnerWorld(chapter*400,start.id);visits.add(r.zone.id);assert.equal(r.progress,0);assert.equal(r.remaining,400);assert.equal(r.next.id,runnerWorld(chapter*400+400,start.id).zone.id);}assert.equal(visits.size,6);assert.equal(runnerWorld(2400,start.id).zone.id,start.id);}
 assert.equal(runnerWorld(0,'unknown').zone.id,'station');assert.equal(runnerWorld(1200,'snow',2).zone.id,'station');
});
test('runner camera: switching lanes cannot move lane boundaries; feet and obstacle ground share the same projection',()=>{
 for(const [w,h]of [[390,560],[1366,500],[320,300]]){const s=active(),a=runnerProjection(s,w,h),edges=[-1.7,1.7].map(x=>a(x,s.z));s.x=0;s.lane=0;const b=runnerProjection(s,w,h);assert.deepEqual(edges,[-1.7,1.7].map(x=>b(x,s.z)));const feet=b(-3.4,s.z),left=b(-5.1,s.z),right=b(-1.7,s.z);assert.ok(feet.x>left.x&&feet.x<right.x);assert.equal(feet.y,left.y);}
});
test('runner visibility: adjacent large objects fade smoothly, current-lane collisions stay opaque, small obstacles stay solid',()=>{
 const s=active(),train={kind:'train',lane:0,z:s.z+12};assert.ok(runnerOcclusion(s,train)<.4);assert.equal(runnerOcclusion(s,{...train,lane:1}),1);assert.equal(runnerOcclusion(s,{...train,z:s.z+100}),1);assert.equal(runnerOcclusion(s,{...train,kind:'barrier'}),1);
 let last=0;for(let x=1;x>=0;x-=.01){const alpha=runnerOcclusion({...s,x},train);assert.ok(alpha+1e-10>=last);assert.ok(alpha-last<.04||last===0);last=alpha;}assert.ok(last>.99);
});
test('runner gait: stance feet remain grounded, swing legs recover, arms counter the front foot, and the cycle is continuous',()=>{
 const s=active(),snapshot=structuredClone(s);let swings=0,flight=0;
 for(let i=0;i<200;i++){const pose=courierPose({...s,z:i/200*20});assert.ok(pose.legs.filter(l=>l.stance).length<=1);if(pose.legs.every(l=>!l.stance))flight++;for(const l of pose.legs){if(l.stance)assert.equal(l.foot.h,0);else{assert.ok(l.foot.h>0);swings++;}assert.ok(Math.hypot(l.hip.h-l.knee.h,l.hip.z-l.knee.z)<21.001);assert.ok(Math.hypot(l.foot.h-l.knee.h,l.foot.z-l.knee.z)<21.001);}}
 assert.ok(swings>100);assert.ok(flight>40,'running needs a brief flight phase between alternating contacts');const a=courierPose({...s,z:0}),b=courierPose({...s,z:20});assert.deepEqual(a,b);assert.ok(a.legs[0].foot.z>0&&a.arms[0].hand.z<0);assert.deepEqual(s,snapshot);
});
test('runner poses: jumping tucks both legs, landing absorbs weight, turning recovers, and reduced motion holds a stable gait',()=>{
 const s=active(),jump=courierPose({...s,jump:.39});assert.ok(jump.legs.every(l=>l.foot.h>20&&!l.stance));
 const land=courierPose(s,{landedAt:s.time}),base=courierPose(s);assert.ok(land.legs[0].hip.h<base.legs[0].hip.h-4);
 assert.ok(courierPose(s,{turnAt:s.time-.11,turnDirection:1}).turn>.1);assert.ok(Math.abs(courierPose(s,{turnAt:s.time-.4,turnDirection:1}).turn)<1e-8);
 assert.deepEqual(courierPose(s,{reduced:true}),courierPose({...s,z:87},{reduced:true}));
});
test('runner scenery is replay metadata, never a change to obstacle timing or collision outcome',()=>{
 let s=createRunner({seed:17});while(s.phase!=='finished')s=stepRunner(s);for(const scenery of RUNNER_WORLDS.map(w=>w.id)){const r=sealRunner({seed:17,scenery},[],s);assert.deepEqual(replayRunner(r),s);assert.equal(r.options.scenery,scenery);}
});
