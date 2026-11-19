import {runnerScene,jumpHeight} from '../src/runner.mjs';
function poly(c,color,pts){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function runner(c,x,y,size,s,reduced){
 c.save();c.translate(x,y);c.scale(size,size);const stride=reduced?0:Math.sin(s.time*16)*14;
 c.fillStyle='#1c38584d';c.beginPath();c.ellipse(0,0,27,7,0,0,7);c.fill();
 if(s.board>0){c.fillStyle='#6edbcf';c.beginPath();c.ellipse(0,2,37,7,0,0,7);c.fill();c.fillStyle='#fff2bf';c.fillRect(-25,0,50,3);}
 c.translate(0,-jumpHeight(s)*35);if(s.phase==='finished')c.rotate(-.3);
 if(s.roll>0){c.fillStyle='#e88c79';c.beginPath();c.ellipse(0,-23,25,24,0,0,7);c.fill();c.strokeStyle='#3e547d';c.lineWidth=12;c.beginPath();c.arc(0,-20,20,0,Math.PI);c.stroke();c.fillStyle='#f1c2a0';c.beginPath();c.arc(8,-35,12,0,7);c.fill();c.restore();return;}
 const limb=(pts,color,width)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.stroke();};
 limb([[-7,-42],[-12,-21+stride*.35],[-14-stride*.4,-2]],'#425b86',13);limb([[7,-42],[12,-21-stride*.35],[14+stride*.4,-2]],'#6988ad',13);
 limb([[-14-stride*.4,-2],[-23-stride*.4,-2]],'#fdf4d6',9);limb([[14+stride*.4,-2],[22+stride*.4,-2]],'#fdf4d6',9);
 limb([[0,-75],[0,-43]],'#e68d7a',30);limb([[-12,-72],[-26,-56+stride*.6],[-21,-44+stride]],'#edb498',10);limb([[12,-72],[26,-56-stride*.6],[21,-44-stride]],'#edb498',10);
 c.fillStyle='#f1c2a0';c.beginPath();c.arc(0,-96,19,0,7);c.fill();c.fillStyle='#376b74';c.beginPath();c.arc(0,-101,20,Math.PI,Math.PI*2);c.fill();c.fillRect(-22,-103,43,9);c.fillStyle='#a7dfc6';c.fillRect(-11,-103,10,7);c.fillStyle='#88c7bb';c.fillRect(-14,-76,28,9);c.fillStyle='#eacb87';c.beginPath();c.roundRect(-10,-66,20,24,6);c.fill();
 if(s.magnet>0){c.strokeStyle='#a5f0e4';c.lineWidth=2;c.beginPath();c.arc(0,-55,48,0,7);c.stroke();}
 c.restore();
}
export function drawRunner(canvas,s,{reduced=false}={}){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,horizon=h*.2,focal=Math.min(w*1.25,h*1.65),project=(worldX,z)=>{const d=z-s.z+17;return {x:w/2+worldX*focal/d,y:horizon+h*12.5/d,scale:focal/d};};
 c.fillStyle='#c7e8ec';c.fillRect(0,0,w,h);c.fillStyle='#fff0bf';c.beginPath();c.arc(w*.78,h*.11,h*.055,0,7);c.fill();
 for(let i=0;i<14;i++){const x=i*w/13,hh=h*(.08+(i*7%5)*.025);c.fillStyle=i%2?'#a5c7cc':'#b3d2d2';c.fillRect(x,horizon-hh,w*.065,hh+15);}
 c.fillStyle='#e6d7b4';c.fillRect(0,horizon,w,h-horizon);
 const close=project(0,s.z),far=project(0,s.z+300);
 poly(c,'#899ba2',[[w/2-6*close.scale,close.y],[w/2+6*close.scale,close.y],[w/2+6*far.scale,far.y],[w/2-6*far.scale,far.y]]);
 for(let lane=0;lane<3;lane++){const x=(lane-1)*3.4;for(const offset of [-1.05,1.05])poly(c,'#485c6b',[[project(x+offset-.07,s.z).x,close.y],[project(x+offset+.07,s.z).x,close.y],[project(x+offset+.07,s.z+300).x,far.y],[project(x+offset-.07,s.z+300).x,far.y]]);}
 for(let z=Math.floor((s.z+270)/5)*5;z>s.z-1;z-=5){const p=project(0,z);for(let lane=0;lane<3;lane++){const x=w/2+(lane-1)*3.4*p.scale;c.fillStyle='#c3b9a0';c.fillRect(x-1.4*p.scale,p.y,2.8*p.scale,Math.max(1,p.scale*.16));}}
 for(let row=Math.floor((s.z+260)/28);row>=Math.floor(s.z/28);row--){const z=row*28,p=project(0,z);for(const side of [-1,1]){const x=w/2+side*7.1*p.scale,buildingHeight=(5+row%4)*p.scale;c.fillStyle=row%2?'#a6b8b0':'#b8c7c0';c.fillRect(side<0?x-5*p.scale:x,p.y-buildingHeight,5*p.scale,buildingHeight);c.fillStyle='#eff5e5';for(let iy=0;iy<3;iy++)c.fillRect(x+side*p.scale,p.y-buildingHeight+(iy+.6)*1.7*p.scale,side*2*p.scale,Math.max(2,.7*p.scale));}}
 const objects=runnerScene(s).flatMap(row=>[...row.obstacles.map(o=>({...o,object:'obstacle'})),...row.coins.map(o=>({...o,object:'coin'})),...(row.item?[{...row.item,object:'item'}]:[])]).filter(o=>o.z>s.z-5&&o.z<s.z+250).sort((a,b)=>b.z-a.z);
 for(const o of objects){const p=project((o.lane-1)*3.4,o.z),size=p.scale,x=p.x,y=p.y;if(!Number.isFinite(size)||size<=0)continue;
  if(o.object==='coin'){if(o.z<s.z)continue;c.fillStyle='#f5ce6d';c.strokeStyle='#bd8b38';c.lineWidth=Math.max(1,size*.07);c.beginPath();c.ellipse(x,y-size*.8,Math.max(2,size*.24),Math.max(3,size*.36),0,0,7);c.fill();c.stroke();c.fillStyle='#fff1b3';c.fillRect(x-size*.04,y-size*1.02,Math.max(1,size*.08),size*.4);continue;}
  if(o.object==='item'){if(o.z<s.z)continue;c.fillStyle=o.kind==='magnet'?'#8ad6c5':'#b7c6ef';c.beginPath();c.arc(x,y-size*1.4,Math.max(7,size*.65),0,7);c.fill();c.fillStyle='#254e5e';c.font=`bold ${Math.max(9,size*.9)}px system-ui`;c.textAlign='center';c.fillText(o.kind==='magnet'?'∩':'▰',x,y-size*1.12);continue;}
  if(s.cleared.includes(o.id))continue;
  if(o.kind==='train'){
   const back=project((o.lane-1)*3.4,o.z+13),body=2.8*size,height=5.5*size;poly(c,'#638dae',[[x-body/2,y-height],[x+body/2,y-height],[back.x+1.4*back.scale,back.y-5.5*back.scale],[back.x-1.4*back.scale,back.y-5.5*back.scale]]);poly(c,'#567d9c',[[x+body/2,y],[x+body/2,y-height],[back.x+1.4*back.scale,back.y-5.5*back.scale],[back.x+1.4*back.scale,back.y]]);
   c.fillStyle='#f2eee0';c.beginPath();c.roundRect(x-body/2,y-height,body,height,Math.max(2,size*.28));c.fill();c.fillStyle='#447c9b';c.fillRect(x-body/2,y-height*.46,body,height*.33);c.fillStyle='#294b63';c.fillRect(x-body*.39,y-height*.82,body*.78,height*.3);c.fillStyle='#b5dfe5';c.fillRect(x-body*.31,y-height*.78,body*.19,height*.23);c.fillStyle='#ffe6aa';for(const sign of [-1,1])c.fillRect(x+sign*body*.31-size*.15,y-height*.21,size*.3,size*.21);c.fillStyle='#344b5a';c.fillRect(x-body*.39,y-size*.15,body*.78,size*.15);
  }else if(o.kind==='barrier'){
   c.fillStyle='#6f7f7f';for(const side of [-1,1])c.fillRect(x+side*size-size*.08,y-size*1.4,size*.16,size*1.4);c.fillStyle='#e89a7a';c.fillRect(x-size*1.25,y-size*1.5,size*2.5,size*.85);c.fillStyle='#fff3d0';for(let i=0;i<3;i++)poly(c,'#fff3d0',[[x-size*(1.2-i*.85),y-size*1.5],[x-size*(.8-i*.85),y-size*1.5],[x-size*(1.2-i*.85),y-size*.65],[x-size*(1.6-i*.85),y-size*.65]]);
  }else if(o.kind==='arch'){
   c.fillStyle='#657d87';for(const side of [-1,1])c.fillRect(x+side*size*1.25-size*.1,y-size*3.2,size*.2,size*3.2);c.fillStyle='#eaa37c';c.fillRect(x-size*1.4,y-size*3.2,size*2.8,size*1.6);c.fillStyle='#fff0cc';c.font=`bold ${size*1.5}px system-ui`;c.textAlign='center';c.fillText('↓',x,y-size*1.9);
  }else{const a=project((o.lane-1)*3.4,o.z-1.6),b=project((o.lane-1)*3.4,o.z+1.6);poly(c,'#263c4e',[[a.x-1.35*a.scale,a.y],[a.x+1.35*a.scale,a.y],[b.x+1.35*b.scale,b.y],[b.x-1.35*b.scale,b.y]]);c.strokeStyle='#f2d68d';c.lineWidth=Math.max(2,size*.13);c.beginPath();c.moveTo(a.x-1.35*a.scale,a.y);c.lineTo(a.x+1.35*a.scale,a.y);c.stroke();}
 }
 const bodySize=Math.min(w/450,h/390),px=w/2+(s.x-1)*3.4*focal/19,py=h*.9;runner(c,px,py,bodySize,s,reduced);
 if(s.invincible>0&&!reduced){c.strokeStyle='#b3f4e5';c.lineWidth=4;c.beginPath();c.arc(px,py-45*bodySize,55*bodySize,0,7);c.stroke();}
}
