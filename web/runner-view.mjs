import {runnerScene,jumpHeight} from '../src/runner.mjs';
import {runnerImpact} from './runner-feedback.mjs';
import {poly,oval,box,stroke,star,blend,clamp} from './runner-paint.mjs';
import {runnerWorld,worldBackdrop,worldScenery} from './runner-world.mjs';
import {drawCourier} from './runner-courier.mjs';
export {drawCourier,courierPose} from './runner-courier.mjs';
const ink='#315765';
export function courierPortrait(){return `<svg class="runner-portrait" viewBox="0 0 116 104" role="img" aria-label="阿米：背着邮包的圆滚滚小虾"><ellipse cx="58" cy="97" rx="34" ry="5" fill="#244f6630"/><path d="M44 28Q25 0 18 13M69 28Q91 0 99 14" fill="none" stroke="#eea07d" stroke-width="4" stroke-linecap="round"/><path d="M83 66Q111 74 92 91Q78 96 75 83" fill="#ee9475" stroke="#bc7663" stroke-width="2"/><rect x="29" y="39" width="60" height="52" rx="28" fill="#ed9475"/><ellipse cx="58" cy="40" rx="33" ry="25" fill="#ffc39a"/><ellipse cx="45" cy="40" rx="4" ry="5" fill="#315765"/><ellipse cx="71" cy="40" rx="4" ry="5" fill="#315765"/><circle cx="44" cy="38" r="1.4" fill="white"/><circle cx="70" cy="38" r="1.4" fill="white"/><path d="M53 49q5 5 10 0" fill="none" stroke="#a56f5e" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="35" cy="49" rx="5" ry="3" fill="#ef9b86"/><ellipse cx="81" cy="49" rx="5" ry="3" fill="#ef9b86"/><path d="M29 60q29 13 58 0l-3 10q-27 11-51 0z" fill="#6cbba5"/><rect x="41" y="71" width="34" height="22" rx="5" fill="#efcf80"/><path d="m44 75 14 9 14-9" fill="none" stroke="#a88554" stroke-width="2"/><path d="M39 92v4h12M68 92v4h12" stroke="#315765" stroke-width="8" stroke-linecap="round"/></svg>`;}

export function runnerRenderState(previous,current,alpha=1){
 if(!previous||current.tick!==previous.tick+1||previous.version!==current.version||current.phase==='finished')return current;
 const t=Math.max(0,Math.min(1,alpha)),mix=(a,b)=>a+(b-a)*t;return {...current,z:mix(previous.z,current.z),x:mix(previous.x,current.x),time:mix(previous.time,current.time),jump:previous.jump>=0&&current.jump>=0?mix(previous.jump,current.jump):current.jump};
}
function rushLines(c,w,h,s){
 const intensity=Math.max(0,Math.min(1,(s.speed-18)/34));if(!intensity)return;
 c.save();c.lineCap='round';
 for(let i=0;i<12;i++){
  const side=i%2?1:-1,t=(s.z*.025+i*.237)%1,y=h*(.36+t*.62),x=w/2+side*w*(.32+t*.22+(i%3)*.018);
  c.globalAlpha=(.08+intensity*.18)*Math.sin(t*Math.PI);stroke(c,'#f8fff0',Math.max(1,w*.0015),[[x,y],[x+side*w*(.018+t*.025),y+h*(.025+t*.045)]]);
 }
 c.restore();
}
function impactBurst(c,hero,py,size,hit,reduced){
 if(!hit)return;const x=hero.x,y=py-size*(hit.obstacle==='barrier'?36:hit.fall?6:78),color=hit.saved?'#8be6cb':'#ffd690';
 c.save();
 if(hit.fall){c.globalAlpha=hit.fade*.65;for(const side of [-1,1])oval(c,'#dce1c3',x+side*size*(15+hit.t*15),py-size*3,size*(4+hit.t*8),size*3);c.restore();return;}
 if(hit.age<230&&!hit.fall){c.globalAlpha=1-hit.age/230;star(c,x,y,size*(25+hit.t*90),color);star(c,x,y,size*15,'#fff4c5');}
 const count=hit.saved?13:8;
 for(let i=0;i<count;i++){
  const angle=i/count*Math.PI*2,r=size*(reduced?38:15+hit.t*(hit.saved?100:75)),px=x+Math.cos(angle)*r,yy=y+Math.sin(angle)*r+(reduced?0:hit.t*hit.t*45*size);
  c.globalAlpha=hit.fade;if(hit.saved)poly(c,i%2?'#8be6cb':'#3e9f99',[[px,yy-size*5],[px+size*7,yy+size*3],[px-size*3,yy+size*5]]);else star(c,px,yy,size*(i%2?4:6),color);
 }
 c.restore();
}


