import {TRACKS,SEGMENT,curveAt} from '../src/kart.mjs';
const colors=['#f4b953','#ee846f','#85bdd9','#90c9aa'];
// Only interpolate what is drawn. Physics, collisions and recordings keep their fixed steps.
export function kartRenderState(previous,current,alpha=1){
 if(!previous||previous.track!==current.track||current.tick!==previous.tick+1||current.phase==='finished')return current;
 const t=Math.max(0,Math.min(1,alpha));if(t===1)return current;
 const mix=(a,b)=>a+(b-a)*t;
 return {...current,time:mix(previous.time,current.time),cars:current.cars.map((car,i)=>{
  const before=previous.cars[i];if(!before||before.id!==car.id)return car;
  return {...car,z:mix(before.z,car.z),x:mix(before.x,car.x),speed:mix(before.speed,car.speed),slip:mix(before.slip,car.slip)};
 })};
}
export function kartRoadPoints(state,w,h){
 const player=state.cars[0],track=TRACKS[state.track],base=Math.floor(player.z/SEGMENT),fraction=player.z/SEGMENT-base;
 const points=[],bend=curveAt(track,player.z)*.85;
 // Integrate curvature from the camera's actual position, including its partial segment.
 // The road and its tangent therefore agree on both sides of every segment boundary.
 let worldX=.5*fraction*fraction*bend,slope=-fraction*bend;
 for(let n=0;n<=95;n++){
  const index=((base+n)%track.segments.length+track.segments.length)%track.segments.length,dz=(n-fraction)*SEGMENT+44;
  const curve=track.segments[index].curve*.85,scale=w*.5/dz;
  points.push({n,index,dz,worldX,slope,curve,x:w/2+(worldX-player.x*26)*scale,y:h*.29+40*h*.8/dz,width:34*scale,scale});
  worldX+=slope+curve*.5;slope+=curve;
 }
 return points;
}
export function projectKartOpponent(car,player,points,w,h){
 const dz=car.z-player.z+44;if(dz<=0)return null;
 const segment=points[Math.max(0,Math.min(points.length-1,Math.floor((dz-points[0].dz)/SEGMENT)))];
 const t=(dz-segment.dz)/SEGMENT,worldX=segment.worldX+segment.slope*t+segment.curve*t*t*.5,scale=w*.5/dz;
 return {dz,scale,x:w/2+(worldX+(car.x-player.x)*26)*scale,y:h*.29+40*h*.8/dz};
}
function polygon(c,fill,points){c.fillStyle=fill;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
export function kartSprite(c,x,y,size,color,turn=0,boost=false,time=0){
 c.save();c.translate(x,y);c.rotate(turn*.1);c.scale(size/100,size/100);
 c.fillStyle='#20384940';c.beginPath();c.ellipse(0,12,52,12,0,0,7);c.fill();
 if(boost){for(const side of [-1,1]){polygon(c,'#89e9ff',[[side*22-9,4],[side*22+9,4],[side*22,36+Math.sin(time*30)*8]]);polygon(c,'#fff2ac',[[side*22-5,4],[side*22+5,4],[side*22,24]]);}}
 c.fillStyle='#283c4c';for(const side of [-1,1]){c.fillRect(side*37-9,-22,18,32);c.fillRect(side*29-8,-52,16,21);}
 polygon(c,color,[[-36,5],[-32,-34],[-23,-48],[23,-48],[32,-34],[36,5]]);
 c.fillStyle='#e7f3f3';c.fillRect(-27,-6,54,7);c.fillStyle='#345368';c.fillRect(-18,-40,36,19);
 c.fillStyle=color;c.beginPath();c.ellipse(0,-44,19,20,0,0,7);c.fill();c.fillStyle='#fff4d8';c.beginPath();c.ellipse(0,-42,14,12,0,0,7);c.fill();
 c.fillStyle='#294859';c.fillRect(-13,-45,26,8);c.fillStyle='#f8ffff';c.fillRect(-9,-44,9,2);
 c.fillStyle=color;c.fillRect(-40,-18,80,7);c.fillStyle='#fff4cf';c.fillRect(-32,-17,13,4);c.fillRect(19,-17,13,4);
 c.restore();
}
export function drawKart(canvas,state,{idle=false,reduced=false}={}){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,player=state.cars[0],track=TRACKS[state.track],ridge=state.track==='ridge',horizon=h*.29;
 c.fillStyle=ridge?'#d7e2f8':'#b9e3ef';c.fillRect(0,0,w,h);
 c.fillStyle='#fff8cf';c.beginPath();c.arc(w*.78,h*.14,h*.065,0,7);c.fill();
 for(let i=0;i<5;i++){const x=((i*.26+state.time*.002)*w)%(w*1.3)-w*.1;c.fillStyle='#ffffffa8';c.beginPath();c.ellipse(x,h*(.09+(i%2)*.08),w*.06,h*.018,0,0,7);c.fill();}
 polygon(c,ridge?'#99a4c6':'#77b6b8',[[0,horizon+40],[0,horizon-10],[w*.12,horizon-70],[w*.28,horizon-15],[w*.5,horizon-95],[w*.71,horizon-22],[w*.9,horizon-60],[w,horizon],[w,horizon+40]]);
 c.fillStyle=ridge?'#9ebba9':'#83cbd4';c.fillRect(0,horizon,w,h-horizon);
 const points=kartRoadPoints(state,w,h);
 for(let n=points.length-2;n>=0;n--){
  const a=points[n],b=points[n+1],alt=Math.floor(a.index/3)%2;
  polygon(c,alt?'#b0caa1':'#bad3a8',[[0,a.y],[w,a.y],[w,b.y],[0,b.y]]);
  polygon(c,alt?'#ec8d7a':'#fff1d3',[[a.x-a.width*1.13,a.y],[a.x+a.width*1.13,a.y],[b.x+b.width*1.13,b.y],[b.x-b.width*1.13,b.y]]);
  polygon(c,alt?'#667783':'#687b87',[[a.x-a.width,a.y],[a.x+a.width,a.y],[b.x+b.width,b.y],[b.x-b.width,b.y]]);
  for(const side of [-1,1])polygon(c,'#f3ead5',[[a.x+side*a.width*.92-a.width*.015,a.y],[a.x+side*a.width*.92+a.width*.015,a.y],[b.x+side*b.width*.92+b.width*.015,b.y],[b.x+side*b.width*.92-b.width*.015,b.y]]);
  if(alt)polygon(c,'#dbe6df80',[[a.x-a.width*.008,a.y],[a.x+a.width*.008,a.y],[b.x+b.width*.008,b.y],[b.x-b.width*.008,b.y]]);
  if(a.index<2){for(let k=0;k<10;k++)polygon(c,(a.index+k)%2?'#264355':'#f8f8e7',[[a.x-a.width+k*a.width*.2,a.y],[a.x-a.width+(k+1)*a.width*.2,a.y],[b.x-b.width+(k+1)*b.width*.2,b.y],[b.x-b.width+k*b.width*.2,b.y]]);}
  if(a.index%11===0&&a.y<h+100){const side=a.index%22?1:-1,x=a.x+side*a.width*1.6,size=a.scale*12;c.fillStyle='#788c79';c.fillRect(x-size*.09,a.y-size*.7,size*.18,size*.7);polygon(c,ridge?'#638c84':'#6aa394',[[x-size*.65,a.y-size*.5],[x,a.y-size*1.8],[x+size*.65,a.y-size*.5]]);}
 }
 // Opponents project onto the same curved road and are depth sorted.
 for(const other of state.cars.slice(1).map(car=>({car,dz:car.z-player.z})).filter(v=>v.dz>4&&v.dz<1700).sort((a,b)=>b.dz-a.dz)){
  const p=projectKartOpponent(other.car,player,points,w,h),x=p.x;
  kartSprite(c,x,p.y,Math.max(8,p.scale*7),colors[other.car.id],other.car.slip,other.car.boost>0,state.time);
  if(p.dz<600){c.font=`600 ${Math.max(10,Math.min(16,w*.016))}px system-ui`;c.textAlign='center';c.fillStyle='#244351';c.fillText(other.car.name,x,p.y-p.scale*6);}
 }
 const kartSize=Math.min(w*.2,h*.3,150),px=w*.5+player.slip*w*.025,py=h*.89;
 if(player.drifting&&!reduced){for(let i=0;i<8;i++){const t=(state.time*4+i*.17)%1;c.fillStyle=i%2?'#ffd681':'#ff9f76';c.fillRect(px+Math.sign(player.slip)*(kartSize*.4+t*kartSize*.3),py-8+t*kartSize*.17,4*(1-t)+1,4*(1-t)+1);}}
 kartSprite(c,px,py,kartSize,colors[0],player.slip,player.boost>0||player.mini>0,state.time);
 if(player.boost>0&&!reduced){c.strokeStyle='#edfaff70';c.lineWidth=2;for(let i=0;i<12;i++){const a=i/12*Math.PI*2;c.beginPath();c.moveTo(w/2+Math.cos(a)*w*.38,h/2+Math.sin(a)*h*.38);c.lineTo(w/2+Math.cos(a)*w*.6,h/2+Math.sin(a)*h*.6);c.stroke();}}
 if(!idle){const next=curveAt(track,player.z+220);if(Math.abs(next)>.35){c.save();c.translate(w/2,h*.14);c.fillStyle='#f9f8e9';c.fillRect(-34,-24,68,48);c.font='bold 34px system-ui';c.textAlign='center';c.fillStyle='#31566a';c.fillText(next>0?'↱':'↰',0,13);c.restore();}}
}
