import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunner,stepRunner,sealRunner,replayRunner} from '../src/runner.mjs';
import {runnerWorld,RUNNER_WORLDS} from '../web/runner-world.mjs';
import {courierPose,courierBodyPoint} from '../web/runner-courier.mjs';
import {runnerProjection,runnerVehicleGeometry,runnerLaneHazards} from '../web/runner-view.mjs';
const active=()=>({...createRunner({seed:17}),phase:'running',countdown:0,speed:34,time:2,z:35});
test('runner scenery: six distinct worlds can start a run and all six cycle without discontinuous distance',()=>{
 assert.equal(new Set(RUNNER_WORLDS.map(w=>w.id)).size,6);
 for(const start of RUNNER_WORLDS){const visits=new Set();for(let chapter=0;chapter<6;chapter++){const r=runnerWorld(chapter*400,start.id);visits.add(r.zone.id);assert.equal(r.progress,0);assert.equal(r.remaining,400);assert.equal(r.next.id,runnerWorld(chapter*400+400,start.id).zone.id);}assert.equal(visits.size,6);assert.equal(runnerWorld(2400,start.id).zone.id,start.id);}
 assert.equal(runnerWorld(0,'unknown').zone.id,'station');assert.equal(runnerWorld(1200,'snow',2).zone.id,'station');
});
test('runner camera: switching lanes cannot move lane boundaries; feet and obstacle ground share the same projection',()=>{
 for(const [w,h]of [[390,560],[1366,500],[320,300]]){const s=active(),a=runnerProjection(s,w,h),edges=[-1.7,1.7].map(x=>a(x,s.z));s.x=0;s.lane=0;const b=runnerProjection(s,w,h);assert.deepEqual(edges,[-1.7,1.7].map(x=>b(x,s.z)));const feet=b(-3.4,s.z),left=b(-5.1,s.z),right=b(-1.7,s.z);assert.ok(feet.x>left.x&&feet.x<right.x);assert.equal(feet.y,left.y);}
});
test('runner depth: left and right train faces mirror each other on a fixed perspective, even when speed changes',()=>{
 const s=active(),project=runnerProjection(s,390,560),left=runnerVehicleGeometry({kind:'train',lane:0,z:56},project),right=runnerVehicleGeometry({kind:'train',lane:2,z:56},project);
 assert.equal(left.side,1);assert.equal(right.side,-1);
 for(const [a,b]of [[0,1],[1,0],[2,3],[3,2]])for(const face of ['front','back']){assert.ok(Math.abs(left[face][a].x+right[face][b].x-390)<1e-8);assert.equal(left[face][a].y,right[face][b].y);}
 assert.deepEqual(project(-3.4,56),runnerProjection({...s,speed:52},390,560)(-3.4,56));
});
test('runner side collisions: passing the nose does not clear a carriage; the warning persists until the tail is past',()=>{
 const s={...active(),z:60,x:0,lane:0},warn=runnerLaneHazards(s)[1];assert.equal(warn.obstacle.kind,'train');assert.equal(warn.alongside,true);assert.equal(warn.bounds.far,68);
 let hit=s;for(let i=0;i<6&&hit.phase==='running';i++)hit=stepRunner(hit,i===0?['right']:[]);assert.equal(hit.phase,'finished');assert.equal(hit.reason.kind,'train');
 let clear={...s,z:68.1};assert.notEqual(runnerLaneHazards(clear)[1]?.obstacle.id,warn.obstacle.id);for(let i=0;i<6;i++)clear=stepRunner(clear,i===0?['right']:[]);assert.equal(clear.phase,'running');assert.equal(clear.x,1);
 assert.notEqual(runnerLaneHazards({...s,cleared:[warn.obstacle.id]})[1]?.obstacle.id,warn.obstacle.id);
});
test('runner posture: forward pitch moves the head and shoulders ahead of the hips without lifting stance feet',()=>{
 const s=active(),pose=courierPose(s),hip=courierBodyPoint({x:0,h:36+pose.bob,z:0},pose),head=courierBodyPoint({x:0,h:94+pose.bob,z:14},pose),shoulder=courierBodyPoint(pose.arms[0].shoulder,pose);
 assert.ok(pose.lean>.6&&pose.lean<.8);assert.ok(head.z>hip.z+40);assert.ok(shoulder.z>hip.z+25);assert.ok(head.h<94+pose.bob-15);assert.ok(pose.legs.filter(l=>l.stance).every(l=>l.foot.h===0));
 assert.equal(courierPose(s,{reduced:true}).lean,pose.lean);assert.ok(courierPose({...s,phase:'countdown',countdown:3}).lean<pose.lean);
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
