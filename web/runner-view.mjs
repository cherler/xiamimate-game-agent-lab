import {runnerScene,jumpHeight,runnerRoute,RUNNER_ZONES} from '../src/runner.mjs';

const ink='#315765',shell='#ed9475',light='#ffc39a',mint='#6cbba5';
function poly(c,color,pts){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function oval(c,color,x,y,rx,ry){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function box(c,color,x,y,w,h,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function stroke(c,color,width,points){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function star(c,x,y,size,color){poly(c,color,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,r=i%2?size*.45:size;return [x+Math.cos(a)*r,y+Math.sin(a)*r];}));}
function blend(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');}

export function courierPortrait(){return `<svg class="runner-portrait" viewBox="0 0 116 104" role="img" aria-label="阿米：背着邮包的圆滚滚小虾"><ellipse cx="58" cy="97" rx="34" ry="5" fill="#244f6630"/><path d="M44 28Q25 0 18 13M69 28Q91 0 99 14" fill="none" stroke="#eea07d" stroke-width="4" stroke-linecap="round"/><path d="M83 66Q111 74 92 91Q78 96 75 83" fill="#ee9475" stroke="#bc7663" stroke-width="2"/><rect x="29" y="39" width="60" height="52" rx="28" fill="#ed9475"/><ellipse cx="58" cy="40" rx="33" ry="25" fill="#ffc39a"/><ellipse cx="45" cy="40" rx="4" ry="5" fill="#315765"/><ellipse cx="71" cy="40" rx="4" ry="5" fill="#315765"/><circle cx="44" cy="38" r="1.4" fill="white"/><circle cx="70" cy="38" r="1.4" fill="white"/><path d="M53 49q5 5 10 0" fill="none" stroke="#a56f5e" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="35" cy="49" rx="5" ry="3" fill="#ef9b86"/><ellipse cx="81" cy="49" rx="5" ry="3" fill="#ef9b86"/><path d="M29 60q29 13 58 0l-3 10q-27 11-51 0z" fill="#6cbba5"/><rect x="41" y="71" width="34" height="22" rx="5" fill="#efcf80"/><path d="m44 75 14 9 14-9" fill="none" stroke="#a88554" stroke-width="2"/><path d="M39 92v4h12M68 92v4h12" stroke="#315765" stroke-width="8" stroke-linecap="round"/></svg>`;}

export function drawCourier(c,x,y,size,s,{reduced=false}={}){
 c.save();c.translate(x,y);c.scale(size,size);oval(c,'#234c6535',0,1,32,7);
 if(s.board>0){oval(c,'#469b99',0,4,41,8);box(c,'#a0ead2',-34,0,68,5,3);star(c,0,2,5,'#fff0ae');}
 const jump=jumpHeight(s),wave=reduced||s.countdown>0?0:Math.sin(s.time*16),bob=jump>0?0:Math.abs(wave)*2.5;
 c.translate(0,-jump*33-bob);c.rotate(s.phase==='finished'?-.13:(s.lane-s.x)*.11);
 if(s.roll>0){
  oval(c,'#b97762',0,-24,30,25);oval(c,shell,-2,-26,28,24);c.strokeStyle=light;c.lineWidth=5;c.beginPath();c.arc(-3,-27,17,.1,Math.PI*1.8);c.stroke();
  box(c,mint,-21,-36,39,15,7);box(c,'#f2d48a',-8,-34,15,12,3);star(c,0,-28,4,ink);stroke(c,light,3,[[20,-40],[28,-45],[32,-43]]);c.restore();return;
 }
 // A curled tail and two short boots give a readable silhouette from behind.
 oval(c,'#c87961',25,-31,15,15);oval(c,shell,28,-34,11,10);stroke(c,light,3,[[29,-27],[36,-30],[35,-36]]);
 const step=jump>0?-5:wave*6;
 for(const side of [-1,1]){const footY=-3+side*step;box(c,ink,side*12-9,footY-10,18,14,7);box(c,'#fff2cf',side*12-10,footY,20,4,2);}
 oval(c,'#bc7965',0,-43,29,32);oval(c,shell,0,-46,27,31);
 for(const side of [-1,1])oval(c,light,side*(29+wave*side*2),-47+side*wave*5,8,11);
 oval(c,shell,0,-79,32,25);oval(c,light,-5,-85,24,16);
 stroke(c,'#d48569',4,[[-15,-98],[-26,-114-wave*2],[-35,-115-wave*2]]);stroke(c,'#d48569',4,[[15,-98],[27,-116+wave*2],[36,-116+wave*2]]);
 oval(c,light,-35,-115-wave*2,3,3);oval(c,light,36,-116+wave*2,3,3);stroke(c,'#d8856c',3,[[-24,-76],[-12,-71],[12,-71],[24,-77]]);
 box(c,'#417d77',-23,-69,46,39,12);box(c,mint,-21,-71,42,35,10);stroke(c,'#b8e5c6',3,[[-17,-65],[17,-65]]);box(c,'#f4d895',-11,-57,23,17,4);stroke(c,'#b8955c',2,[[-8,-53],[0,-47],[9,-53]]);box(c,'#e7bb77',-4,-70,8,8,2);
 if(s.magnet>0){c.strokeStyle='#b0f3d9';c.lineWidth=2.5;c.beginPath();c.arc(0,-57,47,0,Math.PI*2);c.stroke();}c.restore();
}
export function runnerRenderState(previous,current,alpha=1){
 if(!previous||current.tick!==previous.tick+1||previous.version!==current.version||current.phase==='finished')return current;
 const t=Math.max(0,Math.min(1,alpha)),mix=(a,b)=>a+(b-a)*t;return {...current,z:mix(previous.z,current.z),x:mix(previous.x,current.x),time:mix(previous.time,current.time),jump:previous.jump>=0&&current.jump>=0?mix(previous.jump,current.jump):current.jump};
}
export function runnerProjection(state,w,h){
 const horizon=h*.23,focal=Math.min(w*1.3,h*1.65),center=z=>8*Math.sin(z/190)+2*Math.sin(z/85),slope=8/190*Math.cos(state.z/190)+2/85*Math.cos(state.z/85),base=center(state.z);
 return (worldX,z,height=0)=>{const dz=z-state.z,depth=dz+17,scale=focal/depth,bend=state.version===1?0:center(z)-base-dz*slope;return {x:w/2+(worldX+bend)*scale,y:horizon+h*11.4/depth-height*scale,scale};};
}
function scenery(c,project,z,side,zone){
 const p=project(side*7.8,z),u=p.scale;if(u<=0)return;
 if(zone.id==='station'){
  const x=p.x,shade=side>0?'#aac3b9':'#b9cec0';box(c,shade,x-side*u*.3,p.y-u*6,side*u*4.2,u*6,0);
  for(let j=0;j<3;j++)box(c,'#edf4de',x+side*u*.5,p.y-u*(5-j*1.6),side*u*2.6,u*.8,0);
  const lamp=project(side*6.1,z+9),lu=lamp.scale;stroke(c,'#648d88',Math.max(1,lu*.1),[[lamp.x,lamp.y],[lamp.x,lamp.y-lu*4.5]]);oval(c,'#fff0ad',lamp.x,lamp.y-lu*4.5,lu*.3,lu*.3);
 }else if(zone.id==='market'){
  const x=p.x,ww=u*4.5,hh=u*3.2,xx=side<0?x-ww:x;box(c,'#d7be93',xx,p.y-hh,ww,hh,0);box(c,'#7c9b8a',xx+ww*.12,p.y-hh*.75,ww*.76,hh*.48,0);
  for(let i=0;i<5;i++)poly(c,i%2?'#f5e7bd':'#d89a79',[[xx+i*ww/5,p.y-hh-ww*.3],[xx+(i+1)*ww/5,p.y-hh-ww*.3],[xx+(i+1)*ww/5+side*ww*.12,p.y-hh*.8],[xx+i*ww/5+side*ww*.12,p.y-hh*.8]]);
  for(let i=0;i<3;i++)oval(c,['#c6d393','#e8ae7a','#deb477'][i],xx+ww*(.22+i*.25),p.y-hh*.3,u*.35,u*.27);
 }else{
  const x=p.x;stroke(c,'#d4d6b7',Math.max(1,u*.12),[[x,p.y],[x,p.y-u*2.1]]);oval(c,'#f2e3ba',x,p.y-u*2.1,u*.14,u*.14);
  if(Math.floor(z/28)%3===0){const boat=project(side*12,z+6);poly(c,'#e4dfbc',[[boat.x-u*1.8,boat.y-u*.5],[boat.x+u*1.8,boat.y-u*.5],[boat.x+u,boat.y+u*.2],[boat.x-u,boat.y+u*.2]]);stroke(c,'#6e9ca6',Math.max(1,u*.1),[[boat.x,boat.y-u*.5],[boat.x,boat.y-u*3]]);poly(c,'#eef2d8',[[boat.x,boat.y-u*3],[boat.x,boat.y-u*.7],[boat.x+u*1.8,boat.y-u*.7]]);}
 }
}
function obstacle(c,o,project,s){
 const p=project((o.lane-1)*3.4,o.z),u=p.scale,x=p.x,y=p.y,zone=RUNNER_ZONES.find(z=>z.id===o.zone)||RUNNER_ZONES[0];if(s.cleared.includes(o.id))return;
 if(o.kind==='train'){
  const back=project((o.lane-1)*3.4,o.z+12),width=2.7*u,height=5*u;poly(c,zone.vehicle,[[x-width/2,y-height],[x+width/2,y-height],[back.x+1.35*back.scale,back.y-5*back.scale],[back.x-1.35*back.scale,back.y-5*back.scale]]);
  poly(c,'#7393a2',[[x+width/2,y],[x+width/2,y-height],[back.x+1.35*back.scale,back.y-5*back.scale],[back.x+1.35*back.scale,back.y]]);box(c,'#f0edda',x-width/2,y-height,width,height,u*.25);box(c,zone.vehicle,x-width/2,y-height*.46,width,height*.32,0);
  box(c,ink,x-width*.38,y-height*.82,width*.76,height*.28,u*.1);box(c,'#b6dde2',x-width*.3,y-height*.78,width*.23,height*.2,u*.04);for(const sign of [-1,1])oval(c,'#ffe3a2',x+sign*width*.28,y-height*.18,u*.18,u*.13);box(c,ink,x-width*.36,y-u*.14,width*.72,u*.14,0);
 }else if(o.kind==='barrier'){
  for(const side of [-1,1])box(c,'#638a85',x+side*u-u*.08,y-u*1.4,u*.16,u*1.4,0);box(c,'#e7a076',x-u*1.3,y-u*1.55,u*2.6,u*.95,u*.1);
  for(const side of [-1,1])poly(c,'#fff1c7',[[x+side*u*.85-u*.17,y-u*1.5],[x+side*u*.85+u*.17,y-u*1.5],[x+side*u*.85-u*.15,y-u*.65],[x+side*u*.85-u*.49,y-u*.65]]);
  c.fillStyle=ink;c.textAlign='center';c.font=`bold ${u*.85}px system-ui`;c.fillText('↑',x,y-u*.83);
 }else if(o.kind==='arch'){
  for(const side of [-1,1])box(c,'#679a91',x+side*u*1.25-u*.1,y-u*3.1,u*.2,u*3.1,0);box(c,'#85b7a3',x-u*1.42,y-u*3.1,u*2.84,u*1.4,u*.12);box(c,'#e3e8bb',x-u*1.42,y-u*1.78,u*2.84,u*.18,0);
  c.fillStyle='#fff6d6';c.textAlign='center';c.font=`bold ${u*1.3}px system-ui`;c.fillText('↓',x,y-u*2.02);
 }else{const a=project((o.lane-1)*3.4,o.z-1.6),b=project((o.lane-1)*3.4,o.z+1.6);poly(c,'#386578',[[a.x-1.35*a.scale,a.y],[a.x+1.35*a.scale,a.y],[b.x+1.35*b.scale,b.y],[b.x-1.35*b.scale,b.y]]);stroke(c,'#efce80',Math.max(2,u*.13),[[a.x-1.35*a.scale,a.y],[a.x+1.35*a.scale,a.y]]);}
}

export function drawRunner(canvas,s,{reduced=false,effects=[],now=0}={}){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,route=runnerRoute(s.version===1?0:s.z),zone=route.zone,blendTo=Math.max(0,1-route.remaining/60),project=runnerProjection(s,w,h),horizon=h*.23;
 c.fillStyle=blend(zone.sky,route.next.sky,blendTo);c.fillRect(0,0,w,h);oval(c,'#fff0bf',w*.78,h*.12,h*.055,h*.055);
 for(let i=0;i<7;i++){const x=i*w/6,hh=h*(.055+(i*7%5)*.02);box(c,blend('#abc9c8','#c1cdb9',blendTo),x,horizon-hh,w*.08,hh+3,0);}
 c.fillStyle=blend(zone.ground,route.next.ground,blendTo);c.fillRect(0,horizon,w,h-horizon);
 for(let z=s.z+260;z>s.z;z-=10){
  const a=project(0,Math.max(s.z,z-10)),b=project(0,z),theme=RUNNER_ZONES[s.version===1?0:Math.floor(z/400)%3];poly(c,theme.edge,[[a.x-5.65*a.scale,a.y],[a.x+5.65*a.scale,a.y],[b.x+5.65*b.scale,b.y],[b.x-5.65*b.scale,b.y]]);poly(c,theme.road,[[a.x-5.1*a.scale,a.y],[a.x+5.1*a.scale,a.y],[b.x+5.1*b.scale,b.y],[b.x-5.1*b.scale,b.y]]);
  for(const lane of [-1,1])poly(c,theme.id==='river'?'#d7cdb0':'#e6e6cb',[[a.x+lane*1.7*a.scale-a.scale*.035,a.y],[a.x+lane*1.7*a.scale+a.scale*.035,a.y],[b.x+lane*1.7*b.scale+b.scale*.035,b.y],[b.x+lane*1.7*b.scale-b.scale*.035,b.y]]);
  if(theme.id==='station')for(let lane=-1;lane<=1;lane++)for(const offset of [-1.05,1.05])poly(c,'#526c79',[[a.x+(lane*3.4+offset-.05)*a.scale,a.y],[a.x+(lane*3.4+offset+.05)*a.scale,a.y],[b.x+(lane*3.4+offset+.05)*b.scale,b.y],[b.x+(lane*3.4+offset-.05)*b.scale,b.y]]);
 }
 for(let z=Math.floor((s.z+260)/5)*5;z>s.z;z-=5){const p=project(0,z),theme=RUNNER_ZONES[s.version===1?0:Math.floor(z/400)%3];stroke(c,theme.id==='river'?'#9e9f87':theme.id==='market'?'#cabfa1':'#acb5a8',Math.max(1,p.scale*.08),[[p.x-5*p.scale,p.y],[p.x+5*p.scale,p.y]]);}
 for(let row=Math.floor((s.z+260)/28);row>=Math.floor(s.z/28);row--){const z=row*28,theme=RUNNER_ZONES[s.version===1?0:Math.floor(z/400)%3];for(const side of [-1,1])scenery(c,project,z,side,theme);}
 if(s.version!==1){const edge=(Math.floor(s.z/400)+1)*400;if(edge-s.z<240){const p=project(0,edge),theme=runnerRoute(edge).zone;stroke(c,theme.color,Math.max(1,p.scale*.15),[[p.x-5.4*p.scale,p.y],[p.x-5.4*p.scale,p.y-6*p.scale],[p.x+5.4*p.scale,p.y-6*p.scale],[p.x+5.4*p.scale,p.y]]);box(c,theme.color,p.x-3.8*p.scale,p.y-6.4*p.scale,7.6*p.scale,1.3*p.scale,p.scale*.15);c.fillStyle='#fff3cf';c.font=`700 ${Math.max(7,p.scale*.7)}px system-ui`;c.textAlign='center';c.fillText(theme.name,p.x,p.y-5.48*p.scale);}}
 const objects=runnerScene(s).flatMap(row=>[...row.obstacles.map(o=>({...o,object:'obstacle'})),...row.coins.map(o=>({...o,object:'coin'})),...(row.item?[{...row.item,object:'item'}]:[])]).filter(o=>o.z>s.z-(o.kind==='train'?14:4)&&o.z<s.z+250).sort((a,b)=>b.z-a.z);
 for(const o of objects){const p=project((o.lane-1)*3.4,o.z),u=p.scale;if(u<=0)continue;if(o.object==='obstacle'){obstacle(c,o,project,s);continue;}if(o.z<s.z)continue;
  if(o.object==='coin'){const y=p.y-u*(.85+(o.height||0)*1.2);if(o.bonus){star(c,p.x,y,Math.max(3,u*.48),'#edb356');star(c,p.x,y,Math.max(2,u*.26),'#fff0b0');}else{oval(c,'#bd9552',p.x,y,Math.max(2,u*.25),Math.max(3,u*.35));oval(c,'#f6d581',p.x-u*.035,y-u*.025,Math.max(1,u*.19),Math.max(2,u*.28));}}
  else{oval(c,o.kind==='magnet'?'#83c7b3':'#8aabc5',p.x,p.y-u*1.3,Math.max(7,u*.65),Math.max(7,u*.65));c.fillStyle='#fff5c9';c.font=`bold ${Math.max(10,u*.9)}px system-ui`;c.textAlign='center';c.fillText(o.kind==='magnet'?'∩':'▰',p.x,p.y-u*1.02);}
 }
 const hero=project((s.x-1)*3.4,s.z+1.2),bodySize=Math.min(w/430,h/370),py=h*.91;drawCourier(c,hero.x,py,bodySize,s,{reduced});
 for(const e of effects){const t=(now-e.at)/600;if(t<0||t>1)continue;c.save();c.globalAlpha=1-t;const x=hero.x+(e.lane-s.x)*bodySize*18,y=py-bodySize*(90+t*45);star(c,x,y,bodySize*(e.value===2?8:5),'#f4c66f');c.fillStyle=ink;c.font=`bold ${Math.max(13,bodySize*14)}px system-ui`;c.textAlign='center';c.fillText('+'+e.value,x+bodySize*14,y+bodySize*4);c.restore();}
 if(s.invincible>0&&!reduced){c.strokeStyle='#d6f9c8';c.lineWidth=3;c.beginPath();c.arc(hero.x,py-53*bodySize,53*bodySize,0,Math.PI*2);c.stroke();}
}
