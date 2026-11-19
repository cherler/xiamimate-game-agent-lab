import {poly,oval,box,stroke} from './runner-paint.mjs';
export const RUNNER_WORLDS=Object.freeze([
 {id:'station',name:'晨光车站',color:'#458f9d',sky:'#d5edf1',ground:'#b7c5bb',lanes:['#4f6875','#617d89','#4f6875'],edge:'#c9b98e',vehicle:'#e5ae5f',block:'列车'},
 {id:'market',name:'桥下市集',color:'#b77d51',sky:'#f2e4cd',ground:'#c5ba9b',lanes:['#806a55','#aa9073','#806a55'],edge:'#f7dfad',vehicle:'#cc9560',block:'货车'},
 {id:'river',name:'滨河栈桥',color:'#528eaf',sky:'#d7edf3',ground:'#79b6c0',lanes:['#747d72','#a6a88e','#747d72'],edge:'#f4dfa5',vehicle:'#769ca6',block:'货箱'},
 {id:'forest',name:'雨林遗迹',color:'#467b65',sky:'#d4e6c9',ground:'#527c68',lanes:['#657557','#98a484','#657557'],edge:'#ecdfac',vehicle:'#718575',block:'巨石'},
 {id:'canyon',name:'落日峡谷',color:'#a86648',sky:'#f8d8b4',ground:'#cd9475',lanes:['#8d6755','#ba9478','#8d6755'],edge:'#ffe0a2',vehicle:'#aa7861',block:'岩柱'},
 {id:'snow',name:'雪山驿道',color:'#5c7f9f',sky:'#cbdde8',ground:'#e1eded',lanes:['#607d92','#92a8b5','#607d92'],edge:'#ffffe2',vehicle:'#da9b57',block:'雪车'}
]);
export function runnerWorld(z,scenery='station',version=3){
 const index=Math.floor(Math.max(0,z)/400),count=version<3?3:RUNNER_WORLDS.length,offset=version<3?0:Math.max(0,RUNNER_WORLDS.findIndex(w=>w.id===scenery));
 return {index,zone:RUNNER_WORLDS[(index+offset)%count],next:RUNNER_WORLDS[(index+offset+1)%count],progress:(z-index*400)/400,remaining:Math.ceil((index+1)*400-z)};
}
// Scene boundaries belong to the world, not to strips that move with the camera.
// A straight road needs one continuous polygon per scene, avoiding seams between equal-colour tiles.
export function runnerRoadSections(z){
 const far=z+256,sections=[];let near=z-2;
 while(near<far){const end=Math.min(far,(Math.max(0,Math.floor(near/400))+1)*400);sections.push({near,far:end,worldZ:Math.max(0,(near+end)/2)});near=end;}
 return sections.reverse();
}
export function worldBackdrop(c,w,h,zone){
 const horizon=h*.2;
 if(['forest','canyon','snow'].includes(zone.id)){
  for(let i=0;i<7;i++){const x=i*w/5-w*.1,peak=h*(.055+(i*7%4)*.025),width=w*.3,color=zone.id==='forest'?'#89a58c':zone.id==='canyon'?'#d5a082':'#9fb9c8';poly(c,color,[[x-width/2,horizon],[x,horizon-peak],[x+width/2,horizon]]);if(zone.id==='snow')poly(c,'#f0f6ec',[[x-width*.17,horizon-peak*.65],[x,horizon-peak],[x+width*.17,horizon-peak*.65],[x+width*.06,horizon-peak*.73],[x-width*.06,horizon-peak*.66]]);}
 }else for(let i=0;i<7;i++){const x=i*w/6,hh=h*(.055+(i*7%5)*.02);box(c,'#abc6c1',x,horizon-hh,w*.08,hh+3);}
}
export function worldScenery(c,project,z,side,zone){
 const p=project(side*9.5,z),u=p.scale;if(u<=0)return;const x=p.x,y=p.y;
 if(zone.id==='station'){
  if(Math.floor(z/32)%2)return;
  const xx=side<0?x-u*4:x;box(c,side>0?'#aebeb5':'#b3c3b9',xx,y-u*5,u*4,u*5);for(let j=0;j<2;j++)box(c,'#cfdbd0',xx+u*.6,y-u*(4-j*1.6),u*2.8,u*.75);
  const lamp=project(side*7,z+9);stroke(c,'#7b9690',Math.max(1,lamp.scale*.1),[[lamp.x,lamp.y],[lamp.x,lamp.y-lamp.scale*4.2]]);oval(c,'#fff0ad',lamp.x,lamp.y-lamp.scale*4.2,lamp.scale*.25,lamp.scale*.25);
 }else if(zone.id==='market'){
  const ww=u*4.2,hh=u*3.1,xx=side<0?x-ww:x;box(c,'#d8bb8b',xx,y-hh,ww,hh);box(c,'#7c9b8a',xx+ww*.12,y-hh*.75,ww*.76,hh*.48);
  for(let i=0;i<5;i++)poly(c,i%2?'#f5e7bd':'#cf8b6a',[[xx+i*ww/5,y-hh-ww*.25],[xx+(i+1)*ww/5,y-hh-ww*.25],[xx+(i+1)*ww/5,y-hh*.8],[xx+i*ww/5,y-hh*.8]]);
  for(let i=0;i<3;i++)oval(c,['#c6d393','#e8ae7a','#deb477'][i],xx+ww*(.22+i*.25),y-hh*.3,u*.35,u*.27);
 }else if(zone.id==='river'){
  stroke(c,'#d0d5b7',Math.max(1,u*.13),[[x,y],[x,y-u*2.3]]);oval(c,'#f4e4b5',x,y-u*2.3,u*.15,u*.15);
  if(Math.floor(z/32)%2===0){const b=project(side*14,z+6),q=b.scale;poly(c,'#eee4c4',[[b.x-q*2,b.y-q*.4],[b.x+q*2,b.y-q*.4],[b.x+q,b.y+q*.3],[b.x-q,b.y+q*.3]]);stroke(c,'#6e9ca6',Math.max(1,q*.1),[[b.x,b.y],[b.x,b.y-q*3]]);poly(c,'#fff4d6',[[b.x,b.y-q*3],[b.x,b.y-q*.5],[b.x+side*q*2,b.y-q*.5]]);}
 }else if(zone.id==='forest'){
  stroke(c,'#6c7352',Math.max(1,u*.65),[[x,y],[x+side*u*.2,y-u*5.3]]);for(const [dx,dy,r]of [[0,5.2,2],[-1.1,4.1,1.6],[1.4,4.5,1.8]])oval(c,dy>5?'#89aa72':'#6b926c',x+dx*u,y-dy*u,r*u,r*u*.7);
  if(Math.floor(z/32)%3===0){const r=project(side*6.7,z+12),q=r.scale;box(c,'#91a087',r.x-q*.5,r.y-q*2.4,q, q*2.4,q*.12);box(c,'#b8c59b',r.x-q*.75,r.y-q*2.5,q*1.5,q*.35,q*.08);}
 }else if(zone.id==='canyon'){
  poly(c,'#ba8063',[[x-side*u*1.5,y],[x-side*u*1.1,y-u*5.8],[x+side*u*1.9,y-u*5.8],[x+side*u*3.4,y]]);stroke(c,'#dfa17b',Math.max(1,u*.15),[[x-side*u*.8,y-u*3.5],[x+side*u*2.3,y-u*3.5]]);
  const r=project(side*7.1,z+12),q=r.scale;stroke(c,'#6c9073',Math.max(1,q*.32),[[r.x,r.y],[r.x,r.y-q*2.2]]);stroke(c,'#6c9073',Math.max(1,q*.27),[[r.x,r.y-q],[r.x+side*q*.65,r.y-q],[r.x+side*q*.65,r.y-q*1.7]]);
 }else{
  stroke(c,'#80958e',Math.max(1,u*.24),[[x,y],[x,y-u*4.5]]);for(let j=0;j<3;j++){const h=(4.7-j*1.1)*u,ww=(1.1+j*.45)*u;poly(c,j%2?'#91b2ac':'#7da49e',[[x,y-h],[x-ww,y-h+u*2],[x+ww,y-h+u*2]]);poly(c,'#f2f6e8',[[x,y-h],[x-ww*.7,y-h+u*1.4],[x+ww*.7,y-h+u*1.4]]);}
 }
}
