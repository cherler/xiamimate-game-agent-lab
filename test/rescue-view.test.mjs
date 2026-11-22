import test from 'node:test';
import assert from 'node:assert/strict';
import {rescuePoint} from '../web/rescue-board.mjs';
import {rescueToCanvas,rescueTransform} from '../web/rescue-view.mjs';
import {screenDelta} from '../web/screen-coordinates.mjs';

test('the same room is selectable in tall, wide and page-rotated rescue views',()=>{
 const canvas=(width,height,rect,turned=false)=>({clientWidth:width,clientHeight:height,getBoundingClientRect:()=>rect,closest:()=>turned?{}:null});
 // World (18,4): three quarters across a wide map; three quarters down a tall one.
 for(const [c,p] of [
  [canvas(600,400,{left:100,top:20,width:600,height:400}),{clientX:550,clientY:120}],
  [canvas(400,600,{left:10,top:90,width:400,height:600}),{clientX:310,clientY:540}],
  [canvas(600,400,{left:10,top:100,width:400,height:600},true),{clientX:310,clientY:550}],
  [canvas(1200,800,{left:-200,top:-100,width:800,height:1200},true),{clientX:400,clientY:800}]
 ])assert.deepEqual(rescuePoint(c,p),{x:18,y:4});
});
test('portrait and landscape projection preserve circular units and map corners',()=>{
 for(const [w,h] of [[600,400],[400,600],[900,600],[600,900]]){
  const [a,b,c,d,e,f]=rescueTransform(w,h);
  assert.equal(Math.hypot(a,b),Math.hypot(c,d));
  for(const p of [{x:0,y:0},{x:24,y:0},{x:0,y:16},{x:24,y:16},{x:8,y:7}]){
   const q=rescueToCanvas(p,w,h);assert.equal(q.x,a*p.x+c*p.y+e);assert.equal(q.y,b*p.x+d*p.y+f);
   assert.ok(q.x>=0&&q.x<=w&&q.y>=0&&q.y<=h);
  }
 }
});
test('dragging the rotated map follows the finger in both axes',()=>{
 assert.deepEqual(screenDelta(0,-40,true),{x:-40,y:-0});
 assert.deepEqual(screenDelta(30,0,true),{x:0,y:-30});
 assert.deepEqual(screenDelta(30,-40,false),{x:30,y:-40});
});