export function runnerProjection(state,w,h){
 const horizon=h*.2,focal=Math.min(w*1.3,h*1.65)*(1.04+Math.min(state.speed,52)/52*.07),center=z=>8*Math.sin(z/190)+2*Math.sin(z/85),slope=8/190*Math.cos(state.z/190)+2/85*Math.cos(state.z/85),base=center(state.z);
 // Keep the three lanes fixed under the player; swiping moves the courier, not the camera.
 return (worldX,z,height=0)=>{const dz=z-state.z,depth=Math.max(3,dz+17),scale=focal/depth,bend=state.version===1?0:center(z)-base-dz*slope;return {x:w/2+(worldX+bend)*scale,y:horizon+h*11.9/depth-height*scale,scale};};
}
export function runnerOcclusion(s,o){
 if(!['train','arch'].includes(o.kind))return 1;
 const proximity=clamp((70-(o.z-s.z))/40),outsideLane=clamp((Math.abs(o.lane-s.x)-.43)/.42);
 return 1-.66*proximity*outsideLane;
}
function floorQuad(c,project,x1,x2,z1,z2,color){const a=project(x1,z1),b=project(x2,z1),d=project(x2,z2),e=project(x1,z2);poly(c,color,[[a.x,a.y],[b.x,b.y],[d.x,d.y],[e.x,e.y]]);}
const heightFor=o=>o.kind==='train'?4.1:o.kind==='arch'?3.1:o.kind==='barrier'?1.55:.1;
function obstacle(c,o,project,s,zone){
 const p=project((o.lane-1)*3.4,o.z),u=p.scale,x=p.x,y=p.y;
 if(o.kind==='train'){
  const back=project((o.lane-1)*3.4,o.z+12),width=2.65*u,height=4.1*u,rock=['forest','canyon'].includes(zone.id),cargo=zone.id==='river';
  if(rock){
   const base=zone.vehicle;poly(c,base,[[x-width*.48,y],[x-width*.5,y-height*.62],[x-width*.28,y-height],[x+width*.23,y-height*.94],[x+width*.5,y-height*.57],[x+width*.48,y]]);
   poly(c,zone.id==='forest'?'#9ea88a':'#cf9a72',[[x-width*.28,y-height],[x+width*.23,y-height*.94],[x+width*.1,y-height*.55],[x-width*.5,y-height*.62]]);stroke(c,'#4f665c',Math.max(1,u*.08),[[x+width*.1,y-height*.55],[x+width*.17,y-height*.2]]);
   if(zone.id==='forest'){oval(c,'#75935e',x-width*.15,y-height*.93,u*.75,u*.17);oval(c,'#75935e',x+width*.32,y-height*.32,u*.22,u*.55);}
  }else{
   poly(c,zone.vehicle,[[x-width/2,y-height],[x+width/2,y-height],[back.x+1.325*back.scale,back.y-4.1*back.scale],[back.x-1.325*back.scale,back.y-4.1*back.scale]]);
   poly(c,'#688997',[[x+width/2,y],[x+width/2,y-height],[back.x+1.325*back.scale,back.y-4.1*back.scale],[back.x+1.325*back.scale,back.y]]);box(c,cargo?'#b99060':'#efe9cf',x-width/2,y-height,width,height,u*.2);box(c,zone.vehicle,x-width/2,y-height*.46,width,height*.32);
   if(cargo){stroke(c,'#e7c88d',u*.15,[[x-width*.4,y-height*.88],[x+width*.4,y-height*.12]]);stroke(c,'#e7c88d',u*.15,[[x+width*.4,y-height*.88],[x-width*.4,y-height*.12]]);}
   else{box(c,ink,x-width*.38,y-height*.82,width*.76,height*.28,u*.1);box(c,'#b6dde2',x-width*.3,y-height*.78,width*.23,height*.2,u*.04);for(const sign of [-1,1])oval(c,'#ffe3a2',x+sign*width*.28,y-height*.18,u*.18,u*.13);box(c,ink,x-width*.36,y-u*.14,width*.72,u*.14);}
   if(zone.id==='snow'){box(c,'#edf5ec',x-width*.52,y-height-u*.12,width*1.04,u*.23,u*.1);poly(c,'#da9b57',[[x-width*.6,y],[x+width*.6,y],[x+width*.48,y-u*.6],[x-width*.48,y-u*.6]]);}
  }
 }else if(o.kind==='barrier'){
  for(const side of [-1,1])box(c,'#4c6c70',x+side*u-u*.08,y-u*1.4,u*.16,u*1.4);
  box(c,zone.id==='forest'?'#aa8058':zone.id==='snow'?'#c3d6d6':'#dc9870',x-u*1.3,y-u*1.55,u*2.6,u*.95,u*.1);
  for(const side of [-1,1])poly(c,'#fff1c7',[[x+side*u*.85-u*.17,y-u*1.5],[x+side*u*.85+u*.17,y-u*1.5],[x+side*u*.85-u*.15,y-u*.65],[x+side*u*.85-u*.49,y-u*.65]]);
  c.fillStyle=ink;c.textAlign='center';c.font=`bold ${u*.85}px system-ui`;c.fillText('↑',x,y-u*.83);
 }else if(o.kind==='arch'){
  for(const side of [-1,1])box(c,'#537e76',x+side*u*1.25-u*.1,y-u*3.1,u*.2,u*3.1);box(c,zone.id==='canyon'?'#bc8869':zone.id==='forest'?'#6d9869':'#72aa99',x-u*1.42,y-u*3.1,u*2.84,u*1.4,u*.12);box(c,'#e7e6b9',x-u*1.42,y-u*1.78,u*2.84,u*.18);
  c.fillStyle='#fff6d6';c.textAlign='center';c.font=`bold ${u*1.3}px system-ui`;c.fillText('↓',x,y-u*2.02);
 }else{
  floorQuad(c,project,(o.lane-1)*3.4-1.35,(o.lane-1)*3.4+1.35,o.z-1.6,o.z+1.6,'#244755');const a=project((o.lane-1)*3.4,o.z-1.6),b=project((o.lane-1)*3.4,o.z+1.6);stroke(c,'#f4cd7c',Math.max(2,u*.15),[[a.x-1.35*a.scale,a.y],[a.x+1.35*a.scale,a.y]]);stroke(c,'#a4b4a1',Math.max(1,u*.08),[[b.x-1.35*b.scale,b.y],[b.x+1.35*b.scale,b.y]]);
 }
}
function hazardGuides(c,project,s,objects,dpr){
 if(s.countdown||s.phase!=='running')return;
 for(let lane=0;lane<3;lane++){
  const o=objects.filter(o=>o.object==='obstacle'&&o.lane===lane&&o.z>s.z+2&&!s.cleared.includes(o.id)).sort((a,b)=>a.z-b.z)[0];
  if(!o||o.z-s.z>Math.max(52,s.speed*1.65))continue;
  const p=project((lane-1)*3.4,o.z),u=p.scale,safe=o.kind==='arch'?s.roll>0:['barrier','gap'].includes(o.kind)&&jumpHeight(s)>.9,urgent=Math.abs(s.x-lane)<.43&&o.z-s.z<s.speed*.65&&!safe,color=urgent?'#c9634e':o.kind==='arch'?'#347e79':'#a8793e';
  stroke(c,color,Math.max(2*dpr,u*.13),[[p.x-1.35*u,p.y],[p.x+1.35*u,p.y]]);
  const r=clamp(u*.6,9*dpr,15*dpr),y=p.y-heightFor(o)*u-r-3*dpr;
  oval(c,'#f7f0cf',p.x,y,r+1.5*dpr,r+1.5*dpr);oval(c,color,p.x,y,r,r);c.fillStyle='#fff6db';c.font=`800 ${r*1.45}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(o.kind==='train'?'↔':o.kind==='arch'?'↓':'↑',p.x,y);c.textBaseline='alphabetic';
 }
}
export function drawRunner(canvas,s,{reduced=false,effects=[],impact=null,landedAt=-Infinity,turnAt=-Infinity,turnDirection=0,now=0}={}){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,dpr=w/(canvas.clientWidth||w),route=runnerWorld(s.version===1?0:s.z,s.scenery,s.version),zone=route.zone,blendTo=Math.max(0,1-route.remaining/60),project=runnerProjection(s,w,h),horizon=h*.2,hit=runnerImpact(impact,now,reduced),worldAt=z=>runnerWorld(Math.max(0,z),s.scenery,s.version).zone;
 c.fillStyle=blend(zone.sky,route.next.sky,blendTo);c.fillRect(0,0,w,h);c.save();if(hit?.shake)c.translate(hit.shake*w/700,-hit.shake*h/1000);oval(c,'#fff0bf',w*.78,h*.12,h*.055,h*.055);worldBackdrop(c,w,h,zone);
 c.fillStyle=blend(zone.ground,route.next.ground,blendTo);c.fillRect(0,horizon,w,h-horizon);
 // Scenic props are painted before the road, so canopies and stalls cannot cover a lane.
 for(let row=Math.floor((s.z+240)/32);row>=Math.floor(s.z/32);row--){const z=row*32;for(const side of [-1,1])worldScenery(c,project,z,side,worldAt(z));}
 for(let z=s.z+256;z>s.z-2;z-=8){
  const near=Math.max(s.z-2,z-8),theme=worldAt(z);floorQuad(c,project,-5.65,5.65,near,z,theme.edge);
  for(let lane=0;lane<3;lane++)floorQuad(c,project,(lane-1)*3.4-1.7,(lane-1)*3.4+1.7,near,z,theme.lanes[lane]);
  for(const boundary of [-1.7,1.7]){floorQuad(c,project,boundary-.15,boundary+.15,near,z,'#365261');floorQuad(c,project,boundary-.07,boundary+.07,near,z,'#fff1c6');}
 }
 for(let z=Math.floor((s.z+200)/8)*8;z>s.z-1;z-=8){
  const theme=worldAt(z);for(let lane=0;lane<3;lane++){const p=project((lane-1)*3.4,z),q=p.scale;c.save();c.globalAlpha=theme.id==='river'?.28:.13;stroke(c,'#f9e8c2',Math.max(1,q*.045),[[p.x-q*1.4,p.y],[p.x+q*1.4,p.y]]);c.restore();}
 }
 const objects=runnerScene(s).flatMap(row=>[...row.obstacles.map(o=>({...o,object:'obstacle'})),...row.coins.map(o=>({...o,object:'coin'})),...(row.item?[{...row.item,object:'item'}]:[])]).filter(o=>o.z>s.z-(o.kind==='train'?14:4)&&o.z<s.z+230).sort((a,b)=>b.z-a.z);
 for(const o of objects){const p=project((o.lane-1)*3.4,o.z),u=p.scale;if(o.object==='obstacle'){
   if(s.cleared.includes(o.id))continue;
   c.save();c.globalAlpha=runnerOcclusion(s,o);obstacle(c,o,project,s,worldAt(o.z));c.restore();
   if(o.z>s.z-2&&o.z<s.z+70){const a=project((o.lane-1)*3.4,o.z);stroke(c,'#395763',Math.max(1,u*.06),[[a.x-u*1.35,a.y],[a.x+u*1.35,a.y]]);}continue;
  }if(o.z<s.z)continue;
  if(o.object==='coin'){const y=p.y-u*(.85+(o.height||0)*1.2);if(o.bonus){star(c,p.x,y,Math.max(3,u*.48),'#edb356');star(c,p.x,y,Math.max(2,u*.26),'#fff0b0');}else{oval(c,'#bd9552',p.x,y,Math.max(2,u*.25),Math.max(3,u*.35));oval(c,'#f6d581',p.x-u*.035,y-u*.025,Math.max(1,u*.19),Math.max(2,u*.28));}}
  else{oval(c,o.kind==='magnet'?'#83c7b3':'#8aabc5',p.x,p.y-u*1.3,Math.max(7,u*.65),Math.max(7,u*.65));c.fillStyle='#fff5c9';c.font=`bold ${Math.max(10,u*.9)}px system-ui`;c.textAlign='center';c.fillText(o.kind==='magnet'?'∩':'▰',p.x,p.y-u*1.02);}
 }
 hazardGuides(c,project,s,objects,dpr);
 const hero=project((s.x-1)*3.4,s.z),bodySize=Math.min(w/520,h/460),py=hero.y;
 // The shadow, boots, and lane marker share the same ground projection as the collision plane.
 stroke(c,'#f5dda0',Math.max(2,dpr*2),[[hero.x-bodySize*25,py+bodySize*5],[hero.x+bodySize*25,py+bodySize*5]]);
 if(!reduced&&s.phase==='running')rushLines(c,w,h,s);
 c.save();if(hit?.fall){c.beginPath();c.rect(0,0,w,py);c.clip();}drawCourier(c,hero.x,py,bodySize,hit&&!hit.saved?{...s,roll:0,jump:-1}:s,{reduced,impact:hit,landedAt,turnAt,turnDirection});c.restore();impactBurst(c,hero,py,bodySize,hit,reduced);
 for(const e of effects){const t=(now-e.at)/600;if(t<0||t>1)continue;c.save();c.globalAlpha=1-t;const x=hero.x+(e.lane-s.x)*bodySize*18,y=py-bodySize*(142+t*45);star(c,x,y,bodySize*(e.value===2?8:5),'#f4c66f');c.fillStyle=ink;c.font=`bold ${Math.max(13,bodySize*14)}px system-ui`;c.textAlign='center';c.fillText('+'+e.value,x+bodySize*14,y+bodySize*4);c.restore();}
 if(s.invincible>0&&!reduced){c.strokeStyle='#d6f9c8';c.lineWidth=3;c.beginPath();c.arc(hero.x,py-65*bodySize,56*bodySize,0,Math.PI*2);c.stroke();}
 c.restore();if(hit?.flash){c.fillStyle=hit.saved?`rgba(133,223,195,${hit.flash})`:`rgba(235,148,104,${hit.flash})`;c.fillRect(0,0,w,h);}
}
