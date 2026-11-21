import {noise,fingerprint} from './common.mjs';
import {RESCUE_HZ,rescueMap,insideExit,UPGRADES} from './rescue-maps.mjs';
export {RESCUE_HZ,rescueMap,insideExit,UPGRADES};
export const RESCUE_FORMAT='rescue-7';
const round=v=>Math.round(v*10000)/10000;
const dist=(a,b)=>Math.round(Math.hypot(a.x-b.x,a.y-b.y)*1e6)/1e6;
const cell=(m,u)=>Math.floor(u.y)*m.w+Math.floor(u.x);
const center=(m,c)=>({x:c%m.w+.5,y:Math.floor(c/m.w)+.5});
const living=u=>u.hp>0;
const civilian=u=>['waiting','following','boarding'].includes(u.status);
export const rescueRaging=s=>s.version>=3&&s.evac.rageUntil>s.tick;
function event(s,kind,at,extra={}){s.events.push({id:s.eventId++,tick:s.tick,kind,x:at.x,y:at.y,...extra});}
function note(s,text,kind='info'){s.log.push({tick:s.tick,text,kind});s.log=s.log.slice(-8);}
export function walkable(s,x,y,team='human',radius=0){
 const m=rescueMap(s.level,s.version),spots=radius?[[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]]:[[x,y]];
 return spots.every(([px,py])=>m.tiles[Math.floor(py)]?.[Math.floor(px)]==='.'&&!(team==='zombie'&&s.gates.some(g=>g.hp>0&&g.cell===Math.floor(py)*m.w+Math.floor(px))));
}
export function lineOfSight(s,a,b){
 const length=dist(a,b),steps=Math.max(1,Math.ceil(length/.12));
 for(let i=0;i<=steps;i++)if(!walkable(s,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;
 return true;
}
function neighbors(m,c){const x=c%m.w,y=Math.floor(c/m.w);return [[x,y-1],[x-1,y],[x+1,y],[x,y+1]].filter(([x,y])=>x>=0&&x<m.w&&y>=0&&y<m.h).map(([x,y])=>y*m.w+x);}
function field(s,start,team){
 const m=rescueMap(s.level,s.version),cost=Array(m.w*m.h).fill(-1),parent=Array(m.w*m.h).fill(-1),queue=[start];cost[start]=0;
 for(let i=0;i<queue.length;i++)for(const c of neighbors(m,queue[i])){const p=center(m,c);if(cost[c]<0&&walkable(s,p.x,p.y,team)){cost[c]=cost[queue[i]]+1;parent[c]=queue[i];queue.push(c);}}
 return {cost,parent};
}
export function pathTo(s,from,to,team='human'){
 const m=rescueMap(s.level,s.version);if(!walkable(s,to.x,to.y,team)||!walkable(s,from.x,from.y,team))return [];
 const start=cell(m,from),end=cell(m,to);if(start===end)return [{x:to.x,y:to.y}];
 const {cost,parent}=field(s,start,team);if(cost[end]<0)return [];
 const cells=[];for(let p=end;p!==start;p=parent[p])cells.unshift(center(m,p));cells[cells.length-1]={x:to.x,y:to.y};return cells;
}
function route(s,u,to,team='human'){
 if(!to){u.path=[];return;}u.goal={x:round(to.x),y:round(to.y)};u.path=pathTo(s,u,u.goal,team);u.nav=s.nav;
}
function move(s,u,speed,team='human'){
 if(!u.path?.length)return;
 const target=u.path[0],length=dist(u,target),step=Math.min(length,speed/RESCUE_HZ);
 if(length<.08){u.path.shift();return;}
 const dx=(target.x-u.x)/length*step,dy=(target.y-u.y)/length*step;
 const tryMove=(x,y)=>{if(walkable(s,x,y,team,u.r)){u.x=round(x);u.y=round(y);return true;}return false;};
 if(!tryMove(u.x+dx,u.y+dy)&&!tryMove(u.x+dx,u.y))tryMove(u.x,u.y+dy);
 if(dist(u,target)<.1)u.path.shift();u.angle=round(Math.atan2(dy,dx));
}
function spacing(s){
 const people=[...s.soldiers.filter(living),...s.civilians.filter(civilian),...s.zombies.filter(living)];
 // Dense waves only need nearby collision pairs. Keep index order deterministic.
 const buckets=new Map(),key=u=>Math.floor(u.y)*32+Math.floor(u.x),update=u=>{if(s.version<7)return;const k=key(u);if(u.bucket===k)return;if(u.bucket!==undefined)buckets.get(u.bucket)?.delete(u.index);if(!buckets.has(k))buckets.set(k,new Set());buckets.get(k).add(u.index);u.bucket=k;};
 const refs=people.map((u,index)=>({x:u.x,y:u.y,index}));if(s.version>=7)refs.forEach(update);
 for(let i=0;i<people.length;i++){
  let candidates;
  if(s.version>=7){const u=people[i],near=new Set();for(let y=Math.floor(u.y)-2;y<=Math.floor(u.y)+2;y++)for(let x=Math.floor(u.x)-2;x<=Math.floor(u.x)+2;x++)for(const j of buckets.get(y*32+x)||[])if(j>i)near.add(j);candidates=[...near].sort((a,b)=>a-b);}
  else candidates=Array.from({length:people.length-i-1},(_,n)=>n+i+1);
  for(const j of candidates){
  if(s.version>=7&&(Math.abs(people[i].x-people[j].x)>1||Math.abs(people[i].y-people[j].y)>1))continue;
  const a=people[i],b=people[j],d=dist(a,b),friendly=a.kind!=='zombie'&&b.kind!=='zombie',limit=(a.r+b.r)*(friendly?.64:1);if(d>=limit)continue;
  const nx=d>.0001?(b.x-a.x)/d:1,ny=d>.0001?(b.y-a.y)/d:0,push=(limit-d)*.5+.001;
  // Escort crowds yield to troops; hard friendly collisions can deadlock a doorway.
  for(const [u,sign]of [[a,-1],[b,1]]){const other=u===a?b:a,ratio=friendly&&u.kind==='soldier'&&other.kind==='civilian'?0:u.kind==='soldier'&&u.path.length===0?.12:1,x=u.x+sign*nx*push*ratio,y=u.y+sign*ny*push*ratio;
   if(walkable(s,x,y,u.kind==='zombie'?'zombie':'human',u.r)){u.x=round(x);u.y=round(y);if(s.version>=7){const ref=refs[u===a?i:j];ref.x=u.x;ref.y=u.y;update(ref);}}
  }
 }
 }
}
export function initRescue({level=1,seed=41003,difficulty='normal',upgrades=[],version=7}={}){
 const m=rescueMap(level,version);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['normal','challenge'].includes(difficulty)||!Array.isArray(upgrades)||upgrades.length>(version>=7?5:2)||upgrades.some(x=>!UPGRADES[x]))throw Error('开局设置无效');
 const boost=id=>upgrades.filter(x=>x===id).length;
 if(![1,2,3,4,5,6,7].includes(version))throw Error('救援规则版本无效');
 const s={game:'rescue',version,level,seed,difficulty,upgrades:[...upgrades],tick:0,phase:'deploy',winner:null,reason:'',nav:0,uid:0,eventId:0,events:[],log:[],gates:[],gateCharges:2+boost('gate'),saved:0,lost:0,kills:0,wave:0,spawned:0,schedule:[],zombies:[],bullets:[],soldiers:[],civilians:[],stats:{shots:0,hits:0,infected:0}};
 if(version>=3)s.evac={phase:'idle',progress:0,required:m.extraction.seconds*RESCUE_HZ,batches:0,alerts:0,alertTick:null,rageUntil:0};
 if(version>=4){s.evac.active=false;s.supplies=2;s.crates=m.supplies.map(c=>({...c,claimed:false}));s.decoys=[];s.supportUid=0;s.supportUsed={decoy:0,medic:0};}
 s.soldiers=m.spawn.map((p,i)=>({id:'s'+i,kind:'soldier',group:p.group,role:p.group===2?'shield':'rifle',x:p.x,y:p.y,r:p.group===2?.28:.23,hp:p.group===2?240:110,maxHp:p.group===2?240:110,angle:-Math.PI/2,path:[],goal:null,nav:0,cooldown:0,ammo:version>=5?10:p.group===2?8:6,reload:0,hitTick:-100}));
 if(version>=6){s.autoMedicAt=0;for(const u of s.soldiers)Object.assign(u,{anchor:{x:u.x,y:u.y},intent:'guard',orderedAt:-30});}
 for(const group of m.groups)for(let i=0;i<group.n;i++){const x=group.x+(i%3)*.7,y=group.y+Math.floor(i/3)*.65;s.civilians.push({id:'c'+s.civilians.length,kind:'civilian',x,y,r:.18,status:'waiting',leader:null,path:[],goal:null,nav:0,infection:0,threat:null,hitTick:-100});}
 if(version>=6)for(const c of s.civilians)c.shelter={x:c.x,y:c.y};
 if(version>=7){
  const roles=['rifle','rifle','gunner','grenadier','shield'];
  for(const [i,u]of s.soldiers.entries()){u.role=roles[i];u.hp=u.maxHp=u.role==='shield'?320:140;u.ammo=weapon(u).ammo;}
  s.objectives=m.objectives.map((o,i)=>({...structuredClone(o),kind:o.type,done:false,active:false,progress:0,required:o.type==='power'?o.seconds*RESCUE_HZ:o.type==='convoy'?o.waypoints.length:o.hp,maxHp:o.hp||0,r:o.type==='convoy'?.32:.4,path:[],goal:null,nav:0,angle:0,checkpoint:0,nextSpawn:(2+i*2)*RESCUE_HZ}));
 }

 m.waves.forEach((wave,index)=>{for(let i=0;i<wave.count;i++){
  const regular=m.entrances.map((e,j)=>!e.evacOnly?j:-1).filter(j=>j>=0),entry=version>=7&&i%4===0?regular[(regular.indexOf(wave.entry)+1)%regular.length]:wave.entry;
  const item={tick:Math.round((wave.at+i*(version>=7?.16:.5))*RESCUE_HZ),entry,fast:i<wave.fast,wave:index+1};if(version>=7)item.brute=level>=3&&i>=wave.fast&&i%13===0;s.schedule.push(item);
 }});if(version>=7)s.schedule.sort((a,b)=>a.tick-b.tick||a.wave-b.wave);

 note(s,'小队已就位，等待行动');return s;
}
function newZombie(s,at,fast=false,infection=false,brute=false){
 const hp=(brute?180:fast?26:45)*(s.difficulty==='challenge'?1.15:1),z={id:'z'+s.uid++,kind:'zombie',x:at.x,y:at.y,r:fast?.19:.23,hp,maxHp:hp,fast,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:infection?15:0,hitTick:-100};
 if(s.version>=7){z.brute=brute;if(brute)z.r=.31;
  // A newly infected civilian can be closer to a wall than a larger zombie fits.
  if(!walkable(s,z.x,z.y,'zombie',z.r)){const m=rescueMap(s.level,s.version),c=cell(m,z),spots=[c,...neighbors(m,c)].map(c=>center(m,c)).filter(p=>walkable(s,p.x,p.y,'zombie',z.r)).sort((a,b)=>dist(a,z)-dist(b,z));if(spots[0])Object.assign(z,spots[0]);}
 }
 s.zombies.push(z);event(s,infection?'infection':'spawn',z,{who:z.id});return z;
}
export function commandRescue(s,command){
 const t=structuredClone(s);applyCommand(t,command);return t;
}
function applyCommand(s,a){
 if(!a||typeof a!=='object'||s.winner!==null)throw Error('本次行动已经结束');
 if(a.type==='start'){if(s.phase!=='deploy')throw Error('行动已开始');s.phase='running';note(s,'行动开始');return;}
 if(a.type==='pause'){if(s.phase!=='running')throw Error('现在不能暂停');s.phase='paused';return;}
 if(a.type==='resume'){if(s.phase!=='paused')throw Error('现在不能继续');s.phase='running';return;}
 if(a.type==='evacuate'){
  const m=rescueMap(s.level,s.version);if(s.version<4||!['running','paused'].includes(s.phase)||s.evac.phase!=='gathering'||!s.soldiers.some(u=>living(u)&&insideExit(m,u)))throw Error('平民集结并有队员守卫后才能呼叫接驳');
  s.evac.phase='called';note(s,'已呼叫接驳，准备抵挡尸潮','rescue');return;
 }
 if(['decoy','medic'].includes(a.type)){
  if(s.version<4||!['running','paused'].includes(s.phase)||s.supplies<1)throw Error('行动开始后才能使用战术补给');
  if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||!walkable(s,a.x,a.y,'human',.25)||!s.soldiers.some(u=>living(u)&&dist(u,a)<=4&&lineOfSight(s,u,a)))throw Error('选择队员 4 格内、无遮挡的地面');
  if(a.type==='decoy'){
   if(!walkable(s,a.x,a.y,'zombie'))throw Error('诱饵不能放在门障上');
   s.decoys.push({id:'decoy'+s.supportUid++,kind:'decoy',x:round(a.x),y:round(a.y),hp:1,expires:s.tick+6*RESCUE_HZ});s.nav++;event(s,'decoy',a);note(s,'诱饵信标启动，牵引附近尸群 6 秒','gate');
  }else{
   const near=u=>dist(u,a)<=2.4&&lineOfSight(s,u,a),injured=s.soldiers.filter(u=>living(u)&&u.hp<u.maxHp&&near(u)),threatened=s.civilians.filter(c=>civilian(c)&&c.infection>0&&near(c));
   if(!injured.length&&!threatened.length)throw Error('这个范围内没有需要急救的人');
   for(const u of injured){const amount=Math.min(55,u.maxHp-u.hp);u.hp+=amount;event(s,'medic',u,{amount});}
   for(const c of threatened){c.infection=0;event(s,'medic',c,{amount:0});}note(s,'急救完成，恢复队员生命并清除接触感染进度','rescue');
  }
  s.supplies--;s.supportUsed[a.type]++;return;
 }
 if(a.type==='move'||a.type==='hold'){
  if(!Array.isArray(a.ids)||!a.ids.length||new Set(a.ids).size!==a.ids.length||a.ids.some(id=>!s.soldiers.some(u=>u.id===id&&living(u))))throw Error('请选择可行动的小队');
  const chosen=s.soldiers.filter(u=>a.ids.includes(u.id));
  if(a.type==='hold'){chosen.forEach(u=>{u.path=[];u.goal=null;if(s.version>=6){u.anchor={x:u.x,y:u.y};u.intent='guard';u.orderedAt=s.tick;}});event(s,'hold',chosen[0]);return;}
  if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||!walkable(s,a.x,a.y,'human',.3))throw Error('墙体内不能落点');
  const deployment=s.version>=2&&s.phase==='deploy';
  if(deployment&&!insideExit(rescueMap(s.level,s.version),a))throw Error('在绿色接应区部署，开始行动后前往平民所在房间');
  const spots=[];for(const u of chosen){
   const candidates=[{x:a.x,y:a.y},...[.65,1.3,1.95].flatMap(r=>Array.from({length:8},(_,i)=>({x:a.x+Math.cos(i*Math.PI/4)*r,y:a.y+Math.sin(i*Math.PI/4)*r})))];
   const target=candidates.find(p=>(!deployment||insideExit(rescueMap(s.level,s.version),p))&&walkable(s,p.x,p.y,'human',.3)&&spots.every(q=>dist(p,q)>.52)&&pathTo(s,u,p).length);
   if(!target)throw Error('无法到达这个位置');spots.push(target);route(s,u,target);
   if(s.version>=6){u.anchor={...u.goal};u.intent='move';u.orderedAt=s.tick;}
   if(s.phase==='deploy'){u.x=round(target.x);u.y=round(target.y);u.path=[];}
  }
  event(s,'order',{x:a.x,y:a.y},{count:chosen.length});return;
 }
 if(a.type==='gate'){
  const d=rescueMap(s.level,s.version).doors.find(d=>d.id===a.door);if(!d||s.gateCharges<=0||s.gates.some(g=>g.cell===d.cell&&g.hp>0))throw Error('无法在此部署门障');
  if(s.phase!=='deploy'&&!s.soldiers.some(u=>living(u)&&dist(u,d)<3))throw Error('小队靠近门口后才能部署');
  const hp=Math.round(150*(1+.6*s.upgrades.filter(x=>x==='gate').length));s.gates.push({...d,hp,maxHp:hp});s.gateCharges--;s.nav++;event(s,'build',d);note(s,'门障部署完成','gate');return;
 }
 throw Error('无法识别的指令');
}

