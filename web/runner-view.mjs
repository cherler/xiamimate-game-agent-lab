import {runnerScene,jumpHeight} from '../src/runner.mjs';
import {runnerImpact} from './runner-feedback.mjs';
import {poly,oval,box,stroke,star,blend,clamp} from './runner-paint.mjs';
import {runnerWorld,runnerRoadSections,worldBackdrop,worldScenery} from './runner-world.mjs';
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
 const horizon=h*.2,focal=Math.min(w*1.3,h*1.65)*1.09;
 // One fixed vanishing point for the road AND obstacle volumes. Speed never widens or bends the lanes.
 return (worldX,z,height=0)=>{const depth=Math.max(3,z-state.z+17),scale=focal/depth;return {x:w/2+worldX*scale,y:horizon+h*11.9/depth-height*scale,scale};};
}
function floorQuad(c,project,x1,x2,z1,z2,color){const a=project(x1,z1),b=project(x2,z1),d=project(x2,z2),e=project(x1,z2);poly(c,color,[[a.x,a.y],[b.x,b.y],[d.x,d.y],[e.x,e.y]]);}
export function runnerFootprint(o,version=3){const x=(o.lane-1)*3.4,before=o.kind==='train'?(version===1?4:2):1.6,after=o.kind==='train'?(version===1?4:12):1.6;return {left:x-3.4*.43,right:x+3.4*.43,near:o.z-before,far:o.z+after};}
export function runnerLaneHazards(s,objects=runnerScene(s).flatMap(row=>row.obstacles)){
 return [0,1,2].map(lane=>{
  const o=objects.filter(o=>o.lane===lane&&(!o.object||o.object==='obstacle')&&!s.cleared.includes(o.id)&&runnerFootprint(o,s.version).far>=s.z).sort((a,b)=>a.z-b.z)[0];
  if(!o||runnerFootprint(o,s.version).near-s.z>Math.max(52,s.speed*1.65))return null;
  const bounds=runnerFootprint(o,s.version),alongside=s.z>=bounds.near,safe=o.kind==='arch'?s.roll>0:o.kind==='barrier'?jumpHeight(s)>.9:o.kind==='gap'?jumpHeight(s)>.65:false;
  return {obstacle:o,bounds,alongside,safe};
 });
}
export function runnerVehicleGeometry(o,project,version=3){
 const x=(o.lane-1)*3.4,near=runnerFootprint(o,version).near+.6,far=runnerFootprint(o,version).far,half=1.3,height=3.4,point=(side,z,h)=>project(x+side*half,z,h);
 const front=[point(-1,near,0),point(1,near,0),point(1,near,height),point(-1,near,height)],back=[point(-1,far,0),point(1,far,0),point(1,far,height),point(-1,far,height)];
 return {front,back,roof:[front[3],front[2],back[2],back[3]],side:o.lane<1?1:o.lane>1?-1:0};
}
function obstacle(c,o,project,s,zone){
 const p=project((o.lane-1)*3.4,o.z),u=p.scale,x=p.x,y=p.y;
 if(o.kind==='train'){
  const frontPoint=project((o.lane-1)*3.4,runnerFootprint(o,s.version).near+.6),u=frontPoint.scale,x=frontPoint.x,y=frontPoint.y;
  const width=2.65*u,height=3.4*u,rock=['forest','canyon'].includes(zone.id),cargo=zone.id==='river';
  if(rock){
   const f=runnerFootprint(o,s.version),xx=(o.lane-1)*3.4,section=[[-1.3,0],[-1.3,2.1],[-.73,3.4],[.6,3.2],[1.3,1.94],[1.3,0]],front=section.map(([dx,h])=>project(xx+dx,f.near+.6,h)),back=section.map(([dx,h])=>project(xx+dx,f.far,h));
   for(let i=0;i<5;i++)if(i>0&&i<4||i===0&&o.lane===2||i===4&&o.lane===0)poly(c,i===2?(zone.id==='forest'?'#9ea88a':'#cf9a72'):zone.vehicle,[front[i],front[i+1],back[i+1],back[i]].map(p=>[p.x,p.y]));
   const base=zone.vehicle;poly(c,base,[[x-width*.48,y],[x-width*.5,y-height*.62],[x-width*.28,y-height],[x+width*.23,y-height*.94],[x+width*.5,y-height*.57],[x+width*.48,y]]);
   poly(c,zone.id==='forest'?'#9ea88a':'#cf9a72',[[x-width*.28,y-height],[x+width*.23,y-height*.94],[x+width*.1,y-height*.55],[x-width*.5,y-height*.62]]);stroke(c,'#4f665c',Math.max(1,u*.08),[[x+width*.1,y-height*.55],[x+width*.17,y-height*.2]]);
   if(zone.id==='forest'){oval(c,'#75935e',x-width*.15,y-height*.93,u*.75,u*.17);oval(c,'#75935e',x+width*.32,y-height*.32,u*.22,u*.55);}
  }else{
   const g=runnerVehicleGeometry(o,project,s.version),face=(color,points)=>poly(c,color,points.map(p=>[p.x,p.y])),xx=(o.lane-1)*3.4,frontZ=runnerFootprint(o,s.version).near+.6;
   const frontRect=(color,l,r,low,high)=>face(color,[[l,low],[r,low],[r,high],[l,high]].map(([dx,h])=>project(xx+dx,frontZ,h)));
   face(zone.id==='station'?'#f4d798':zone.vehicle,g.roof);
   stroke(c,zone.id==='station'?'#9e754b':'#4f727b',Math.max(1,u*.055),[...g.roof,g.roof[0]].map(p=>[p.x,p.y]));
   // Roof panels stay visible after the nose passes: the remaining carriage must not look like empty road.
   for(let z=frontZ+2;z<runnerFootprint(o,s.version).far-1.5;z+=3){
    const a=project(xx-1.2,z,3.41),b=project(xx+1.2,z,3.41);stroke(c,zone.id==='station'?'#cba46a':'#8ba4aa',Math.max(1,u*.035),[[a.x,a.y],[b.x,b.y]]);
    if(!cargo){face('#657a7b',[[-.53,z+.2],[.53,z+.2],[.53,z+1.4],[-.53,z+1.4]].map(([dx,zz])=>project(xx+dx,zz,3.43)));const a=project(xx-.46,z+.8,3.44),b=project(xx+.46,z+.8,3.44);stroke(c,'#a8b9b5',Math.max(1,u*.04),[[a.x,a.y],[b.x,b.y]]);}
   }
   if(g.side){const i=g.side>0?1:0,j=g.side>0?2:3;face(zone.id==='station'?'#ad7549':'#63818b',[g.front[i],g.back[i],g.back[j],g.front[j]]);
    for(let z=o.z+1;z<runnerFootprint(o,s.version).far-2;z+=3)face('#31525c',[[z,1.65],[z+1.9,1.65],[z+1.9,2.65],[z,2.65]].map(([zz,hh])=>project(xx+g.side*1.305,zz,hh)));
   }
   face(cargo?'#b99060':zone.id==='station'?'#e5ae5f':'#efe9cf',g.front);frontRect(zone.id==='station'?'#c37a4c':zone.vehicle,-1.3,1.3,.5,1.1);
   if(cargo){for(const side of [-1,1]){const a=project(xx-side,frontZ,.4),b=project(xx+side,frontZ,3);stroke(c,'#e7c88d',u*.15,[[a.x,a.y],[b.x,b.y]]);}}
   else{frontRect('#294651',-1.04,1.04,1.65,2.85);frontRect('#a6c9cf',-.92,-.12,1.8,2.68);frontRect('#a6c9cf',.12,.92,1.8,2.68);for(const sign of [-1,1]){const lamp=project(xx+sign*.85,frontZ,.7);oval(c,'#fff0be',lamp.x,lamp.y,u*.18,u*.13);}frontRect('#293e49',-1.05,1.05,.05,.3);}
   stroke(c,'#344650',Math.max(1,u*.07),[...g.front,g.front[0]].map(p=>[p.x,p.y]));
   if(zone.id==='snow')frontRect('#edf5ec',-1.3,1.3,3.2,3.4);
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
 for(const hazard of runnerLaneHazards(s,objects)){
  if(!hazard)continue;const {obstacle:o,bounds,alongside,safe}=hazard,lane=o.lane,p=project((lane-1)*3.4,alongside?s.z:bounds.near-2.2),u=p.scale,urgent=(alongside||Math.abs(s.x-lane)<.43&&o.z-s.z<s.speed*.65)&&!safe,color=urgent?'#c9634e':o.kind==='arch'?'#347e79':'#a8793e';
  const z=alongside?s.z:bounds.near,a=project(bounds.left,z),b=project(bounds.right,z);stroke(c,color,Math.max(2*dpr,u*.13),[[a.x,a.y],[b.x,b.y]]);
  // Grounded signs belong to the obstacle's track, never to a neighbouring lane behind its roof.
  const r=clamp(u*.46,6*dpr,13*dpr),y=p.y;
  oval(c,'#f7f0cf',p.x,y,r+1.5*dpr,r+1.5*dpr);oval(c,color,p.x,y,r,r);c.fillStyle='#fff6db';c.font=`800 ${r*1.45}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(alongside&&o.kind==='train'?'×':o.kind==='train'?'↔':o.kind==='arch'?'↓':'↑',p.x,y);c.textBaseline='alphabetic';
 }
}
export function drawRunner(canvas,s,{reduced=false,effects=[],impact=null,landedAt=-Infinity,turnAt=-Infinity,turnDirection=0,now=0}={}){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,dpr=w/(canvas.clientWidth||w),route=runnerWorld(s.version===1?0:s.z,s.scenery,s.version),zone=route.zone,blendTo=Math.max(0,1-route.remaining/60),project=runnerProjection(s,w,h),horizon=h*.2,hit=runnerImpact(impact,now,reduced),worldAt=z=>runnerWorld(Math.max(0,z),s.scenery,s.version).zone;
 c.fillStyle=blend(zone.sky,route.next.sky,blendTo);c.fillRect(0,0,w,h);c.save();if(hit?.shake)c.translate(hit.shake*w/700,-hit.shake*h/1000);oval(c,'#fff0bf',w*.78,h*.12,h*.055,h*.055);worldBackdrop(c,w,h,zone);
 c.fillStyle=blend(zone.ground,route.next.ground,blendTo);c.fillRect(0,horizon,w,h-horizon);
 // Scenic props are painted before the road, so canopies and stalls cannot cover a lane.
 for(let row=Math.floor((s.z+240)/32);row>=Math.floor(s.z/32);row--){const z=row*32;for(const side of [-1,1])worldScenery(c,project,z,side,worldAt(z));}
 const roadSections=runnerRoadSections(s.z);
 for(const {near,far:z,worldZ} of roadSections){
  const theme=worldAt(worldZ),station=theme.id==='station';
  if(station)for(const side of [-1,1]){const l=side<0?-8:5.3,r=side<0?-5.3:8;floorQuad(c,project,l,r,near,z,'#8b9c97');floorQuad(c,project,side*5.5-.12,side*5.5+.12,near,z,'#c9b98e');}
  floorQuad(c,project,-5.3,5.3,near,z,station?'#263e4b':theme.edge);
  for(let lane=0;lane<3;lane++){
   const x=(lane-1)*3.4;floorQuad(c,project,x-1.5,x+1.5,near,z,theme.lanes[lane]);
   for(const side of [-1,1]){const edge=x+side*1.51;floorQuad(c,project,edge-.045,edge+.045,near,z,station?'#a8babc':'#eee7bd');}
  }
 }
 for(let z=Math.floor((s.z+200)/8)*8;z>s.z-1;z-=8){
  const theme=worldAt(z);for(let lane=0;lane<3;lane++){const x=(lane-1)*3.4,p=project(x,z),q=p.scale;c.save();c.globalAlpha=theme.id==='station'?.65:theme.id==='river'?.28:.13;stroke(c,theme.id==='station'?'#283f4b':'#f9e8c2',Math.max(1,q*(theme.id==='station'?.21:.045)),[[p.x-q*1.2,p.y],[p.x+q*1.2,p.y]]);c.restore();}
 }
 // Each station lane has its own pair of rails; sleepers stop at that track's edge.
 for(const {near,far:z,worldZ} of roadSections)if(worldAt(worldZ).id==='station')for(let lane=0;lane<3;lane++)for(const side of [-1,1]){const x=(lane-1)*3.4+side*.88;floorQuad(c,project,x-.065,x+.065,near,z,'#253b46');floorQuad(c,project,x-.023,x+.035,near,z,'#b2c5c8');}
 const objects=runnerScene(s).flatMap(row=>[...row.obstacles.map(o=>({...o,object:'obstacle'})),...row.coins.map(o=>({...o,object:'coin'})),...(row.item?[{...row.item,object:'item'}]:[])]).filter(o=>o.z>s.z-(o.kind==='train'?14:4)&&o.z<s.z+230).sort((a,b)=>b.z-a.z);
 for(const o of objects)if(o.object==='obstacle'&&o.kind!=='gap'&&!s.cleared.includes(o.id)&&o.z<s.z+100){const f=runnerFootprint(o,s.version);if(f.far<s.z-2)continue;c.save();c.globalAlpha=.2;floorQuad(c,project,f.left,f.right,Math.max(s.z-2,f.near),f.far,o.kind==='arch'?'#82c4aa':'#e1a96b');c.restore();}
 for(const o of objects){const p=project((o.lane-1)*3.4,o.z),u=p.scale;if(o.object==='obstacle'){
   if(s.cleared.includes(o.id))continue;
   obstacle(c,o,project,s,worldAt(o.z));
   if(o.z>s.z-2&&o.z<s.z+70){const a=project((o.lane-1)*3.4,o.z);stroke(c,'#395763',Math.max(1,u*.06),[[a.x-u*1.35,a.y],[a.x+u*1.35,a.y]]);}continue;
  }if(o.z<s.z)continue;
  if(o.object==='coin'){const y=p.y-u*(.85+(o.height||0)*1.2);if(o.bonus){star(c,p.x,y,Math.max(3,u*.48),'#edb356');star(c,p.x,y,Math.max(2,u*.26),'#fff0b0');}else{oval(c,'#bd9552',p.x,y,Math.max(2,u*.25),Math.max(3,u*.35));oval(c,'#f6d581',p.x-u*.035,y-u*.025,Math.max(1,u*.19),Math.max(2,u*.28));}}
  else{oval(c,o.kind==='magnet'?'#83c7b3':'#8aabc5',p.x,p.y-u*1.3,Math.max(7,u*.65),Math.max(7,u*.65));c.fillStyle='#fff5c9';c.font=`bold ${Math.max(10,u*.9)}px system-ui`;c.textAlign='center';c.fillText(o.kind==='magnet'?'∩':'▰',p.x,p.y-u*1.02);}
 }
 const hero=project((s.x-1)*3.4,s.z),bodySize=Math.min(w/520,h/460),py=hero.y;
 // The shadow, boots, and lane marker share the same ground projection as the collision plane.
 stroke(c,'#f5dda0',Math.max(2,dpr*2),[[hero.x-bodySize*25,py+bodySize*5],[hero.x+bodySize*25,py+bodySize*5]]);
 if(!reduced&&s.phase==='running')rushLines(c,w,h,s);
 c.save();if(hit?.fall){c.beginPath();c.rect(0,0,w,py);c.clip();}drawCourier(c,hero.x,py,bodySize,hit&&!hit.saved?{...s,roll:0,jump:-1}:s,{reduced,impact:hit,landedAt,turnAt,turnDirection});c.restore();impactBurst(c,hero,py,bodySize,hit,reduced);
 for(const e of effects){const t=(now-e.at)/600;if(t<0||t>1)continue;c.save();c.globalAlpha=1-t;const x=hero.x+(e.lane-s.x)*bodySize*18,y=py-bodySize*(142+t*45);star(c,x,y,bodySize*(e.value===2?8:5),'#f4c66f');c.fillStyle=ink;c.font=`bold ${Math.max(13,bodySize*14)}px system-ui`;c.textAlign='center';c.fillText('+'+e.value,x+bodySize*14,y+bodySize*4);c.restore();}
 if(s.invincible>0&&!reduced){c.strokeStyle='#d6f9c8';c.lineWidth=3;c.beginPath();c.arc(hero.x,py-65*bodySize,56*bodySize,0,Math.PI*2);c.stroke();}
 // Keep the final approach cue visible even when the courier overlaps a low obstacle.
 hazardGuides(c,project,s,objects,dpr);
 c.restore();if(hit?.flash){c.fillStyle=hit.saved?`rgba(133,223,195,${hit.flash})`:`rgba(235,148,104,${hit.flash})`;c.fillRect(0,0,w,h);}
}
