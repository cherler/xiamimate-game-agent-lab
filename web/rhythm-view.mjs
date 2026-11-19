export const LANE_COLORS=['#82d6c9','#a9bef5','#f3b1bd','#f1ce85'];
export const RHYTHM_KEYS=['D','F','J','K'];
export function drawRhythm(canvas,state,{lead=2100,reduced=false,idle=false}={}){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,lane=w/4,line=h*.83,top=15,scale=(line-top)/lead,time=idle?700:state.time;
 c.fillStyle='#26364e';c.fillRect(0,0,w,h);
 for(let l=0;l<4;l++){c.fillStyle=l%2?'#30415b':'#2b3c55';c.fillRect(l*lane,0,lane,h);if(state.held[l]){const g=c.createLinearGradient(0,line-h*.6,0,h);g.addColorStop(0,LANE_COLORS[l]+'00');g.addColorStop(1,LANE_COLORS[l]+'90');c.fillStyle=g;c.fillRect(l*lane,0,lane,h);}c.strokeStyle='#8499af40';c.lineWidth=1;c.beginPath();c.moveTo(l*lane,0);c.lineTo(l*lane,h);c.stroke();}
 const beat=60000/(state.song==='bay'?96:120),first=Math.max(0,Math.floor((time-lead)/beat));
 for(let b=first;b*beat<time+lead;b++){const y=line-(b*beat-time)*scale;if(y<0||y>line)continue;c.strokeStyle=b%4?'#8d9fb414':'#a4bed72f';c.lineWidth=b%4?1:2;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 const notes=idle?[{id:0,at:1700,lane:0,duration:0},{id:1,at:2150,lane:2,duration:700},{id:2,at:2700,lane:1,duration:0},{id:3,at:2700,lane:3,duration:0}]:state.notes;
 for(const n of notes){
  if(!idle&&state.judgments[n.id])continue;const y=line-(n.at+state.offset-time)*scale,tail=line-(n.at+n.duration+state.offset-time)*scale,holding=!idle&&state.holds[n.lane]?.id===n.id;
  if(y< -25||tail>h+30)continue;
  const x=n.lane*lane+lane*.1,width=lane*.8,height=Math.max(13,h*.025),head=holding?line:y;
  if(n.duration){c.fillStyle=LANE_COLORS[n.lane]+(holding?'aa':'66');c.fillRect(x+width*.12,Math.max(0,tail),width*.76,Math.max(0,head-Math.max(0,tail)));c.strokeStyle=LANE_COLORS[n.lane];c.lineWidth=2;c.strokeRect(x+width*.12,Math.max(0,tail),width*.76,Math.max(0,head-Math.max(0,tail)));c.fillStyle='#f2fbff';c.fillRect(x+width*.4,Math.max(0,tail),width*.2,5);}
  c.fillStyle='#12263a';c.beginPath();c.roundRect(x,head-height/2+4,width,height,5);c.fill();c.fillStyle=LANE_COLORS[n.lane];c.beginPath();c.roundRect(x,head-height/2,width,height,5);c.fill();c.fillStyle='#f6fcff99';c.fillRect(x+5,head-height/2+2,Math.max(1,width-10),3);
 }
 c.fillStyle='#17283e';c.fillRect(0,line+12,w,h-line);c.fillStyle='#e8f9f7';c.fillRect(0,line-2,w,4);
 for(let l=0;l<4;l++){c.fillStyle=state.held[l]?LANE_COLORS[l]:LANE_COLORS[l]+'42';c.beginPath();c.roundRect(l*lane+5,line+20,lane-10,Math.max(15,h-line-27),9);c.fill();c.fillStyle=state.held[l]?'#244451':'#e8f5fa';c.font=`700 ${Math.min(26,Math.max(14,lane*.18))}px system-ui`;c.textAlign='center';c.fillText(RHYTHM_KEYS[l],(l+.5)*lane,line+(h-line)*.65);}
 const f=state.feedback,age=f?state.time-f.at:2000;if(f&&age>=0&&age<320&&!['empty','miss','hold'].includes(f.kind)&&!reduced){c.strokeStyle=LANE_COLORS[f.lane];c.lineWidth=3;const x=(f.lane+.5)*lane;for(let i=0;i<8;i++){const a=i*Math.PI/4,r=12+age*.12;c.globalAlpha=1-age/320;c.beginPath();c.moveTo(x+Math.cos(a)*r,line+Math.sin(a)*r*.5);c.lineTo(x+Math.cos(a)*(r+8),line+Math.sin(a)*(r+8)*.5);c.stroke();}c.globalAlpha=1;}
}
