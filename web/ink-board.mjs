import {INK_RULES as R,INK_MAPS,groundAt} from '../src/ink.mjs';
export const INK_COLORS=['#13bdb2','#ff795b'];
const edges=['#057d81','#ba392e'];
export function inkView(width,height){const turn=height>width*1.15,ww=turn?R.height:R.width,hh=turn?R.width:R.height,scale=Math.min((width-12)/ww,(height-12)/hh);return {width,height,turn,scale,x:(width-ww*scale)/2,y:(height-hh*scale)/2};}
export function inkWorldPoint(view,x,y){x=(x-view.x)/view.scale;y=(y-view.y)/view.scale;return view.turn?{x:R.width-y,y:x}:{x,y};}
export function inkScreenVector(view,x,y){return view.turn?{x:-y,y:x}:{x,y};}
export function createInkRenderer(canvas){
 const c=canvas.getContext('2d'),floor=document.createElement('canvas');floor.width=R.width;floor.height=R.height;const f=floor.getContext('2d');let oldPaint=[],oldMap='',view;
 const circle=(ctx,x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
 function draw(s,previous,alpha=1,aim=null){
  const width=canvas.clientWidth||900,height=canvas.clientHeight||540,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.fillStyle='#142d3a';c.fillRect(0,0,width,height);view=inkView(width,height);
  if(oldMap!==s.map){oldPaint=[];oldMap=s.map;f.fillStyle='#dce5df';f.fillRect(0,0,R.width,R.height);}
  for(let i=0;i<s.paint.length;i++){const v=s.paint[i];if(oldPaint[i]===v)continue;const x=i%75*12,y=Math.floor(i/75)*12;f.fillStyle=v<0?'#bacbc6':v?INK_COLORS[v-1]:(Math.floor(x/36)+Math.floor(y/36))%2?'#dae3dd':'#e2e9e3';f.fillRect(x,y,12,12);if(v>0){f.fillStyle='#ffffff0b';f.fillRect(x+1,y+1,10,2);}oldPaint[i]=v;}
  c.save();c.translate(view.x,view.y);c.scale(view.scale,view.scale);if(view.turn){c.translate(0,R.width);c.rotate(-Math.PI/2);}c.drawImage(floor,0,0);
  c.strokeStyle='#213d4933';c.lineWidth=1;for(let x=0;x<=R.width;x+=36){c.beginPath();c.moveTo(x,0);c.lineTo(x,R.height);c.stroke();}for(let y=0;y<=R.height;y+=36){c.beginPath();c.moveTo(0,y);c.lineTo(R.width,y);c.stroke();}
  // Broad lanes and protected launch markings remain visible beneath the ink.
  for(let team=0;team<2;team++){const x=team?828:72;c.strokeStyle=edges[team];c.lineWidth=3;c.setLineDash([7,7]);c.strokeRect(x-34,184,68,176);c.setLineDash([]);c.fillStyle=edges[team];c.globalAlpha=.28;for(let y=196;y<350;y+=14)c.fillRect(x-26,y,52,3);c.globalAlpha=1;}
  for(const [x,y,w,h] of INK_MAPS[s.map].walls){c.fillStyle='#18344266';c.fillRect(x+5,y+7,w,h);c.fillStyle='#607c83';c.fillRect(x,y,w,h);c.fillStyle='#91a6a7';c.fillRect(x+3,y+3,w-6,h-10);c.fillStyle='#b8c7bf';c.fillRect(x+7,y+7,w-14,4);c.strokeStyle='#3c5d68';c.lineWidth=2;c.strokeRect(x+9,y+13,w-18,h-25);c.fillStyle='#d6bf78';for(let i=8;i<w-8;i+=20)c.fillRect(x+i,y+h-9,10,4);}
  const me=s.players[0];if(!me.respawn){const angle=aim??me.angle,dx=Math.cos(angle),dy=Math.sin(angle);c.strokeStyle=me.ink<4?'#ffdf99':'#ffffff99';c.lineWidth=2;c.setLineDash([3,7]);c.beginPath();c.moveTo(me.x+dx*23,me.y+dy*23);c.lineTo(me.x+dx*85,me.y+dy*85);c.stroke();c.setLineDash([]);}
  for(const b of s.shots){c.strokeStyle=edges[b.team];c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(b.x-b.vx*.012,b.y-b.vy*.012);c.lineTo(b.x,b.y);c.stroke();circle(c,b.x,b.y,4.4,INK_COLORS[b.team]);circle(c,b.x-1,b.y-1,1.8,'#fff3da');}
  for(const p of s.players){if(p.respawn)continue;const prior=previous?.players[p.id],lerp=prior&&!prior.respawn&&Math.hypot(p.x-prior.x,p.y-prior.y)<40;const x=lerp?prior.x+(p.x-prior.x)*alpha:p.x,y=lerp?prior.y+(p.y-prior.y)*alpha:p.y;const a=p.id===0&&aim!==null?aim:p.angle;
   c.save();c.translate(x,y);if(p.shield){c.strokeStyle='#fffbd0';c.lineWidth=2;c.beginPath();c.arc(0,0,22,0,Math.PI*2);c.stroke();}
   if(p.swimming){if(p.team===1&&Math.hypot(p.x-me.x,p.y-me.y)>85)c.globalAlpha=.22;c.strokeStyle=edges[p.team];c.lineWidth=2;for(let j=0;j<2;j++){c.beginPath();c.ellipse(0,0,13+j*5,7+j*4,a,0,Math.PI*2);c.stroke();}circle(c,Math.cos(a)*4,Math.sin(a)*4,4,'#faffee');}
   else{circle(c,2,4,15,'#17364355');c.rotate(a);c.fillStyle='#173944';c.fillRect(5,-5,23,10);c.fillStyle=INK_COLORS[p.team];c.fillRect(13,-3,16,6);circle(c,0,0,14,edges[p.team]);circle(c,-1,-1,11.5,INK_COLORS[p.team]);circle(c,-3,-4,4,'#ffffff55');c.fillStyle='#fff5d7';c.fillRect(3,-8,5,16);c.rotate(-a);}
   if(p.id===0){c.strokeStyle='#fff9d5';c.lineWidth=3;c.beginPath();c.arc(0,0,18,0,Math.PI*2);c.stroke();c.save();if(view.turn)c.rotate(Math.PI/2);c.fillStyle='#153945';c.beginPath();c.moveTo(-6,-30);c.lineTo(6,-30);c.lineTo(0,-22);c.closePath();c.fill();c.restore();}
   if(p.hp<100){c.save();if(view.turn)c.rotate(Math.PI/2);c.fillStyle='#173743';c.fillRect(-15,21,30,4);c.fillStyle=p.hp<35?'#ffe0a6':'#fffbdc';c.fillRect(-15,21,30*p.hp/100,4);c.restore();}c.restore();
  }
  for(const e of s.events){const age=(s.tick-e.tick)*R.dt;if(e.type==='fire'||age>.8)continue;const size=e.type==='splat'?40:18;c.globalAlpha=Math.max(0,1-age/.8);c.strokeStyle=e.type==='hit'?'#fff9e2':INK_COLORS[Math.max(0,e.team)];c.lineWidth=e.type==='splat'?5:2;c.beginPath();c.arc(e.x,e.y,size*(.3+age),0,Math.PI*2);c.stroke();if(e.type==='splat')for(let n=0;n<9;n++){const a=n*Math.PI*2/9;circle(c,e.x+Math.cos(a)*size*age*2,e.y+Math.sin(a)*size*age*2,4*(1-age),INK_COLORS[e.team]);}c.globalAlpha=1;}
  c.restore();if(me.hp<40&&!me.respawn){c.strokeStyle='#ff795b88';c.lineWidth=8;c.strokeRect(4,4,width-8,height-8);}return view;
 }
 return {draw,get view(){return view;}};
}
