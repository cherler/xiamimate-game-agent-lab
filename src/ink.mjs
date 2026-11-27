import {clamp,noise,fingerprint} from './common.mjs';

export const INK_RULES=Object.freeze({width:900,height:540,cell:12,dt:1/30,duration:180,hp:100,ink:100,walk:126,swim:218,enemySpeed:.46,damage:26,range:222,shotInterval:5,shotInk:3.7,respawn:120,radius:13});
const R=INK_RULES,COLS=75,ROWS=45,NAV=36,NX=25,NY=15;
export const INK_MAPS={
 dock:{name:'彩潮码头',walls:[[216,72,108,72],[576,396,108,72],[216,324,72,108],[612,108,72,108],[396,216,108,108],[108,396,36,72],[756,72,36,72]]},
 yard:{name:'回环广场',walls:[[180,144,180,36],[540,360,180,36],[180,360,108,36],[612,144,108,36],[432,72,36,108],[432,360,36,108],[396,252,108,36]]}
};
const topology=new Map();
export const inkCell=(x,y)=>Math.floor(y/R.cell)*COLS+Math.floor(x/R.cell);
export function groundAt(s,x,y){return x<0||y<0||x>=R.width||y>=R.height?-1:s.paint[inkCell(x,y)];}
export function wallAt(map,x,y,r=0){return x<r||y<r||x>R.width-r||y>R.height-r||INK_MAPS[map].walls.some(([a,b,w,h])=>x>a-r&&x<a+w+r&&y>b-r&&y<b+h+r);}
export function inkLine(s,a,b){const d=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.ceil(d/6);for(let n=1;n<=steps;n++)if(wallAt(s.map,a.x+(b.x-a.x)*n/steps,a.y+(b.y-a.y)*n/steps))return false;return true;}
const spawn=(team,slot)=>({x:team?828:72,y:216+slot*36});
function nav(map){if(topology.has(map))return topology.get(map);const cells=Array.from({length:NX*NY},(_,i)=>({x:(i%NX+.5)*NAV,y:(Math.floor(i/NX)+.5)*NAV}));const pass=cells.map(p=>!wallAt(map,p.x,p.y,R.radius+1));const links=cells.map((_,i)=>[-NX,NX,-1,1].map(o=>i+o).filter(j=>j>=0&&j<cells.length&&pass[j]&&((Math.abs(j-i)!==1)||Math.floor(j/NX)===Math.floor(i/NX))));const out={cells,pass,links};topology.set(map,out);return out;}
function navIndex(s,p){const t=nav(s.map);let best=0,dist=Infinity;for(let i=0;i<t.cells.length;i++){if(!t.pass[i])continue;const c=t.cells[i],d=Math.hypot(c.x-p.x,c.y-p.y);if(d<dist&&inkLine(s,p,c)){best=i;dist=d;}}return best;}
function routes(s,p){const t=nav(s.map),start=navIndex(s,p),dist=Array(NX*NY).fill(-1),first=Array(NX*NY).fill(-1),q=[start];dist[start]=0;first[start]=start;for(let at=0;at<q.length;at++)for(const j of t.links[q[at]])if(dist[j]<0){dist[j]=dist[q[at]]+1;first[j]=q[at]===start?j:first[q[at]];q.push(j);}return {dist,first,start,t};}
export function createInk({seed=41003,map='dock',difficulty='normal'}={}){
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff||!INK_MAPS[map]||!['practice','normal'].includes(difficulty))throw Error('无效的喷射对局');
 const s={game:'ink',version:1,seed,map,difficulty,tick:0,winner:null,paint:Array(COLS*ROWS).fill(0),scores:[0,0],total:0,paintVersion:0,players:[],shots:[],events:[],sequence:0};
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const i=y*COLS+x;if(wallAt(map,(x+.5)*R.cell,(y+.5)*R.cell))s.paint[i]=-1;else s.total++;}
 for(let id=0;id<8;id++){const team=id<4?0:1,p={id,team,...spawn(team,id%4),angle:team?Math.PI:0,hp:100,ink:100,swimming:false,respawn:0,shield:60,lastShot:-90,lastHurt:-90,kills:0,deaths:0,painted:0,ai:{goal:-1,reload:false,action:null}};s.players.push(p);paintInk(s,p.x,p.y,26,team);}
 return s;
}
// Only reachable floor counts. Covering opposing ink subtracts from their score.
export function paintInk(s,x,y,r,team,owner=null){let changed=0;for(let cy=Math.max(0,Math.floor((y-r)/R.cell));cy<=Math.min(ROWS-1,Math.floor((y+r)/R.cell));cy++)for(let cx=Math.max(0,Math.floor((x-r)/R.cell));cx<=Math.min(COLS-1,Math.floor((x+r)/R.cell));cx++){const px=(cx+.5)*R.cell,py=(cy+.5)*R.cell,i=cy*COLS+cx,v=s.paint[i];if(v<0||v===team+1||Math.hypot(px-x,py-y)>r||!inkLine(s,{x,y},{x:px,y:py}))continue;if(v)s.scores[v-1]--;s.paint[i]=team+1;s.scores[team]++;changed++;}if(changed){s.paintVersion++;if(owner)s.players[owner.id].painted+=changed;}return changed;}
function event(s,type,x,y,team,extra={}){s.events.push({id:++s.sequence,tick:s.tick,type,x,y,team,...extra});}
function hurt(s,p,amount,source){if(p.respawn||p.shield>0)return;p.hp-=amount;p.lastHurt=s.tick;event(s,'hit',p.x,p.y,source.team,{target:p.id});if(p.hp>0)return;p.hp=0;p.respawn=R.respawn;p.deaths++;p.swimming=false;source.kills++;paintInk(s,p.x,p.y,40,source.team,source);event(s,'splat',p.x,p.y,source.team,{target:p.id,by:source.id});}
export function normalizeInkInput(a={}){const n=v=>Number.isFinite(v)?v:0;let x=clamp(n(a.x),-1,1),y=clamp(n(a.y),-1,1),len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}return {x:Math.round(x*1000)/1000,y:Math.round(y*1000)/1000,angle:Math.round((n(a.angle)%(Math.PI*2))*10000)/10000,fire:!!a.fire,dive:!!a.dive};}
function valueAt(s,p,c){let score=0;for(let y=-12;y<=12;y+=12)for(let x=-12;x<=12;x+=12){const v=groundAt(s,c.x+x,c.y+y);if(v>=0&&v!==p.team+1)score+=v===0?1:1.7;}return score;}
export function inkBot(s,p){
 const enemy=s.players.filter(e=>e.team!==p.team&&!e.respawn&&!(e.swimming&&Math.hypot(e.x-p.x,e.y-p.y)>85)&&Math.hypot(e.x-p.x,e.y-p.y)<300&&inkLine(s,p,e)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
 const ground=groundAt(s,p.x,p.y),own=ground===p.team+1;
 if(p.ink<19||(p.hp<35&&!enemy))p.ai.reload=true;if(p.ink>92&&p.hp>65)p.ai.reload=false;
 if(p.ai.reload&&own)return {x:0,y:0,angle:p.angle,fire:false,dive:true};
 const rt=routes(s,p),{cells}=rt.t;
 if(p.ai.reload){let best=-1,dist=Infinity;for(let i=0;i<cells.length;i++)if(rt.dist[i]>=0&&groundAt(s,cells[i].x,cells[i].y)===p.team+1&&rt.dist[i]<dist){best=i;dist=rt.dist[i];}p.ai.goal=best;}
 else if(p.ai.goal<0||rt.dist[p.ai.goal]<0||rt.dist[p.ai.goal]<1||valueAt(s,p,cells[p.ai.goal])<2||s.tick%90<6){
  let best=-Infinity,goal=rt.start;const lane=[270,90,450,270][p.id%4];
  for(let i=0;i<cells.length;i++){if(rt.dist[i]<0)continue;const c=cells[i],v=valueAt(s,p,c);if(v<2)continue;const score=v*3-rt.dist[i]*1.3-Math.abs(c.y-lane)*.015+noise(s.seed,Math.floor(s.tick/90),p.id*500+i)*4;if(score>best){best=score;goal=i;}}p.ai.goal=goal;
 }
 const goal=cells[p.ai.goal]||cells[rt.start],next=inkLine(s,p,goal)?goal:cells[rt.first[p.ai.goal]]||goal;
 let dx=next.x-p.x,dy=next.y-p.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),fire=!p.ai.reload,dive=p.ai.reload;
 if(enemy&&!p.ai.reload){const ex=enemy.x-p.x,ey=enemy.y-p.y,ed=Math.hypot(ex,ey),error=(noise(s.seed,Math.floor(s.tick/6),p.id)-.5)*(s.difficulty==='practice'&&p.team===1?.6:.24);angle=Math.atan2(ey,ex)+error;fire=ed<R.range+10;const side=noise(s.seed,Math.floor(s.tick/45),p.id)>.5?1:-1;if(ed<195){dx=ex/ed*(ed<110?-1:.25)-ey/ed*side*.7;dy=ey/ed*(ed<110?-1:.25)+ex/ed*side*.7;d=Math.hypot(dx,dy);}}
 else if(!p.ai.reload){let aim=null,best=0;for(let i=0;i<cells.length;i++){const c=cells[i],dd=Math.hypot(c.x-p.x,c.y-p.y);if(dd>205||dd<18)continue;const v=valueAt(s,p,c)-dd*.012;if(v>best&&inkLine(s,p,c)){best=v;aim=c;}}if(aim)angle=Math.atan2(aim.y-p.y,aim.x-p.x);else{fire=false;dive=own;}}
 return {x:d>3?dx/d:0,y:d>3?dy/d:0,angle,fire,dive};
}
function move(s,p,a){
 const ground=groundAt(s,p.x,p.y),own=ground===p.team+1,hostile=ground>0&&!own;
 p.swimming=!!a.dive&&own;const speed=p.swimming?R.swim:hostile?R.walk*R.enemySpeed:R.walk;
 const x=p.x+a.x*speed*R.dt,y=p.y+a.y*speed*R.dt;
 if(!wallAt(s.map,x,p.y,R.radius))p.x=x;if(!wallAt(s.map,p.x,y,R.radius))p.y=y;
 p.angle=a.angle;p.shield=Math.max(0,p.shield-1);
 if(hostile){p.hp=Math.max(Math.min(p.hp,60),p.hp-12*R.dt);p.lastHurt=s.tick;}
 if(s.tick-p.lastHurt>48)p.hp=Math.min(100,p.hp+(p.swimming?32:16)*R.dt);
 if(a.fire&&!a.dive&&p.ink>=R.shotInk&&s.tick-p.lastShot>=R.shotInterval+(s.difficulty==='practice'&&p.team===1?2:0)){
  p.ink-=R.shotInk;p.lastShot=s.tick;p.shield=0;const angle=p.angle+(noise(s.seed,s.tick,p.id)-.5)*.11,cos=Math.cos(angle),sin=Math.sin(angle);
  s.shots.push({x:p.x+cos*15,y:p.y+sin*15,vx:cos*720,vy:sin*720,left:R.range,team:p.team,owner:p.id});paintInk(s,p.x,p.y,18,p.team,p);if(p.id===0)event(s,'fire',p.x,p.y,p.team);
 }else if(s.tick-p.lastShot>16&&!hostile)p.ink=Math.min(100,p.ink+(p.swimming?42:9)*R.dt);
}
export function stepInk(s,input={},autoplay=false){
 if(s.winner!==null)return s;
 s.events=s.events.filter(e=>s.tick-e.tick<36);
 for(const p of s.players){if(p.respawn){p.respawn--;if(!p.respawn){Object.assign(p,spawn(p.team,p.id%4),{hp:100,ink:100,shield:75,angle:p.team?Math.PI:0});p.ai={goal:-1,reload:false,action:null};paintInk(s,p.x,p.y,25,p.team);event(s,'respawn',p.x,p.y,p.team,{target:p.id});}continue;}
  let a;if(p.id===0&&!autoplay)a=normalizeInkInput(input);else{if(!p.ai.action||(s.tick+p.id)%6===0)p.ai.action=normalizeInkInput(inkBot(s,p));a=p.ai.action;}move(s,p,a);
 }
 const live=[];for(const b of s.shots){let dead=false;for(let n=0;n<4;n++){const ox=b.x,oy=b.y;b.x+=b.vx*R.dt/4;b.y+=b.vy*R.dt/4;b.left-=6;if(wallAt(s.map,b.x,b.y,2)){paintInk(s,ox,oy,18,b.team,s.players[b.owner]);dead=true;break;}paintInk(s,b.x,b.y,13,b.team,s.players[b.owner]);const hit=s.players.find(p=>p.team!==b.team&&!p.respawn&&Math.hypot(p.x-b.x,p.y-b.y)<R.radius+4);if(hit){hurt(s,hit,R.damage,s.players[b.owner]);paintInk(s,b.x,b.y,25,b.team,s.players[b.owner]);dead=true;break;}if(b.left<=0){paintInk(s,b.x,b.y,26,b.team,s.players[b.owner]);dead=true;break;}}if(!dead)live.push(b);}s.shots=live;
 s.tick++;if(s.tick>=R.duration/R.dt){s.winner=s.scores[0]===s.scores[1]?-1:s.scores[0]>s.scores[1]?0:1;s.shots=[];event(s,'finish',450,270,s.winner);}return s;
}
export function beginInk(config={}){const state=createInk(config);return {state,record:{format:'ink-1',game:'ink',config:{seed:state.seed,map:state.map,difficulty:state.difficulty},inputs:[],ticks:0,end:null}};}
export function advanceInk(match,input){if(match.state.winner!==null)return match.state;const a=normalizeInkInput(input),last=match.record.inputs.at(-1);if(!last||JSON.stringify(last.action)!==JSON.stringify(a))match.record.inputs.push({tick:match.state.tick,action:a});stepInk(match.state,a);match.record.ticks=match.state.tick;return match.state;}
export function sealInk(match){return structuredClone({...match.record,end:fingerprint(match.state)});}
export function validateInkRecord(r){if(r?.format!=='ink-1'||r.game!=='ink'||!r.config||!Number.isInteger(r.ticks)||r.ticks<0||r.ticks>5400||!Array.isArray(r.inputs)||r.inputs.length>r.ticks||r.end!==null&&typeof r.end!=='string')throw Error('无效的喷射回放');createInk(r.config);let prev=-1;for(const i of r.inputs){if(!Number.isInteger(i.tick)||i.tick<=prev||i.tick>=r.ticks||JSON.stringify(normalizeInkInput(i.action))!==JSON.stringify(i.action))throw Error('无效的喷射操作');prev=i.tick;}return r;}
export function* playbackInk(r){validateInkRecord(r);const s=createInk(r.config);let at=0,a={};yield s;while(s.tick<r.ticks){if(r.inputs[at]?.tick===s.tick)a=r.inputs[at++].action;stepInk(s,a);yield s;}if(r.end&&fingerprint(s)!==r.end)throw Error('喷射回放校验失败');}
export function replayInk(r){let s;for(const v of playbackInk(r))s=v;return s;}