// Local awareness only: walls block perception, and assistance stays near the
// player's order. No autonomous missions or pursuit across the map.
function visibleThreats(s,u,radius=5){return s.zombies.filter(z=>living(z)&&dist(u,z)<radius&&lineOfSight(s,u,z));}
function safeStep(s,u,threats,toward,{radius=1.2,anchor=null,stayInExit=false}={}){
 const m=rescueMap(s.level,s.version),candidates=[{x:u.x,y:u.y},...Array.from({length:12},(_,i)=>({x:round(u.x+Math.cos(i*Math.PI/6)*radius),y:round(u.y+Math.sin(i*Math.PI/6)*radius)}))];
 const score=p=>Math.min(4,...threats.map(z=>dist(p,z)))*2.4-(toward?dist(p,toward)*.7:0)-(anchor?dist(p,anchor)*.3:0);
 const valid=candidates.filter(p=>walkable(s,p.x,p.y,'human',u.r+.03)&&lineOfSight(s,u,p)&&(!anchor||dist(p,anchor)<=2.5)&&(!stayInExit||insideExit(m,p)));
 valid.sort((a,b)=>score(b)-score(a));const best=valid[0];
 return best&&dist(best,u)>.2&&score(best)>score(u)+.25?best:null;
}
function assistSoldiers(s){
 const livingTroops=s.soldiers.filter(living),m=rescueMap(s.level,s.version);
 if(s.tick>=s.autoMedicAt&&s.supplies>0){
  const hurt=livingTroops.filter(u=>u.hp/u.maxHp<=.55&&walkable(s,u.x,u.y,'human',.25)).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  const exposed=s.civilians.find(c=>civilian(c)&&c.infection>0&&walkable(s,c.x,c.y,'human',.25)&&livingTroops.some(u=>dist(c,u)<4&&lineOfSight(s,u,c)));
  const patient=exposed||hurt;
  if(patient){applyCommand(s,{type:'medic',x:patient.x,y:patient.y});s.autoMedicAt=s.tick+4*RESCUE_HZ;event(s,'autoAid',patient);}
 }
 if(s.tick%6)return;
 for(const u of livingTroops){
  if(s.tick-u.orderedAt<18)continue;
  const threats=visibleThreats(s,u),close=threats.some(z=>dist(u,z)<2.3);
  const vulnerable=u.hp/u.maxHp<.35||u.reload>0&&u.role!=='shield';
  if(close&&vulnerable){
   const cover=livingTroops.filter(v=>v!==u&&v.hp/v.maxHp>.45&&dist(u,v)<4&&lineOfSight(s,u,v)).sort((a,b)=>(a.role==='shield'?-3:0)+dist(u,a)-(b.role==='shield'?-3:0)-dist(u,b))[0];
   const target=safeStep(s,u,threats,cover||u.anchor,{anchor:u.path.length&&u.intent==='move'?null:u.anchor,stayInExit:insideExit(m,u)&&insideExit(m,u.anchor)});
   if(target){route(s,u,target);u.intent='cover';continue;}
  }
  if(u.intent==='move'&&u.path.length)continue;
  if(u.role==='shield'&&u.hp/u.maxHp>.4){
   const people=s.civilians.filter(c=>civilian(c)&&c.status!=='waiting'&&dist(c,u)<3&&lineOfSight(s,u,c));
   const danger=threats.filter(z=>people.some(c=>dist(c,z)<3)).sort((a,b)=>dist(u,a)-dist(u,b))[0];
   if(danger){
    const c=people.sort((a,b)=>dist(a,danger)-dist(b,danger))[0],d=dist(c,danger)||1,reach=Math.min(.8,Math.max(0,d-.85));
    const p={x:round(c.x+(danger.x-c.x)/d*reach),y:round(c.y+(danger.y-c.y)/d*reach)};
    if(dist(p,u.anchor)<=2.5&&dist(p,danger)>.7&&walkable(s,p.x,p.y,'human',u.r+.03)&&lineOfSight(s,u,p)&&(!insideExit(m,u.anchor)||insideExit(m,p))){route(s,u,p);u.intent='protect';continue;}
   }
  }
  if(u.intent==='cover'||u.intent==='protect'){route(s,u,u.anchor);u.intent='move';}
  if(!u.path.length)u.intent='guard';
 }
}
function assistCivilian(s,c,m,mobility){
 const threats=visibleThreats(s,c,3.2),troops=s.soldiers.filter(u=>living(u)&&dist(c,u)<6&&lineOfSight(s,c,u));
 const safety=u=>Math.min(4,...threats.map(z=>dist(u,z)))*1.2-dist(c,u)*.5;
 troops.sort((a,b)=>safety(b)-safety(a)||a.id.localeCompare(b.id));
 let leader=s.soldiers.find(u=>u.id===c.leader&&living(u));
 if(c.status==='following'&&(!leader||threats.length&&troops[0]&&safety(troops[0])>safety(leader)+1)){leader=troops[0]||s.soldiers.filter(living).sort((a,b)=>dist(c,a)-dist(c,b))[0];c.leader=leader?.id;}
 if(threats.length&&s.tick%6===0){
  const target=safeStep(s,c,threats,leader||troops[0],{radius:.9,anchor:c.status==='waiting'?c.shelter:null,stayInExit:c.status==='boarding'});
  if(target){route(s,c,target);c.avoidingUntil=s.tick+12;}
 }
 if(c.avoidingUntil>s.tick){move(s,c,2.8*mobility);return;}
 if(c.status==='boarding'){
  const n=Number(c.id.slice(1));if(!c.goal||c.avoidingUntil){route(s,c,{x:m.exit.x+.7+(n%4)*.65,y:m.exit.y+1.8+Math.floor(n%12/4)*.45});c.avoidingUntil=0;}
  move(s,c,2.55*mobility);return;
 }
 if(c.status==='following'&&leader){
  if(s.tick%9===0||c.nav!==s.nav||!c.goal||c.avoidingUntil){
   const n=Number(c.id.slice(1)),nearExit=insideExit(m,leader),goal=nearExit?{x:m.exit.x+.7+(n%4)*.65,y:m.exit.y+.6+Math.floor(n%12/4)*.7}:leader;
   if(nearExit||dist(c,leader)>1.1)route(s,c,goal);else c.path=[];c.avoidingUntil=0;
  }
  move(s,c,(dist(c,leader)>3?3.05:2.55)*mobility);
 }else{c.path=[];c.goal=null;c.avoidingUntil=0;}
}
function zombieTargets(s,z){
 if(s.version>=7&&!s.decoys.length){siegeTarget(s,z);return;}
 const m=rescueMap(s.level,s.version),f=field(s,cell(m,z),'zombie');
 if(s.version>=4){const lure=s.decoys.filter(d=>d.expires>s.tick&&dist(z,d)<=6&&f.cost[cell(m,d)]>=0).sort((a,b)=>f.cost[cell(m,a)]-f.cost[cell(m,b)]||a.id.localeCompare(b.id))[0];if(lure){z.target=lure.id;route(s,z,lure,'zombie');return;}}
 const candidates=[...s.civilians.filter(civilian),...s.soldiers.filter(living),...(s.version>=7?s.objectives.filter(o=>o.type==='convoy'&&!o.done&&o.hp>0):[])];
 const ranked=candidates.filter(u=>f.cost[cell(m,u)]>=0).sort((a,b)=>(f.cost[cell(m,a)]*1.0+(a.kind==='soldier'?1.5:0)+dist(z,a)*.08)-(f.cost[cell(m,b)]*1.0+(b.kind==='soldier'?1.5:0)+dist(z,b)*.08)||a.id.localeCompare(b.id));
 if(ranked.length){const target=ranked[0];z.target=target.id;route(s,z,target,'zombie');return;}
 const gates=s.gates.filter(g=>g.hp>0).flatMap(g=>neighbors(m,g.cell).filter(c=>f.cost[c]>=0).map(c=>({g,c,cost:f.cost[c]}))).sort((a,b)=>a.cost-b.cost);
 if(gates[0]){z.target=gates[0].g.id;route(s,z,center(m,gates[0].c),'zombie');}else{z.target=null;z.path=[];}
}
function shots(s){
 if(s.version>=7){siegeShots(s);return;}
 const modern=s.version>=5;
 for(const u of s.soldiers.filter(living)){
  if(u.reload>0){u.reload--;if(!u.reload)u.ammo=modern?10:u.role==='rifle'?6:8;continue;}
  if(u.cooldown>0){u.cooldown--;continue;}
  const range=u.role==='rifle'?6.2:3.0;
  const targets=s.zombies.filter(z=>living(z)&&dist(u,z)<=range&&lineOfSight(s,u,z));
  targets.sort((a,b)=>{const priority=z=>s.civilians.some(c=>civilian(c)&&dist(c,z)<2)?-4:0;return dist(u,a)+priority(a)-dist(u,b)-priority(b)||a.id.localeCompare(b.id);});
  const target=targets[0];if(!target)continue;
  // Quantize transcendental results and directions for Node/browser replay parity.
  const d=dist(u,target),dx=round((target.x-u.x)/(d||1)),dy=round((target.y-u.y)/(d||1));u.angle=round(Math.atan2(dy,dx));
  const damage=modern?(u.role==='rifle'?12:14):(u.role==='rifle'?10:9);
  s.bullets.push({id:'b'+s.uid++,x:u.x,y:u.y,dx,dy,origin:u.id,left:range+.3,damage:damage*(1+.2*s.upgrades.filter(x=>x==='fire').length)});
  s.stats.shots++;u.ammo--;u.cooldown=modern?(u.role==='rifle'?10:18):(u.role==='rifle'?15:26);event(s,'shot',u,{to:target.id,angle:u.angle,source:u.id});
  if(u.ammo<=0)u.reload=modern?30:u.role==='rifle'?42:36;
 }
}
function projectileHits(s){
 const remaining=[],targets=[...s.zombies,...(s.version>=7?s.objectives.filter(o=>o.type==='nest'&&!o.done):[])];
 for(const b of s.bullets){
  const step=16/RESCUE_HZ;let consumed=false;
  for(let i=0;i<6;i++){
   b.x=round(b.x+b.dx*step/6);b.y=round(b.y+b.dy*step/6);b.left-=step/6;
   if(!walkable(s,b.x,b.y)||b.left<=0){event(s,'wall',b);consumed=true;break;}
   const hit=targets.find(z=>living(z)&&!(b.hitIds||[]).includes(z.id)&&(s.version<7||Math.abs(b.x-z.x)<.6&&Math.abs(b.y-z.y)<.6)&&dist(b,z)<z.r+.1);if(hit){
    const victims=b.kind==='grenade'?[...s.zombies,...s.objectives.filter(o=>o.type==='nest'&&!o.done)].filter(z=>living(z)&&dist(hit,z)<1.45&&lineOfSight(s,hit,z)):[hit];
    for(const victim of victims){victim.hp=Math.max(0,round(victim.hp-b.damage));victim.hitTick=s.tick;s.stats.hits++;event(s,'hit',victim,{amount:b.damage,source:b.origin});}
    if(b.kind==='grenade')event(s,'blast',hit,{radius:1.45});
    if(b.pierce>1){b.pierce--;b.hitIds.push(hit.id);}else{consumed=true;break;}
   }
  }
  if(!consumed)remaining.push(b);
 }
 s.bullets=remaining;
 for(const z of s.zombies.filter(z=>z.hp<=0)){s.kills++;event(s,'death',z,{fast:z.fast});}
 s.zombies=s.zombies.filter(living);
}
function rescueContacts(s){
 const m=rescueMap(s.level,s.version),threshold=s.difficulty==='challenge'?1:s.version>=7?24:18,infectors=[...s.zombies],conversions=[];
 for(const c of s.civilians.filter(civilian)){
  const threat=infectors.find(z=>dist(z,c)<=z.r+c.r+.13&&lineOfSight(s,z,c));c.threat=threat?.id||null;
  if(threat){c.infection++;if(c.infection===1){event(s,'danger',c,{source:threat.id});note(s,'平民受到感染威胁','danger');}}
  else c.infection=0;
  if(c.infection>=threshold){c.status='infected';c.path=[];s.lost++;s.stats.infected++;conversions.push(c);note(s,'一名平民被感染','danger');continue;}
  if(insideExit(m,c)){
   if(s.version>=3){if(c.status!=='boarding'){c.status='boarding';c.path=[];c.goal=null;event(s,'board',c);}continue;}
   c.status='saved';c.path=[];s.saved++;event(s,'rescue',c);if(s.saved===m.quota||s.saved===m.total)note(s,'已撤离 '+s.saved+' 人','rescue');continue;
  }
  if(c.status==='waiting'){
   const leaders=s.soldiers.filter(u=>living(u)&&dist(c,u)<(s.version>=6?3.4:2.6)&&lineOfSight(s,c,u)).sort((a,b)=>dist(c,a)-dist(c,b));
   if(leaders[0]){c.status='following';c.leader=leaders[0].id;event(s,'join',c);}
  }
 }
 for(const c of conversions)newZombie(s,c,false,true);
 for(const z of s.zombies){
  if(z.cooldown>0){z.cooldown--;continue;}
  const soldier=s.soldiers.filter(living).find(u=>dist(z,u)<z.r+u.r+.2&&lineOfSight(s,z,u));
  if(soldier){const damage=Math.round((soldier.role==='shield'?6:14)*(rescueRaging(s)?1.3:1));soldier.hp=Math.max(0,soldier.hp-damage);soldier.hitTick=s.tick;z.cooldown=rescueRaging(s)?18:24;event(s,'hurt',soldier,{amount:damage,source:z.id});if(!soldier.hp){event(s,'fallen',soldier);note(s,'一名队员倒下','danger');}continue;}
  const convoy=s.version>=7?s.objectives.find(o=>o.type==='convoy'&&!o.done&&o.hp>0&&dist(z,o)<z.r+o.r+.22&&lineOfSight(s,z,o)):null;if(convoy){convoy.hp=Math.max(0,convoy.hp-(z.brute?18:8));convoy.hitTick=s.tick;z.cooldown=24;event(s,'hurt',convoy,{amount:8,source:z.id});continue;}
  const gate=s.gates.find(g=>g.hp>0&&dist(z,g)<1.1);if(gate){gate.hp=Math.max(0,gate.hp-(z.fast?9:15));z.cooldown=24;event(s,'gateHit',gate);if(!gate.hp){s.nav++;event(s,'break',gate);note(s,'门障被突破','danger');}}
 }
}
function extraction(s){
 if(s.version<3)return;
 const m=rescueMap(s.level,s.version),e=s.evac,queue=s.civilians.filter(c=>c.status==='boarding'&&insideExit(m,c)),at={x:m.exit.x+m.exit.w/2,y:m.exit.y+m.exit.h/2};
 if(s.version>=7&&s.objectives.some(o=>o.type==='power'&&!o.done)){e.phase='unpowered';return;}
 if(!queue.length){if(e.phase!=='idle'&&e.phase!=='complete')e.phase=s.version>=4&&!e.active?'idle':'waiting';return;}
 if(s.version>=6&&!e.active&&s.soldiers.some(u=>living(u)&&insideExit(m,u))){e.phase='called';note(s,'护送队自动呼叫接驳，守住撤离区','rescue');}
 if(s.version>=4&&!e.active&&e.phase!=='called'){e.phase='gathering';return;}
 if(e.phase==='idle'||e.phase==='complete'||e.phase==='called'){
  if(s.version>=4)e.active=true;
  e.progress=0;e.alerts++;e.alertTick=s.tick+m.extraction.warning*RESCUE_HZ;e.rageUntil=s.tick+(m.extraction.warning+m.extraction.seconds+10)*RESCUE_HZ;
  for(let i=0;i<m.extraction.count;i++){const row={tick:e.alertTick+Math.round(i*(s.version>=7?.16:.5)*RESCUE_HZ),entry:s.version>=7?m.extraction.entries[i%m.extraction.entries.length]:m.extraction.entry,fast:i<m.extraction.fast,wave:m.waves.length+e.alerts,assault:true};if(s.version>=7)row.brute=s.level>=3&&i>=m.extraction.fast&&i%14===0;s.schedule.push(row);}
  s.schedule.sort((a,b)=>a.tick-b.tick||a.wave-b.wave);
  event(s,'evacAlarm',at);note(s,s.version>=7?'撤离信号引来尸潮，'+m.extraction.warning+' 秒后多路突入':'撤离信号引来尸潮，'+m.extraction.warning+' 秒后从'+m.entrances[m.extraction.entry].name+'突入','danger');
 }
 const threat=s.zombies.some(z=>z.hp>0&&z.x>=m.exit.x-.9&&z.x<=m.exit.x+m.exit.w+.9&&z.y>=m.exit.y-.9&&z.y<=m.exit.y+m.exit.h+.9&&lineOfSight(s,z,at));
 const guarded=s.soldiers.some(u=>living(u)&&insideExit(m,u));
 const phase=threat?'contested':!guarded?'unguarded':'loading';
 if(e.phase!==phase&&['contested','unguarded'].includes(phase))note(s,threat?'撤离区受威胁，读秒暂停':'撤离区缺少护卫，读秒暂停','danger');
 e.phase=phase;if(phase!=='loading')return;
 e.progress++;
 if(e.progress>=e.required){
  for(const c of queue){c.status='saved';c.path=[];s.saved++;event(s,'rescue',c);}
  e.phase='complete';if(s.version>=4)e.active=false;e.batches++;event(s,'evacComplete',at,{count:queue.length});note(s,'接驳完成，'+queue.length+' 名平民安全撤离','rescue');
 }
}
function outcome(s){
 const m=rescueMap(s.level,s.version);let reason='',winner=null;
 if(s.version>=7&&s.objectives.some(o=>o.type==='convoy'&&o.hp<=0)){winner=false;reason='救援车被摧毁';}
 else if(m.total-s.lost<m.quota){winner=false;reason='平民损失超过目标';}
 else if(!s.soldiers.some(living)){winner=false;reason='小队全部倒下';}
 else if(s.version>=3){
  if(s.saved>=m.quota&&(s.version<7||s.objectives.every(o=>o.done))&&(m.mode==='hold'||s.spawned===s.schedule.length&&s.zombies.length===0)){winner=true;reason=m.mode==='clear'?'撤离与清剿完成':s.saved===m.total?'全员撤离':'撤离目标完成';}
  else if(s.tick>=m.seconds*RESCUE_HZ){winner=false;reason=s.version>=7&&s.objectives.some(o=>!o.done)?'任务目标未完成':s.saved<m.quota?'撤离时间耗尽':'清剿时间耗尽';}
 }
 else if(s.version>=2&&m.mode==='hold'&&s.saved===m.total){winner=true;reason='全员撤离';}
 else if(s.spawned===s.schedule.length&&s.zombies.length===0){winner=true;reason='丧尸全部清除';}
 else if(s.tick>=m.seconds*RESCUE_HZ){winner=m.mode==='hold';reason=winner?'坚守成功':'清剿时间耗尽';}
 if(winner!==null){s.winner=winner;s.phase='ended';s.reason=reason;event(s,winner?'victory':'defeat',{x:12,y:8});note(s,reason,winner?'rescue':'danger');}
}
export function stepRescue(s){
 if(s.phase!=='running')return s;
 const t=structuredClone(s);t.tick++;t.events=t.events.filter(e=>t.tick-e.tick<(t.version>=7?33:42));
 const m=rescueMap(t.level,t.version),mobility=1+.18*t.upgrades.filter(x=>x==='mobility').length;
 if(t.version>=4)t.decoys=t.decoys.filter(d=>d.expires>t.tick);
 for(let i=t.spawned;i<t.schedule.length&&t.schedule[i].tick<=t.tick;i++){
  const wave=t.schedule[i],entry=m.entrances[wave.entry];t.spawned++;if(wave.assault){if(wave.tick===t.evac.alertTick)note(t,'狂暴尸潮突入！守住撤离区','danger');}else if(wave.wave!==t.wave){t.wave=wave.wave;note(t,'第 '+wave.wave+' 波丧尸进入'+entry.name,'wave');}
  const offset=(noise(t.seed,i,51)-.5)*.5;newZombie(t,{x:entry.x+offset,y:entry.y+(t.version>=7&&entry.y>m.h/2?-1:1)*Math.abs(offset)},wave.fast,false,!!wave.brute);
 }
 if(t.version>=7)siegeObjectives(t);
 if(t.version>=6)assistSoldiers(t);
 for(const u of t.soldiers.filter(living))move(t,u,2.7*mobility);
 if(t.version>=4)for(const crate of t.crates)if(!crate.claimed&&t.soldiers.some(u=>living(u)&&dist(u,crate)<.85&&lineOfSight(t,u,crate))){crate.claimed=true;t.supplies++;event(t,'supply',crate);note(t,'拾取补给箱，战术补给 +1','rescue');}
 for(const c of t.civilians.filter(civilian)){
  if(t.version>=6){assistCivilian(t,c,m,mobility);continue;}
  if(c.status==='boarding'){
   if(!c.goal){const n=Number(c.id.slice(1));route(t,c,{x:m.exit.x+.7+(n%4)*.65,y:m.exit.y+1.8+Math.floor(n%12/4)*.45});}
   move(t,c,2.25*mobility);continue;
  }
  if(c.status==='following'){
   let leader=t.soldiers.find(u=>u.id===c.leader&&living(u));if(!leader){leader=t.soldiers.filter(living).sort((a,b)=>dist(c,a)-dist(c,b))[0];c.leader=leader?.id;}
   if(leader&&(t.tick%12===0||c.nav!==t.nav||!c.goal)){
    const nearExit=insideExit(m,leader),n=Number(c.id.slice(1)),goal=nearExit?{x:m.exit.x+.7+(n%4)*.65,y:m.exit.y+.6+Math.floor(n%12/4)*.7}:leader;
    if(nearExit||dist(c,leader)>1.15)route(t,c,goal);else c.path=[];
   }
   move(t,c,2.25*mobility);
  }
 }
 for(const z of t.zombies){
  const target=[...t.soldiers,...t.civilians,...t.gates,...(t.decoys||[]),...(t.objectives||[])].find(u=>u.id===z.target),invalid=!target||(target.kind==='civilian'?!civilian(target):target.hp<=0);
  if(invalid||z.nav!==t.nav||t.tick%15===Number(z.id.slice(1))%15)zombieTargets(t,z);
  const contact=target&&(target.kind==='civilian'||target.kind==='soldier')&&dist(z,target)<z.r+target.r+.07;
  if(!contact)move(t,z,(z.brute?.78:z.fast?1.65:1.03)*(rescueRaging(t)?1.3:1),'zombie');
 }
 spacing(t);shots(t);projectileHits(t);rescueContacts(t);extraction(t);outcome(t);return t;
}
export function rescueStats(s){const map=rescueMap(s.level,s.version);return {saved:s.saved,waiting:s.civilians.filter(c=>c.status==='waiting').length,following:s.civilians.filter(c=>c.status==='following').length,boarding:s.civilians.filter(c=>c.status==='boarding').length,raging:rescueRaging(s),lost:s.lost,safe:map.total-s.lost,alive:s.soldiers.filter(living).length,enemies:s.zombies.length,pending:s.schedule.length-s.spawned,remaining:Math.max(0,Math.ceil(map.seconds-s.tick/RESCUE_HZ))};}
export function beginRescue(config){const state=initRescue(config);return {state,record:{format:'rescue-'+state.version,game:'rescue',config:{level:state.level,seed:state.seed,difficulty:state.difficulty,upgrades:state.upgrades},commands:[],end:null}};}
export function issueRescue(match,command){match.state=commandRescue(match.state,command);match.record.commands.push({tick:match.state.tick,command:structuredClone(command)});return match.state;}
export function advanceRescue(match){match.state=stepRescue(match.state);return match.state;}
export function sealRescue(match){return {...structuredClone(match.record),end:{tick:match.state.tick,hash:fingerprint(match.state),winner:match.state.winner}};}
export function* playbackRescue(record){
 if(!['rescue-1','rescue-2','rescue-3','rescue-4','rescue-5','rescue-6',RESCUE_FORMAT].includes(record?.format)||record.game!=='rescue'||!Array.isArray(record.commands)||record.commands.length>10000||!Number.isInteger(record.end?.tick)||record.end.tick<0||record.end.tick>(record?.format==='rescue-7'?6300:3600))throw Error('救援回放无效');
 let s=initRescue({...record.config,version:Number(record.format.slice(-1))}),index=0;
 for(let tick=0;tick<=record.end.tick;tick++){
  while(index<record.commands.length&&record.commands[index].tick===tick)s=commandRescue(s,record.commands[index++].command);
  yield s;if(tick===record.end.tick)break;if(s.phase!=='running')throw Error('回放时间不连续');s=stepRescue(s);
 }
 if(index!==record.commands.length||record.end.hash!==fingerprint(s)||record.end.winner!==s.winner)throw Error('救援回放校验失败');
}
export function replayRescue(record){let result;for(const state of playbackRescue(record))result=state;return result;}

