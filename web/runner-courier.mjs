import {jumpHeight} from '../src/runner.mjs';
import {poly,oval,box,stroke,star,clamp} from './runner-paint.mjs';
const ink='#315765',shell='#ed9475',light='#ffc39a',mint='#6cbba5',tau=Math.PI*2;
const project=p=>({x:p.x*(1-p.z*.005),y:-p.h-p.z*.55,scale:1-p.z*.006});
// Pitch around the hips in depth. A sideways canvas rotation would only make him lean into a turn.
export function courierBodyPoint(p,pose){const pivot=36+pose.bob,h=p.h-pivot,a=pose.lean;return {x:p.x,h:pivot+h*Math.cos(a)-p.z*Math.sin(a),z:p.z*Math.cos(a)+h*Math.sin(a)};}
function knee(hip,foot){const dh=foot.h-hip.h,dz=foot.z-hip.z,length=Math.max(.01,Math.hypot(dh,dz)),bend=Math.sqrt(Math.max(0,21**2-(length/2)**2));return {x:hip.x,h:(hip.h+foot.h)/2+dz/length*bend,z:(hip.z+foot.z)/2-dh/length*bend};}
export function courierPose(s,{reduced=false,landedAt=-Infinity,turnAt=-Infinity,turnDirection=0}={}){
 const jumping=s.jump>=0,rolling=s.roll>0,running=s.phase==='running'&&!s.countdown&&!jumping&&!rolling&&s.board<=0,phase=reduced||!running?0:((s.z/20)%1+1)%1,a=phase*tau,landing=jumping?0:clamp(1-(s.time-landedAt)/.16),bob=(running&&!reduced?-Math.cos(a*2-.36*tau)*2.4:0)-landing*5;
 const legs=[-1,1].map((side,i)=>{
  const q=(phase+i*.5)%1,stance=q<.36,t=stance?q/.36:(q-.36)/.64;
  let foot={x:side*12,h:running&&!stance?Math.sin(t*Math.PI)*15:0,z:running?(stance?12-24*t:-12+24*(t*t*(3-2*t))):0};
  if(jumping){const progress=clamp(s.jump/(s.version>=3?.78:.96)),tuck=Math.sin(Math.PI*progress);foot={x:side*12,h:tuck*22,z:side*5+tuck*7};}
  if(s.board>0)foot={x:side*15,h:0,z:side*4};
  const hip={x:side*10,h:36+bob-(s.board>0?4:0),z:0};return {side,phase:q,stance:!jumping&&(!running||stance),hip,knee:knee(hip,foot),foot,shoeAngle:running?(stance?-.16:.5)*Math.sin(t*Math.PI):jumping?-.2:0};
 });
 const arms=[-1,1].map((side,i)=>{const swing=running?-Math.cos(a+i*Math.PI)*15:0;return {side,shoulder:{x:side*24,h:77+bob,z:4},elbow:{x:side*30,h:63+bob+(jumping?9:0),z:jumping?3:swing*.4-3},hand:{x:side*(jumping?32:27),h:58+bob+(jumping?15:Math.max(0,swing)*.25),z:jumping?10:swing}};});
 const lean=(running?.62+clamp((s.speed-24)/28)*.12:jumping?.32:s.board>0?.26:.14)+landing*.07;
 return {phase,running,jumping,rolling,legs,arms,bob,landing,lean,turn:clamp(s.lane-s.x,-1,1)*.13+(!reduced?turnDirection*Math.sin(Math.PI*clamp((s.time-turnAt)/.22))*.16:0),twist:running&&!reduced?Math.sin(a)*.035:0,packLag:reduced?0:Math.sin(a-.65)*.04,antenna:reduced?0:Math.sin(a-.8)*3};
}
export function drawCourier(c,x,y,size,s,{reduced=false,impact=null,landedAt=-Infinity,turnAt=-Infinity,turnDirection=0}={}){
 const pose=courierPose(s,{reduced,landedAt,turnAt,turnDirection}),jump=impact&&!impact.saved?0:jumpHeight(s);
 c.save();c.translate(x,y);c.scale(size,size);
 if(!impact?.fall){oval(c,'#234c6525',0,1,29-jump*3,6-jump*.6);for(const leg of pose.legs){const p=project({...leg.foot,h:0});c.save();c.globalAlpha=clamp(1-(jump*25+leg.foot.h)/28)*.5;oval(c,'#315765',p.x,p.y+1,10,3);c.restore();}}
 if(impact){c.translate(0,impact.drop);c.scale(impact.scale,impact.scale);c.rotate(impact.tilt);c.scale(1+impact.recoil*.09,1-impact.recoil*.08);}
 if(s.board>0){oval(c,'#469b99',0,5,42,8);box(c,'#a0ead2',-36,0,72,5,3);star(c,0,2,5,'#fff0ae');}
 c.translate(0,-jump*33);c.rotate(pose.turn);
 if(pose.rolling){
  const rollLength=s.version>=3?.58:.72,t=clamp(1-s.roll/rollLength),angle=t*tau*1.4;
  oval(c,'#b97762',0,-24,30,25);oval(c,shell,-2,-26,28,24);
  for(let i=0;i<3;i++){const a=angle+i*tau/3;if(Math.cos(a)>0)stroke(c,light,3,[[-24*Math.cos(a*.2),-26+Math.sin(a)*20],[0,-24+Math.sin(a)*23],[24*Math.cos(a*.2),-26+Math.sin(a)*20]]);}
  if(Math.cos(angle)>.05){const yy=-26+Math.sin(angle)*21,hh=Math.max(3,14*Math.cos(angle));box(c,mint,-20,yy-hh/2,40,hh,5);box(c,'#efd58c',-7,yy-hh/2,14,hh,3);}
  c.restore();return;
 }
 const body=p=>project(courierBodyPoint(p,pose));
 function arm(arm){const a=body(arm.shoulder),b=body(arm.elbow),d=body(arm.hand);stroke(c,'#d98d72',10,[[a.x,a.y],[b.x,b.y]]);stroke(c,light,8,[[b.x,b.y],[d.x,d.y]]);oval(c,'#ffe2b6',d.x,d.y,5*d.scale,6*d.scale);}
 for(const armPose of pose.arms.filter(a=>a.hand.z>0))arm(armPose);
 for(const leg of [...pose.legs].sort((a,b)=>b.foot.z-a.foot.z)){
  const hip=project(leg.hip),k=project(leg.knee),foot=project(leg.foot);stroke(c,'#4d817c',11,[[hip.x,hip.y],[k.x,k.y]]);stroke(c,'#365f68',9,[[k.x,k.y],[foot.x,foot.y-5]]);oval(c,'#6cbba5',k.x,k.y,5,5);
  c.save();c.translate(foot.x,foot.y);c.scale(foot.scale,foot.scale);c.rotate(leg.shoeAngle);box(c,ink,-9,-12,18,14,7);box(c,'#fff2cf',-9,0,19,4,2);box(c,'#e5bd78',-5,-11,10,3,1);c.restore();
 }
 c.save();c.rotate(pose.twist);
 const pt=(x,h,z=0)=>{const p=body({x,h:h+pose.bob,z});return [p.x,p.y];},shape=(color,points)=>poly(c,color,points.map(p=>pt(...p)));
 const tail=body({x:27,h:46+pose.bob,z:-5});oval(c,'#c87961',tail.x,tail.y,15,14);oval(c,shell,tail.x+3,tail.y-3,11,10);stroke(c,light,3,[[tail.x+4,tail.y+4],[tail.x+11,tail.y],[tail.x+9,tail.y-6]]);
 // Broad hips, a tapered back and a smaller head farther down the track make the forward pitch visible from behind.
 const head=body({x:0,h:94+pose.bob,z:14});oval(c,'#cf8268',head.x,head.y,29*head.scale,19*head.scale);oval(c,light,head.x-2,head.y-4,27*head.scale,15*head.scale);
 const torso=body({x:0,h:65+pose.bob,z:0});oval(c,'#bc7965',torso.x,torso.y,29*torso.scale,29);oval(c,shell,torso.x,torso.y-3,27*torso.scale,27);
 const lag=pose.antenna;for(const side of [-1,1]){const points=[[side*13,110,10],[side*21,118+lag*side,21],[side*30,119+lag*side,29]];stroke(c,'#d48569',3,points.map(p=>pt(...p)));const end=pt(...points[2]);oval(c,light,...end,2.7,2.7);}
 stroke(c,'#d8856c',3,[[-22,94,5],[-10,89,4],[10,89,4],[22,94,5]].map(p=>pt(...p)));
 c.save();c.rotate(pose.packLag-pose.turn*.18);
 shape('#417d77',[[-23,85,-9],[23,85,-9],[24,46,-15],[-24,46,-15]]);
 shape(mint,[[-21,85,-11],[21,85,-11],[21,49,-17],[-21,49,-17]]);
 shape('#9dd6b7',[[-21,85,-11],[21,85,-11],[20,77,-16],[-20,77,-16]]);
 shape('#f4d895',[[-12,72,-18],[12,72,-18],[12,55,-20],[-12,55,-20]]);
 stroke(c,'#b8955c',2,[[-9,69,-21],[0,62,-22],[9,69,-21]].map(p=>pt(...p)));
 shape('#e7bb77',[[-4,84,-17],[4,84,-17],[4,77,-18],[-4,77,-18]]);c.restore();c.restore();
 for(const armPose of pose.arms.filter(a=>a.hand.z<=0))arm(armPose);
 if(s.magnet>0){c.strokeStyle='#b0f3d9';c.lineWidth=2.5;c.beginPath();c.arc(0,-67,47,0,tau);c.stroke();}
 if(pose.running&&!reduced)for(const leg of pose.legs){if(leg.phase<.2){const t=leg.phase/.2,p=project({...leg.foot,h:0});c.save();c.globalAlpha=(1-t)*.28;oval(c,'#f3e8be',p.x+leg.side*t*8,p.y+4+t*5,3+t*8,2+t*2);c.restore();}}
 c.restore();
}
