import {rescueMap,lineOfSight,walkable,RESCUE_HZ,rescueRaging} from '../src/rescue.mjs';
const C={floor:'#dce5e8',wall:'#294957',wallTop:'#395d6a',ink:'#254755',soldier:'#61c2f2',civilian:'#ffd16e',zombie:'#dc7089',exit:'#7bdec0'};
export function rescuePoint(canvas,e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*24,y:(e.clientY-r.top)/r.height*16};}
export function drawRescue(canvas,s,{selected='all',selectedIds=null,building=false,support=null,hover=null,reduced=false,selectionBox=null,movePreview=null,orderMarker=null}={}){
 const box=canvas.getBoundingClientRect();if(!box.width)return;
 const dpr=Math.min(devicePixelRatio||1,2),width=Math.round(box.width*dpr),height=Math.round(box.height*dpr);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const ctx=canvas.getContext('2d'),m=rescueMap(s.level,s.version),unit=width/m.w,raging=rescueRaging(s),evac=s.evac;
 ctx.setTransform(unit,0,0,height/m.h,0,0);ctx.clearRect(0,0,m.w,m.h);ctx.lineCap='round';ctx.lineJoin='round';
 const circle=(x,y,r,fill,stroke,lw=.05)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}};
 const line=(a,b,color,lw=.05)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke();};
 const text=(str,x,y,size=.28,color=C.ink,align='center')=>{ctx.font=`600 ${size}px system-ui,"PingFang SC",sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(str,x,y);};
 const chevron=(x,y,color,rotation=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.strokeStyle=color;ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(-.14,-.16);ctx.lineTo(.08,0);ctx.lineTo(-.14,.16);ctx.stroke();ctx.restore();};
 ctx.fillStyle=C.floor;ctx.fillRect(0,0,24,16);
 for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){
  if(m.tiles[y][x]==='#'){ctx.fillStyle=C.wall;ctx.fillRect(x,y,1,1);ctx.fillStyle=C.wallTop;ctx.fillRect(x+.04,y+.04,.92,.16);}
  else{ctx.strokeStyle='#c8d5d9';ctx.lineWidth=.015;ctx.strokeRect(x,y,1,1);if((x*7+y*13)%19===0){ctx.fillStyle='#cfdcdf';ctx.fillRect(x+.25,y+.25,.5,.5);}}
 }
 for(const l of m.labels)text(l.text,l.x,l.y,.31,'#8aa0a9');
 // The sanctuary is a destination on the map, not a separate counter to decode.
 const ex=m.exit;ctx.fillStyle='#a3dbc9';ctx.fillRect(ex.x,ex.y,ex.w,ex.h);ctx.save();ctx.beginPath();ctx.rect(ex.x,ex.y,ex.w,ex.h);ctx.clip();
 for(let x=ex.x-5;x<ex.x+ex.w+5;x+=.6)line({x,y:ex.y},{x:x+ex.h,y:ex.y+ex.h},'#8acbb855',.11);ctx.restore();
 ctx.strokeStyle='#398f7b';ctx.lineWidth=.07;ctx.setLineDash([.2,.13]);ctx.strokeRect(ex.x,ex.y,ex.w,ex.h);ctx.setLineDash([]);
 if(s.phase==='deploy'&&s.version>=2){ctx.fillStyle='#173e4924';ctx.fillRect(0,0,24,ex.y);ctx.fillRect(0,ex.y,ex.x,ex.h);ctx.fillRect(ex.x+ex.w,ex.y,24-ex.x-ex.w,ex.h);ctx.fillRect(0,ex.y+ex.h,24,16-ex.y-ex.h);}
 if(evac&&evac.phase!=='idle'){
  const blocked=['contested','unguarded'].includes(evac.phase),color=blocked?'#ad3a52':'#267d66';
  text(evac.phase==='complete'?'✓ 已撤离':evac.phase==='gathering'?'等待呼叫接驳':evac.phase==='called'?'准备接驳':blocked?'Ⅱ 读秒暂停':'守住 '+Math.ceil((evac.required-evac.progress)/30)+' 秒',ex.x+ex.w/2,ex.y+.65,.38,color);
  ctx.fillStyle='#518b7833';ctx.fillRect(ex.x+.35,ex.y+1.14,ex.w-.7,.15);ctx.fillStyle=color;ctx.fillRect(ex.x+.35,ex.y+1.14,(ex.w-.7)*evac.progress/evac.required,.15);
 }else{text('＋',ex.x+ex.w/2,ex.y+1,.8,'#348773');text(s.phase==='deploy'&&s.version>=2?'接 应 区':'撤 离 区',ex.x+ex.w/2,ex.y+1.75,.36,'#296e5f');}
 for(let i=0;i<3;i++)chevron(ex.x+ex.w+.25+i*.3,ex.y+ex.h/2,'#38977d',Math.PI);
 for(const crate of s.crates||[])if(!crate.claimed){ctx.fillStyle='#f6dc96';ctx.fillRect(crate.x-.33,crate.y-.28,.66,.56);ctx.strokeStyle='#a77935';ctx.lineWidth=.06;ctx.strokeRect(crate.x-.33,crate.y-.28,.66,.56);text('+',crate.x,crate.y,.5,'#95692e');text('补给 +1',crate.x,crate.y+.65,.28,'#916832');}
 for(const d of s.decoys||[]){const time=Math.ceil((d.expires-s.tick)/30);circle(d.x,d.y,.3,'#c5a3da','#7b5494');circle(d.x,d.y,.6+(reduced?0:s.tick%30/35),null,'#9c74b588',.05);text('◉',d.x,d.y,.38,'#684179');text('诱饵 '+time+'s',d.x,d.y-.7,.29,'#74458b');for(const z of s.zombies)if(z.target===d.id)line(z,d,'#9863ad66',.035);}
 if(support&&hover){const valid=s.soldiers.some(u=>u.hp>0&&Math.hypot(u.x-hover.x,u.y-hover.y)<=4&&lineOfSight(s,u,hover)),color=valid?(support==='medic'?'#318a63':'#9460ad'):'#af5360';circle(hover.x,hover.y,support==='medic'?2.4:6,color+'18',color+'88',.04);text(support==='medic'?'+55':'诱敌 6 秒',hover.x,hover.y-.6,.4,color);}
 for(const d of m.doors){
  const g=s.gates.find(g=>g.id===d.id&&g.hp>0),v=d.vertical;
  ctx.fillStyle=g?'#7bbfac':building?'#b6efda':'#b8cbc9';ctx.fillRect(d.x-(v?.21:.49),d.y-(v?.49:.21),v?.42:.98,v?.98:.42);
  if(g){line({x:d.x-(v?0:.4),y:d.y-(v?.4:0)},{x:d.x+(v?0:.4),y:d.y+(v?.4:0)},'#32715f',.12);ctx.fillStyle='#244b40';ctx.fillRect(d.x-.4,d.y+.6,.8,.08);ctx.fillStyle=C.exit;ctx.fillRect(d.x-.4,d.y+.6,.8*g.hp/g.maxHp,.08);}
  if(building&&!g){circle(d.x,d.y,.67,'#4ecba52b','#237f68',.055);text('+',d.x,d.y,.7,'#237f68');}
 }
 const chosen=s.soldiers.filter(u=>u.hp>0&&(selectedIds?selectedIds.includes(u.id):selected==='all'||u.group===selected));
 for(const u of s.version>=6?chosen.filter(u=>u.role==='shield').slice(0,1):chosen){
  if(u.path.length){ctx.beginPath();ctx.moveTo(u.x,u.y);for(const p of u.path)ctx.lineTo(p.x,p.y);ctx.strokeStyle='#2787ab88';ctx.lineWidth=.06;ctx.setLineDash([.16,.13]);ctx.stroke();ctx.setLineDash([]);const end=u.path.at(-1);circle(end.x,end.y,.22,null,'#2688b0',.06);}
 }
 if(hover&&!building&&walkable(s,hover.x,hover.y,'human',.3)&&!['ended'].includes(s.phase)){circle(hover.x,hover.y,.25,null,'#2b8ba9',.04);line({x:hover.x-.4,y:hover.y},{x:hover.x+.4,y:hover.y},'#2b8ba9',.025);line({x:hover.x,y:hover.y-.4},{x:hover.x,y:hover.y+.4},'#2b8ba9',.025);}
 for(const [i,e]of m.entrances.entries()){
  const next=s.schedule.slice(s.spawned).find(w=>w.entry===i),wait=next?(next.tick-s.tick)/RESCUE_HZ:null,imminent=wait!==null&&wait<5;
  const alpha=imminent&&!reduced?.65+.35*Math.sin(s.tick*.25):1;ctx.globalAlpha=alpha;
  ctx.fillStyle=imminent?'#b94762':'#704d60';ctx.fillRect(e.x-.75,.2,1.5,.76);text('▼',e.x,.56,.45,'#fff');
  if(next){text(`${next.assault?'⚠ ':''}${Math.max(0,Math.ceil(wait))}s`,e.x,e.y+.7,.38,imminent?'#a2314e':'#89566a');}else if(e.evacOnly&&!s.evac?.alerts)text('撤离信号',e.x,e.y+.7,.27,'#89566a');ctx.globalAlpha=1;
 }
 for(const c of s.civilians.filter(c=>['waiting','following','boarding'].includes(c.status))){
  if(c.status==='following'){const leader=s.soldiers.find(u=>u.id===c.leader&&u.hp>0);if(leader&&Math.hypot(leader.x-c.x,leader.y-c.y)<3&&lineOfSight(s,c,leader))line(c,leader,'#b68b3f55',.035);}
  circle(c.x,c.y+.07,c.r+.04,'#183c4d25');circle(c.x,c.y,c.r,C.civilian,'#9c7538',.035);circle(c.x,c.y-.045,.045,'#fff3cb');
  if(c.avoidingUntil>s.tick){chevron(c.x,c.y-.4,'#b28331',c.angle);}
  else if(c.status==='waiting'){text('·',c.x,c.y-.4,.45,'#b28331');}
  if(c.status==='boarding')circle(c.x,c.y,.27,null,'#429b83',.045);
  if(c.infection){ctx.beginPath();ctx.arc(c.x,c.y,.32,-Math.PI/2,-Math.PI/2+Math.PI*2*c.infection/(s.difficulty==='challenge'?1:18));ctx.strokeStyle='#c23a5b';ctx.lineWidth=.09;ctx.stroke();text('!',c.x,c.y-.6,.38,'#ad2347');}
 }
 for(const z of s.zombies){
  if(m.mode==='clear'&&m.seconds-s.tick/30<=20){circle(z.x,z.y,.55,null,'#bd3b57',.08);text('▼',z.x,z.y-.8,.42,'#a72e49');}
  if(raging){circle(z.x,z.y,z.r+.1,null,'#e46d3c',.045);chevron(z.x,z.y-.42,'#bd4629',-Math.PI/2);}
  circle(z.x,z.y+.07,z.r+.06,'#69324424');circle(z.x,z.y,z.r,!reduced&&z.hitTick>s.tick-3?'#fff3cb':raging?'#ec815d':C.zombie,'#973d58',.045);
  const dx=Math.cos(z.angle),dy=Math.sin(z.angle);circle(z.x+dx*.1-dy*.07,z.y+dy*.1+dx*.07,.027,'#613342');circle(z.x+dx*.1+dy*.07,z.y+dy*.1-dx*.07,.027,'#613342');
  if(z.fast){chevron(z.x-.25,z.y,'#c85b77',z.angle);}
  if(z.hp<z.maxHp){ctx.fillStyle='#ad4962';ctx.fillRect(z.x-.22,z.y-.36,.44*z.hp/z.maxHp,.045);}
 }
 for(const u of s.soldiers){
  if(u.hp<=0){line({x:u.x-.14,y:u.y-.14},{x:u.x+.14,y:u.y+.14},'#668692',.06);line({x:u.x-.14,y:u.y+.14},{x:u.x+.14,y:u.y-.14},'#668692',.06);continue;}
  const picked=chosen.includes(u),dx=Math.cos(u.angle),dy=Math.sin(u.angle);
  if(picked){circle(u.x,u.y,u.r+.16,'#81d6f34d','#f3ffff',.13);circle(u.x,u.y,u.r+.16,null,'#167aaa',.06);}
  circle(u.x,u.y+.08,u.r+.03,'#183c4d35');line(u,{x:u.x+dx*.42,y:u.y+dy*.42},'#224759',.12);
  circle(u.x,u.y,u.r,!reduced&&u.hitTick>s.tick-3?'#fff':C.soldier,'#246785',.05);circle(u.x-dx*.05,u.y-dy*.05,.09,'#a0e0f7');
  if(u.role==='shield'){ctx.beginPath();ctx.arc(u.x,u.y,.36,u.angle-.9,u.angle+.9);ctx.lineWidth=.1;ctx.strokeStyle='#e6f5fa';ctx.stroke();}
  ctx.fillStyle='#536f7b';ctx.fillRect(u.x-.25,u.y+.4,.5,.055);ctx.fillStyle='#4fab9c';ctx.fillRect(u.x-.25,u.y+.4,.5*u.hp/u.maxHp,.055);
  if(u.reload){ctx.beginPath();ctx.arc(u.x,u.y,.32,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-u.reload/(s.version>=5?30:u.role==='rifle'?42:36)));ctx.strokeStyle='#fff6c4';ctx.lineWidth=.05;ctx.stroke();}
  if(s.version<6)text(String(u.group+1),u.x,u.y-.47,.23,'#256584');
  else if(u.intent==='cover'||u.intent==='protect'){circle(u.x,u.y,u.r+.24,null,u.intent==='protect'?'#34876d':'#ba8637',.045);text(u.intent==='protect'?'掩护':'避险',u.x,u.y-.65,.24,u.intent==='protect'?'#28715e':'#996928');}
 }
 for(const b of s.bullets)line({x:b.x-b.dx*.28,y:b.y-b.dy*.28},b,'#fff7c0',.065);
 for(const e of s.events){
  const age=s.tick-e.tick,p=age/30;if(age<0||age>32)continue;ctx.globalAlpha=Math.max(0,1-p);
  if(e.kind==='shot'&&age<4&&!reduced){const x=e.x+Math.cos(e.angle)*.46,y=e.y+Math.sin(e.angle)*.46;circle(x,y,.12,'#fff6c3');}
  if(e.kind==='hit'&&age<10&&!reduced)for(let i=0;i<3;i++){const a=i*2.2+e.id;line({x:e.x+Math.cos(a)*.2,y:e.y+Math.sin(a)*.2},{x:e.x+Math.cos(a)*(.25+p),y:e.y+Math.sin(a)*(.25+p)},'#ffeeb0',.05);}
  if(['death','infection','fallen','rescue','build','order'].includes(e.kind)){
   const color=e.kind==='rescue'?'#218e73':e.kind==='order'?'#2187ad':e.kind==='build'?'#51a58b':'#b64463';circle(e.x,e.y,.18+(reduced?.1:p*.7),null,color,.06);
   if(e.kind==='rescue')text('+1',e.x,e.y-.5-p*.5,.38,'#247e67');
   if(e.kind==='infection')text('感染',e.x,e.y-.5-p*.5,.32,'#aa2d4c');
   if(e.kind==='death'&&!reduced)for(let i=0;i<4;i++){const a=i*Math.PI/2+.3;circle(e.x+Math.cos(a)*p*.8,e.y+Math.sin(a)*p*.8,.055,'#b5526c');}
  }
  if(e.kind==='medic'||e.kind==='supply'){circle(e.x,e.y,.4+p*.6,null,'#29946b',.06);text(e.kind==='supply'?'补给 +1':e.amount?'+'+e.amount:'抢救',e.x,e.y-.4-p*.4,.38,'#217b56');}
  ctx.globalAlpha=1;
 }
 if(s.phase==='deploy'){text('接应部署',1.1,.55,.22,'#a7c7cf','left');text('部署',22.9,.55,.26,'#a7c7cf','right');}
 if(selectionBox){const b=selectionBox,x=Math.min(b.x,b.x2),y=Math.min(b.y,b.y2),w=Math.abs(b.x2-b.x),h=Math.abs(b.y2-b.y);ctx.fillStyle='#278db52a';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#eaffff';ctx.lineWidth=.12;ctx.strokeRect(x,y,w,h);ctx.strokeStyle='#157797';ctx.lineWidth=.05;ctx.strokeRect(x,y,w,h);}
 if(movePreview){ctx.setLineDash([.16,.16]);for(const u of chosen)line(u,movePreview,'#2187ad99',.045);ctx.setLineDash([]);circle(movePreview.x,movePreview.y,.36,null,'#187c9f',.07);}
 if(orderMarker){const p=orderMarker,color=p.ok?'#167c9e':'#b63d53';circle(p.x,p.y,.5,'#f5ffffb0',color,.07);text(p.ok?'↓':'×',p.x,p.y,.55,color);text(p.ok?p.count+' 人 →': '不可到达',p.x,Math.max(.6,p.y-.8),.4,color);}
 canvas.dataset.phase=s.phase;canvas.dataset.tick=String(s.tick);canvas.dataset.saved=String(s.saved);canvas.dataset.lost=String(s.lost);canvas.dataset.kills=String(s.kills);
 canvas.dataset.evac=evac?.phase||'legacy';canvas.dataset.evacProgress=String(evac?.progress||0);canvas.dataset.raging=String(raging);canvas.dataset.boarding=String(s.civilians.filter(c=>c.status==='boarding').length);
 canvas.dataset.supplies=String(s.supplies??0);canvas.dataset.decoys=String(s.decoys?.length||0);
 canvas.dataset.version=String(s.version);
 canvas.dataset.selected=chosen.map(u=>u.id).join(',');canvas.dataset.selecting=String(!!selectionBox);canvas.dataset.order=orderMarker?(orderMarker.ok?'accepted':'rejected'):'';
}
