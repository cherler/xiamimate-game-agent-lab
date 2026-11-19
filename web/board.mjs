import { xy,SIDE } from '../src/snake.mjs';
import { WIDTH,HEIGHT,HALF } from '../src/pong.mjs';
import {PONG_VIEWS,pongPoint} from './arcade-view.mjs';

const color=['#79ded1','#ffa487'];
function rounded(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function circle(ctx,x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function line(ctx,x1,y1,x2,y2,width,stroke){
  ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}
export function geometry(canvas,game,view='left'){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(game==='pong'){const vertical=['top','bottom'].includes(view),fw=vertical?HEIGHT:WIDTH,fh=vertical?WIDTH:HEIGHT,scale=Math.min((w-28)/fw,(h-24)/fh);return {x:(w-fw*scale)/2,y:(h-fh*scale)/2,scale,w,h,fw,fh};}
  const edge=Math.min(w-23,h-23),scale=game==='snake'?edge/SIDE:edge/3.75;
  return {x:(w-(game==='snake'?SIDE:3)*scale)/2,y:(h-(game==='snake'?SIDE:3)*scale)/2,scale,w,h};
}
export function draw(canvas,s,{selected=-1,previous=null,progress=1,view='left',effects=[],now=0,reduced=false}={}){
  const g=geometry(canvas,s.game,view),dpr=Math.min(2,window.devicePixelRatio||1);
  const pw=Math.round(g.w*dpr),ph=Math.round(g.h*dpr);
  if(pw!==canvas.width||ph!==canvas.height){canvas.width=pw;canvas.height=ph;}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  c.fillStyle='#17354a';c.fillRect(0,0,g.w,g.h);
  if(s.game==='snake'){
    const a=g.scale,k=SIDE*a;
    rounded(c,g.x-1,g.y-1,k+2,k+2,5,'#638493');
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      c.fillStyle=(x+y)%2?'#204357':'#25485a';c.fillRect(g.x+x*a,g.y+y*a,a+.1,a+.1);
      circle(c,g.x+(x+.5)*a,g.y+(y+.5)*a,Math.max(1,a*.036),'#456474');
    }
    if(s.food>=0){
      const [x,y]=xy(s.food),cx=g.x+(x+.5)*a,cy=g.y+(y+.5)*a;
      c.save();c.translate(cx,cy);c.rotate(Math.PI/4);
      rounded(c,-a*.24,-a*.24,a*.48,a*.48,a*.075,'#ffdc80');c.restore();circle(c,cx-a*.07,cy-a*.08,a*.055,'#fff8c8');
    }
    s.bodies.forEach((body,side)=>{
      for(let i=body.length-1;i>=0;i--){
        let [x,y]=xy(body[i]);
        if(previous&&previous.game==='snake'&&previous.bodies[side][i]!=null){
          const [px,py]=xy(previous.bodies[side][i]);
          if(Math.abs(x-px)+Math.abs(y-py)<=1){x=px+(x-px)*progress;y=py+(y-py)*progress;}
        }
        const gap=i===0?.055:i===body.length-1?.17:.095;
        const left=g.x+(x+gap)*a,top=g.y+(y+gap)*a,size=a*(1-gap*2);
        rounded(c,left,top,size,size,a*(i===0?.25:.19),s.alive[side]?color[side]:'#95a4aa');
        if(i===0){
          const dir=s.dirs[side],dx=dir==='right'?1:dir==='left'?-1:0,dy=dir==='down'?1:dir==='up'?-1:0;
          for(const z of [-1,1])circle(c,left+size*(.5+dx*.22+dy*z*.19),top+size*(.5+dy*.22+dx*z*.19),a*.073,'#17354a');
        }
      }
    });
    for(const crash of s.collisions||[]){
      const cx=g.x+(crash.x+.5)*a,cy=g.y+(crash.y+.5)*a;
      rounded(c,cx-a*.48,cy-a*.48,a*.96,a*.96,5,'#b94e51aa');
      line(c,cx-a*.22,cy-a*.22,cx+a*.22,cy+a*.22,4,'#fff0c9');line(c,cx+a*.22,cy-a*.22,cx-a*.22,cy+a*.22,4,'#fff0c9');
      c.fillStyle='#fff0c9';c.font='bold 13px system-ui';c.textAlign='center';c.fillText(crash.kind,cx,Math.max(g.y+14,cy-a*.6));
    }
    for(const effect of effects){
      const age=(now-effect.at)/800;if(age<0||age>1)continue;const [x,y]=xy(effect.cell),cx=g.x+(x+.5)*a,cy=g.y+(y+.5)*a;
      c.save();c.globalAlpha=1-age;c.strokeStyle=color[effect.actor];c.lineWidth=3;c.beginPath();c.arc(cx,cy,a*(reduced?.45:.24+age*.7),0,Math.PI*2);c.stroke();
      if(!reduced)for(let n=0;n<9;n++){const angle=n*Math.PI*2/9,r=a*(.2+age*.9);circle(c,cx+Math.cos(angle)*r,cy+Math.sin(angle)*r,a*.065*(1-age),'#ffdc80');}
      c.font=`800 ${Math.max(18,a*.55)}px system-ui`;c.textAlign='center';c.strokeStyle='#17354a';c.lineWidth=4;const label='+'+effect.points,ly=cy-a*(reduced?.6:.45+age*.7);c.strokeText(label,cx,ly);c.fillStyle='#fff0a8';c.fillText(label,cx,ly);c.restore();
    }
  } else {
    c.save();c.translate(g.x,g.y);c.scale(g.scale,g.scale);
    const q=PONG_VIEWS.indexOf(view);if(q===1){c.translate(HEIGHT,0);c.rotate(Math.PI/2);}else if(q===2){c.translate(WIDTH,HEIGHT);c.rotate(Math.PI);}else if(q===3){c.translate(0,WIDTH);c.rotate(-Math.PI/2);}
    rounded(c,0,0,WIDTH,HEIGHT,14,'#245365');
    c.strokeStyle='#7aa2ab';c.lineWidth=3;c.strokeRect(13,13,WIDTH-26,HEIGHT-26);
    c.setLineDash([11,13]);line(c,500,19,500,581,3,'#77a2a9');c.setLineDash([]);
    const ink={normal:'#ffdc80',power:'#ffb95c',spin:'#c8adff'},shot=!s.serve?s.lastHit?.kind||'normal':'normal';
    for(const i of [0,1]){
      const x=i===0?29:955,armed=s.armed?.[i],dash=s.dash?.[i]>0;
      if(dash&&!reduced){const motion=s.paddles[i]-(previous?.paddles?.[i]??s.paddles[i]);for(let k=3;k>0;k--)rounded(c,x,s.paddles[i]-HALF-motion*k*.8,16,HALF*2,8,color[i]+['','88','55','22'][k]);}
      if(armed||dash)rounded(c,x-5,s.paddles[i]-HALF-5,26,HALF*2+10,12,(dash?color[i]:ink[armed])+'77');
      rounded(c,x,s.paddles[i]-HALF,16,HALF*2,8,armed?ink[armed]:color[i]);
    }
    if(s.flight){
      const points=reduced?s.flight.slice(-3):s.flight;for(let i=1;i<points.length;i++){c.globalAlpha=i/points.length*.7;line(c,...points[i-1],...points[i],3+i/points.length*5,ink[shot]);}c.globalAlpha=1;
    }else for(let k=4;k>0;k--)circle(c,s.ball[0]-s.ball[2]*k*.7,s.ball[1]-s.ball[3]*k*.7,Math.max(2,9-k*1.5),'#ffdc80'+['','99','66','44','22'][k]);
    circle(c,s.ball[0],s.ball[1],10,ink[shot]);
    if(shot==='spin'){
      const angle=reduced?0:s.tick*.28*Math.sign(s.curve||1);line(c,s.ball[0]+Math.cos(angle)*7,s.ball[1]+Math.sin(angle)*7,s.ball[0]-Math.cos(angle)*7,s.ball[1]-Math.sin(angle)*7,3,'#fff3ff');
      c.strokeStyle='#c8adff';c.lineWidth=2;c.beginPath();c.arc(s.ball[0],s.ball[1],17,angle,angle+Math.PI*1.3);c.stroke();
    }
    if(s.lastHit&&s.tick-s.lastHit.tick<14){const age=s.tick-s.lastHit.tick;c.globalAlpha=1-age/14;c.strokeStyle=ink[s.lastHit.kind];c.lineWidth=4;c.beginPath();c.arc(s.lastHit.side===0?47:953,s.paddles[s.lastHit.side],reduced?22:14+age*2,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
    c.restore();
    if(s.serve){const [x,y]=pongPoint(view,500,300);c.fillStyle='#e4f2ef';c.font='600 17px system-ui';c.textAlign='center';c.fillText('准备接球',g.x+x*g.scale,g.y+y*g.scale-28);}
    const [px,py]=pongPoint(view,88,s.paddles[0]);c.fillStyle=color[0];c.font='700 12px system-ui';c.textAlign='center';c.fillText('你',g.x+px*g.scale,g.y+py*g.scale+4);
    if(s.version>=3){
      for(const i of [0,1]){const hit=s.lastHit?.side===i&&s.tick-s.lastHit.tick<48&&s.lastHit.kind!=='normal'?s.lastHit.kind:null,kind=hit||s.armed[i];if(!kind)continue;const [x,y]=pongPoint(view,i===0?145:855,s.paddles[i]);c.fillStyle=ink[kind];c.font='700 12px system-ui';c.textAlign='center';c.fillText((hit?'':'待击 · ')+(kind==='power'?'快球':'旋球'),g.x+x*g.scale,g.y+y*g.scale-12);}
    }
  }
}