const flowCache=new WeakMap();
function siegeTarget(s,z){
 const m=rescueMap(s.level,s.version);let fields=flowCache.get(s);
 if(!fields){
  const flow=targets=>{const cost=Array(m.w*m.h).fill(-1),next=Array(m.w*m.h).fill(-1),owners=Array(m.w*m.h).fill(null),queue=[];
   for(const target of targets){const c=cell(m,target);if(cost[c]<0&&walkable(s,target.x,target.y,'zombie')){cost[c]=0;owners[c]=target;queue.push(c);}}
   for(let i=0;i<queue.length;i++)for(const c of neighbors(m,queue[i])){const p=center(m,c);if(cost[c]<0&&walkable(s,p.x,p.y,'zombie')){cost[c]=cost[queue[i]]+1;next[c]=queue[i];owners[c]=owners[queue[i]];queue.push(c);}}
   return {cost,next,owners};};
  const people=[...s.civilians.filter(civilian),...s.soldiers.filter(living),...s.objectives.filter(o=>o.type==='convoy'&&!o.done&&o.hp>0)];
  const gates=s.gates.filter(g=>g.hp>0).flatMap(g=>neighbors(m,g.cell).map(c=>({...center(m,c),id:g.id})));
  fields={people:flow(people),gates:flow(gates)};flowCache.set(s,fields);
 }
 const start=cell(m,z),f=fields.people.owners[start]?fields.people:fields.gates,target=f.owners[start];z.nav=s.nav;
 if(!target){z.target=null;z.path=[];return;}z.target=target.id;z.goal={x:target.x,y:target.y};const route=[];let c=start;
 for(let n=0;n<m.w*m.h&&f.next[c]>=0;n++){c=f.next[c];route.push(center(m,c));}if(route.length)route[route.length-1]={...z.goal};else route.push({...z.goal});z.path=route;
}
const WEAPONS={rifle:{damage:20,ammo:16,cooldown:6,reload:22,range:7},gunner:{damage:17,ammo:32,cooldown:3,reload:26,range:7.2,pierce:2},grenadier:{damage:52,ammo:5,cooldown:28,reload:32,range:6.5},shield:{damage:22,ammo:14,cooldown:7,reload:22,range:4}};
const weapon=u=>WEAPONS[u.role]||WEAPONS.rifle;
function siegeShots(s){
 for(const u of s.soldiers.filter(living)){
  const w=weapon(u);if(u.reload>0){u.reload--;if(!u.reload)u.ammo=w.ammo;continue;}if(u.cooldown>0){u.cooldown--;continue;}
  const targets=[...s.zombies.filter(living),...s.objectives.filter(o=>o.type==='nest'&&!o.done&&o.hp>0)].filter(z=>dist(u,z)<=w.range&&lineOfSight(s,u,z));
  const priority=z=>z.type==='nest'?4:s.civilians.some(c=>civilian(c)&&dist(c,z)<2)?-4:0;
  targets.sort((a,b)=>dist(u,a)+priority(a)-dist(u,b)-priority(b)||a.id.localeCompare(b.id));const target=targets[0];if(!target)continue;
  const d=dist(u,target)||1,dx=round((target.x-u.x)/d),dy=round((target.y-u.y)/d);u.angle=round(Math.atan2(dy,dx));
  s.bullets.push({id:'b'+s.uid++,x:u.x,y:u.y,dx,dy,origin:u.id,left:w.range+.3,damage:w.damage*(1+.2*s.upgrades.filter(x=>x==='fire').length),kind:u.role==='grenadier'?'grenade':u.role,pierce:w.pierce||1,hitIds:[]});
  s.stats.shots++;u.ammo--;u.cooldown=w.cooldown;event(s,'shot',u,{to:target.id,angle:u.angle,source:u.id,weapon:u.role});if(u.ammo<=0)u.reload=w.reload;
 }
}
function siegeObjectives(s){
 for(const o of s.objectives){
  if(o.done)continue;
  if(o.type==='power'){
   o.blocked=s.zombies.some(z=>living(z)&&dist(z,o)<2&&lineOfSight(s,z,o));o.active=s.soldiers.some(u=>living(u)&&dist(u,o)<1.8&&lineOfSight(s,u,o))&&!o.blocked;
   if(o.active)o.progress++;if(o.progress>=o.required){o.done=true;event(s,'objective',o);note(s,'供电恢复，撤离区可以接驳','rescue');s.gateCharges++;}
  }else if(o.type==='nest'){
   o.progress=o.maxHp-o.hp;if(o.hp<=0){o.done=true;event(s,'objective',o);note(s,o.name+'已摧毁，停止增援','rescue');s.supplies++;continue;}
   if(s.tick>=o.nextSpawn){o.nextSpawn=s.tick+12*RESCUE_HZ;for(let i=0;i<8;i++){const a=i*Math.PI/4,p={x:round(o.x+Math.cos(a)*.7),y:round(o.y+Math.sin(a)*.7)};if(walkable(s,p.x,p.y,'zombie',.24))newZombie(s,p,i<2);}event(s,'nestWave',o);note(s,o.name+'涌出增援','wave');}
  }else if(o.type==='convoy'){
   const escort=s.soldiers.some(u=>living(u)&&dist(u,o)<3.6&&lineOfSight(s,u,o)),blocked=s.zombies.some(z=>living(z)&&dist(z,o)<.9&&lineOfSight(s,z,o));o.blocked=blocked;
   o.active=escort&&!blocked&&o.hp>0;
   if(o.active){const target=o.waypoints[o.checkpoint];if(!o.goal||o.nav!==s.nav)route(s,o,target);move(s,o,1.65);if(dist(o,target)<.25){o.checkpoint++;o.goal=null;o.path=[];o.progress=o.checkpoint;if(o.checkpoint===o.waypoints.length){o.done=true;event(s,'objective',o);note(s,'救援车已抵达接应区','rescue');s.supplies+=2;}}}
  }
 }
}
