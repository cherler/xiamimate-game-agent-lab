function limb(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function dancer(c,x,y,size,color,beat,pose,win,reduced){
 c.save();c.translate(x,y);c.scale(size,size);const bounce=reduced?0:Math.sin(beat*Math.PI*2)*3;
 c.fillStyle='#111b3c50';c.beginPath();c.ellipse(0,0,46,11,0,0,7);c.fill();c.translate(0,bounce);
 const swing=Math.sin(beat*Math.PI)*10,lean=pose==='left'?-12:pose==='right'?12:0,up=pose==='up',down=pose==='down';
 const hip=down?-48:-60,bodyX=lean;
 limb(c,[[0,hip],[-20-swing*.4,-28],[-24-swing,0]],'#6573af',17);limb(c,[[0,hip],[21+swing*.4,-29],[25+swing,0]],'#8b9ccc',17);
 limb(c,[[-25-swing,0],[-34-swing,0]],'#fff2db',12);limb(c,[[25+swing,0],[34+swing,0]],'#fff2db',12);
 limb(c,[[bodyX,-101+(down?10:0)],[0,hip]],color,38);
 limb(c,[[bodyX-14,-96+(down?10:0)],[-37+lean,-78],[-48+lean,up?-131:pose==='left'?-107:-61]],color,13);
 limb(c,[[bodyX+14,-96+(down?10:0)],[37+lean,-79],[49+lean,up?-131:pose==='right'?-107:-61]],color,13);
 c.fillStyle='#f1bca2';for(const [xx,yy] of [[-48+lean,up?-131:pose==='left'?-107:-61],[49+lean,up?-131:pose==='right'?-107:-61]]){c.beginPath();c.arc(xx,yy,7,0,7);c.fill();}
 c.fillStyle='#f1bca2';c.beginPath();c.ellipse(bodyX,-126+(down?10:0),21,24,0,0,7);c.fill();c.fillStyle='#303757';c.beginPath();c.ellipse(bodyX,-139+(down?10:0),23,14,-.15,Math.PI,Math.PI*2);c.fill();
 c.fillStyle=color;c.fillRect(bodyX-23,-145+(down?10:0),46,8);c.fillRect(bodyX+12,-139+(down?10:0),20,5);
 c.fillStyle='#313652';c.beginPath();c.arc(bodyX-7,-125+(down?10:0),2.2,0,7);c.arc(bodyX+7,-125+(down?10:0),2.2,0,7);c.fill();
 c.strokeStyle='#a96e65';c.lineWidth=2;c.beginPath();c.arc(bodyX,-117+(down?10:0),6,0,Math.PI);c.stroke();
 if(win){c.fillStyle='#ffe19c';c.beginPath();c.moveTo(bodyX-16,-161);c.lineTo(bodyX-19,-178);c.lineTo(bodyX-5,-170);c.lineTo(bodyX,-183);c.lineTo(bodyX+7,-170);c.lineTo(bodyX+19,-178);c.lineTo(bodyX+16,-161);c.fill();}
 c.restore();
}
export function drawDance(canvas,state,{reduced=false,idle=false}={}){
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,bpm=state.song==='bay'?96:120,beat=state.time/60000*bpm,pulse=reduced?0:(1-beat%1),floor=h*.76;
 c.fillStyle='#293058';c.fillRect(0,0,w,h);c.fillStyle='#39416d';c.fillRect(w*.06,h*.13,w*.88,h*.49);
 c.strokeStyle='#6672a2';c.lineWidth=2;for(let i=0;i<10;i++){c.beginPath();c.moveTo(w*(.1+i*.09),h*.13);c.lineTo(w*(.1+i*.09),h*.62);c.stroke();}
 for(let i=0;i<9;i++){c.fillStyle=i%2?'#e997aa':'#9bc6dc';c.globalAlpha=.25+(i%4===Math.floor(beat)%4?.3:0);c.fillRect(w*(.15+i*.08),h*.3-h*.1*Math.sin(i*3+beat*.4),w*.035,h*.23);}
 c.globalAlpha=1;c.fillStyle='#58618a';c.beginPath();c.moveTo(w*.1,h*.62);c.lineTo(w*.9,h*.62);c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fill();
 c.strokeStyle='#7d86aa';for(let i=0;i<9;i++){c.beginPath();c.moveTo(w/2+(i-4)*w*.09,h*.62);c.lineTo(w/2+(i-4)*w*.2,h);c.stroke();}
 for(const t of [.72,.86,1]){c.beginPath();c.moveTo(0,h*t);c.lineTo(w,h*t);c.stroke();}
 for(const [x,color] of [[w*.33,'#89d7d2'],[w*.67,'#f7b19f']]){c.globalAlpha=.13+pulse*.07;c.fillStyle=color;c.beginPath();c.moveTo(x-w*.16,0);c.lineTo(x+w*.03,0);c.lineTo(x+w*.19,floor);c.lineTo(x-w*.13,floor);c.closePath();c.fill();c.globalAlpha=1;c.beginPath();c.ellipse(x,floor,w*.12,h*.043,0,0,7);c.fill();}
 const scale=Math.min(h/235,w/460),row=state.chart[Math.max(0,state.index)],step=Math.floor(beat)%4;
 for(let i=0;i<2;i++){const p=state.players[i],pose=idle?'down':row?.keys[(step+(i?1:0))%row.keys.length]||'down';dancer(c,w*(i?.67:.33),floor,scale,i?'#f2a690':'#8cd7cf',beat+(i?.5:0),pose,!idle&&p.score>state.players[1-i].score,reduced);}
 c.font=`600 ${Math.max(14,w*.019)}px system-ui`;c.textAlign='center';c.fillStyle='#f5f6ff';c.fillText('你',w*.33,floor+h*.12);c.fillText('星律 · 规则舞伴',w*.67,floor+h*.12);
}
