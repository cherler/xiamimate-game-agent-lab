import {noise,fingerprint} from './common.mjs';
import {RESCUE_HZ,rescueMap,insideExit,UPGRADES} from './rescue-maps.mjs';
export {RESCUE_HZ,rescueMap,insideExit,UPGRADES};
export const RESCUE_FORMAT='rescue-2';
const round=v=>Math.round(v*10000)/10000;
const dist=(a,b)=>Math.round(Math.hypot(a.x-b.x,a.y-b.y)*1e6)/1e6;
const cell=(m,u)=>Math.floor(u.y)*m.w+Math.floor(u.x);
const center=(m,c)=>({x:c%m.w+.5,y:Math.floor(c/m.w)+.5});
const living=u=>u.hp>0;
const civilian=u=>u.status==='waiting'||u.status==='following';
function event(s,kind,at,extra={}){s.events.push({id:s.eventId++,tick:s.tick,kind,x:at.x,y:at.y,...extra});}
function note(s,text,kind='info'){s.log.push({tick:s.tick,text,kind});s.log=s.log.slice(-8);}
export function walkable(s,x,y,team='human',radius=0){
 const m=rescueMap(s.level),spots=radius?[[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]]:[[x,y]];
 return spots.every(([px,py])=>m.tiles[Math.floor(py)]?.[Math.floor(px)]==='.'&&!(team==='zombie'&&s.gates.some(g=>g.hp>0&&g.cell===Math.floor(py)*m.w+Math.floor(px))));
}
export function lineOfSight(s,a,b){
 const length=dist(a,b),steps=Math.max(1,Math.ceil(length/.12));
 for(let i=0;i<=steps;i++)if(!walkable(s,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;
 return true;
}
function neighbors(m,c){const x=c%m.w,y=Math.floor(c/m.w);return [[x,y-1],[x-1,y],[x+1,y],[x,y+1]].filter(([x,y])=>x>=0&&x<m.w&&y>=0&&y<m.h).map(([x,y])=>y*m.w+x);}
function field(s,start,team){
 const m=rescueMap(s.level),cost=Array(m.w*m.h).fill(-1),parent=Array(m.w*m.h).fill(-1),queue=[start];cost[start]=0;
 for(let i=0;i<queue.length;i++)for(const c of neighbors(m,queue[i])){const p=center(m,c);if(cost[c]<0&&walkable(s,p.x,p.y,team)){cost[c]=cost[queue[i]]+1;parent[c]=queue[i];queue.push(c);}}
 return {cost,parent};
}
export function pathTo(s,from,to,team='human'){
 const m=rescueMap(s.level);if(!walkable(s,to.x,to.y,team)||!walkable(s,from.x,from.y,team))return [];
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
 for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){
  const a=people[i],b=people[j],d=dist(a,b),friendly=a.kind!=='zombie'&&b.kind!=='zombie',limit=(a.r+b.r)*(friendly?.64:1);if(d>=limit)continue;
  const nx=d>.0001?(b.x-a.x)/d:1,ny=d>.0001?(b.y-a.y)/d:0,push=(limit-d)*.5+.001;
  // Escort crowds yield to troops; hard friendly collisions can deadlock a doorway.
  for(const [u,sign]of [[a,-1],[b,1]]){const other=u===a?b:a,ratio=friendly&&u.kind==='soldier'&&other.kind==='civilian'?0:u.kind==='soldier'&&u.path.length===0?.12:1,x=u.x+sign*nx*push*ratio,y=u.y+sign*ny*push*ratio;
   if(walkable(s,x,y,u.kind==='zombie'?'zombie':'human',u.r)){u.x=round(x);u.y=round(y);}
  }
 }
}
export function initRescue({level=1,seed=41003,difficulty='normal',upgrades=[],version=2}={}){
 const m=rescueMap(level,version);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['normal','challenge'].includes(difficulty)||!Array.isArray(upgrades)||upgrades.length>2||upgrades.some(x=>!UPGRADES[x]))throw Error('开局设置无效');
 const boost=id=>upgrades.filter(x=>x===id).length;
 if(![1,2].includes(version))throw Error('救援规则版本无效');
 const s={game:'rescue',version,level,seed,difficulty,upgrades:[...upgrades],tick:0,phase:'deploy',winner:null,reason:'',nav:0,uid:0,eventId:0,events:[],log:[],gates:[],gateCharges:2+boost('gate'),saved:0,lost:0,kills:0,wave:0,spawned:0,schedule:[],zombies:[],bullets:[],soldiers:[],civilians:[],stats:{shots:0,hits:0,infected:0}};
 s.soldiers=m.spawn.map((p,i)=>({id:'s'+i,kind:'soldier',group:p.group,role:p.group===2?'shield':'rifle',x:p.x,y:p.y,r:p.group===2?.28:.23,hp:p.group===2?240:110,maxHp:p.group===2?240:110,angle:-Math.PI/2,path:[],goal:null,nav:0,cooldown:0,ammo:p.group===2?8:6,reload:0,hitTick:-100}));
 for(const group of m.groups)for(let i=0;i<group.n;i++){const x=group.x+(i%3)*.7,y=group.y+Math.floor(i/3)*.65;s.civilians.push({id:'c'+s.civilians.length,kind:'civilian',x,y,r:.18,status:'waiting',leader:null,path:[],goal:null,nav:0,infection:0,threat:null,hitTick:-100});}
 m.waves.forEach((wave,index)=>{for(let i=0;i<wave.count;i++)s.schedule.push({tick:Math.round((wave.at+i*.5)*RESCUE_HZ),entry:wave.entry,fast:i<wave.fast,wave:index+1});});
 note(s,'小队已就位，等待行动');return s;
}
function newZombie(s,at,fast=false,infection=false){
 const hp=(fast?26:45)*(s.difficulty==='challenge'?1.15:1),z={id:'z'+s.uid++,kind:'zombie',x:at.x,y:at.y,r:fast?.19:.23,hp,maxHp:hp,fast,angle:0,path:[],goal:null,target:null,nav:-1,cooldown:infection?15:0,hitTick:-100};
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
 if(a.type==='move'||a.type==='hold'){
  if(!Array.isArray(a.ids)||!a.ids.length||new Set(a.ids).size!==a.ids.length||a.ids.some(id=>!s.soldiers.some(u=>u.id===id&&living(u))))throw Error('请选择可行动的小队');
  const chosen=s.soldiers.filter(u=>a.ids.includes(u.id));
  if(a.type==='hold'){chosen.forEach(u=>{u.path=[];u.goal=null;});event(s,'hold',chosen[0]);return;}
  if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||!walkable(s,a.x,a.y,'human',.3))throw Error('墙体内不能落点');
  const deployment=s.version>=2&&s.phase==='deploy';
  if(deployment&&!insideExit(rescueMap(s.level),a))throw Error('在绿色接应区部署，开始行动后前往平民所在房间');
  const spots=[];for(const u of chosen){
   const candidates=[{x:a.x,y:a.y},...[.65,1.3,1.95].flatMap(r=>Array.from({length:8},(_,i)=>({x:a.x+Math.cos(i*Math.PI/4)*r,y:a.y+Math.sin(i*Math.PI/4)*r})))];
   const target=candidates.find(p=>(!deployment||insideExit(rescueMap(s.level),p))&&walkable(s,p.x,p.y,'human',.3)&&spots.every(q=>dist(p,q)>.52)&&pathTo(s,u,p).length);
   if(!target)throw Error('无法到达这个位置');spots.push(target);route(s,u,target);
   if(s.phase==='deploy'){u.x=round(target.x);u.y=round(target.y);u.path=[];}
  }
  event(s,'order',{x:a.x,y:a.y},{count:chosen.length});return;
 }
 if(a.type==='gate'){
  const d=rescueMap(s.level).doors.find(d=>d.id===a.door);if(!d||s.gateCharges<=0||s.gates.some(g=>g.cell===d.cell&&g.hp>0))throw Error('无法在此部署门障');
  if(s.phase!=='deploy'&&!s.soldiers.some(u=>living(u)&&dist(u,d)<3))throw Error('小队靠近门口后才能部署');
  const hp=Math.round(150*(1+.6*s.upgrades.filter(x=>x==='gate').length));s.gates.push({...d,hp,maxHp:hp});s.gateCharges--;s.nav++;event(s,'build',d);note(s,'门障部署完成','gate');return;
 }
 throw Error('无法识别的指令');
}
function zombieTargets(s,z){
 const m=rescueMap(s.level),f=field(s,cell(m,z),'zombie');
 const candidates=[...s.civilians.filter(civilian),...s.soldiers.filter(living)];
 const ranked=candidates.filter(u=>f.cost[cell(m,u)]>=0).sort((a,b)=>(f.cost[cell(m,a)]*1.0+(a.kind==='soldier'?1.5:0)+dist(z,a)*.08)-(f.cost[cell(m,b)]*1.0+(b.kind==='soldier'?1.5:0)+dist(z,b)*.08)||a.id.localeCompare(b.id));
 if(ranked.length){const target=ranked[0];z.target=target.id;route(s,z,target,'zombie');return;}
 const gates=s.gates.filter(g=>g.hp>0).flatMap(g=>neighbors(m,g.cell).filter(c=>f.cost[c]>=0).map(c=>({g,c,cost:f.cost[c]}))).sort((a,b)=>a.cost-b.cost);
 if(gates[0]){z.target=gates[0].g.id;route(s,z,center(m,gates[0].c),'zombie');}else{z.target=null;z.path=[];}
}
function shots(s){
 for(const u of s.soldiers.filter(living)){
  if(u.reload>0){u.reload--;if(!u.reload)u.ammo=u.role==='rifle'?6:8;continue;}
  if(u.cooldown>0){u.cooldown--;continue;}
  const range=u.role==='rifle'?6.2:3.0;
  const targets=s.zombies.filter(z=>living(z)&&dist(u,z)<=range&&lineOfSight(s,u,z));
  targets.sort((a,b)=>{const priority=z=>s.civilians.some(c=>civilian(c)&&dist(c,z)<2)?-4:0;return dist(u,a)+priority(a)-dist(u,b)-priority(b)||a.id.localeCompare(b.id);});
  const target=targets[0];if(!target)continue;
  // Quantize transcendental results and directions for Node/browser replay parity.
  const d=dist(u,target),dx=round((target.x-u.x)/(d||1)),dy=round((target.y-u.y)/(d||1));u.angle=round(Math.atan2(dy,dx));
  s.bullets.push({id:'b'+s.uid++,x:u.x,y:u.y,dx,dy,origin:u.id,left:range+.3,damage:(u.role==='rifle'?10:9)*(1+.2*s.upgrades.filter(x=>x==='fire').length)});
  s.stats.shots++;u.ammo--;u.cooldown=u.role==='rifle'?15:26;event(s,'shot',u,{to:target.id,angle:u.angle,source:u.id});
  if(u.ammo<=0)u.reload=u.role==='rifle'?42:36;
 }
}
function projectileHits(s){
 const remaining=[];
 for(const b of s.bullets){
  const step=16/RESCUE_HZ;let consumed=false;
  for(let i=0;i<6;i++){
   b.x=round(b.x+b.dx*step/6);b.y=round(b.y+b.dy*step/6);b.left-=step/6;
   if(!walkable(s,b.x,b.y)||b.left<=0){event(s,'wall',b);consumed=true;break;}
   const hit=s.zombies.find(z=>living(z)&&dist(b,z)<z.r+.1);if(hit){hit.hp=Math.max(0,round(hit.hp-b.damage));hit.hitTick=s.tick;s.stats.hits++;event(s,'hit',hit,{amount:b.damage,source:b.origin});consumed=true;break;}
  }
  if(!consumed)remaining.push(b);
 }
 s.bullets=remaining;
 for(const z of s.zombies.filter(z=>z.hp<=0)){s.kills++;event(s,'death',z,{fast:z.fast});}
 s.zombies=s.zombies.filter(living);
}
function rescueContacts(s){
 const m=rescueMap(s.level),threshold=s.difficulty==='challenge'?1:18,infectors=[...s.zombies],conversions=[];
 for(const c of s.civilians.filter(civilian)){
  const threat=infectors.find(z=>dist(z,c)<=z.r+c.r+.13&&lineOfSight(s,z,c));c.threat=threat?.id||null;
  if(threat){c.infection++;if(c.infection===1){event(s,'danger',c,{source:threat.id});note(s,'平民受到感染威胁','danger');}}
  else c.infection=0;
  if(c.infection>=threshold){c.status='infected';c.path=[];s.lost++;s.stats.infected++;conversions.push(c);note(s,'一名平民被感染','danger');continue;}
  if(insideExit(m,c)){c.status='saved';c.path=[];s.saved++;event(s,'rescue',c);if(s.saved===m.quota||s.saved===m.total)note(s,'已撤离 '+s.saved+' 人','rescue');continue;}
  if(c.status==='waiting'){
   const leaders=s.soldiers.filter(u=>living(u)&&dist(c,u)<2.6&&lineOfSight(s,c,u)).sort((a,b)=>dist(c,a)-dist(c,b));
   if(leaders[0]){c.status='following';c.leader=leaders[0].id;event(s,'join',c);}
  }
 }
 for(const c of conversions)newZombie(s,c,false,true);
 for(const z of s.zombies){
  if(z.cooldown>0){z.cooldown--;continue;}
  const soldier=s.soldiers.filter(living).find(u=>dist(z,u)<z.r+u.r+.2&&lineOfSight(s,z,u));
  if(soldier){const damage=soldier.role==='shield'?6:14;soldier.hp=Math.max(0,soldier.hp-damage);soldier.hitTick=s.tick;z.cooldown=24;event(s,'hurt',soldier,{amount:damage,source:z.id});if(!soldier.hp){event(s,'fallen',soldier);note(s,'一名队员倒下','danger');}continue;}
  const gate=s.gates.find(g=>g.hp>0&&dist(z,g)<1.1);if(gate){gate.hp=Math.max(0,gate.hp-(z.fast?9:15));z.cooldown=24;event(s,'gateHit',gate);if(!gate.hp){s.nav++;event(s,'break',gate);note(s,'门障被突破','danger');}}
 }
}
function outcome(s){
 const m=rescueMap(s.level);let reason='',winner=null;
 if(m.total-s.lost<m.quota){winner=false;reason='平民损失超过目标';}
 else if(!s.soldiers.some(living)){winner=false;reason='小队全部倒下';}
 else if(s.version>=2&&m.mode==='hold'&&s.saved===m.total){winner=true;reason='全员撤离';}
 else if(s.spawned===s.schedule.length&&s.zombies.length===0){winner=true;reason='丧尸全部清除';}
 else if(s.tick>=m.seconds*RESCUE_HZ){winner=m.mode==='hold';reason=winner?'坚守成功':'清剿时间耗尽';}
 if(winner!==null){s.winner=winner;s.phase='ended';s.reason=reason;event(s,winner?'victory':'defeat',{x:12,y:8});note(s,reason,winner?'rescue':'danger');}
}
export function stepRescue(s){
 if(s.phase!=='running')return s;
 const t=structuredClone(s);t.tick++;t.events=t.events.filter(e=>t.tick-e.tick<42);
 const m=rescueMap(t.level),mobility=1+.18*t.upgrades.filter(x=>x==='mobility').length;
 for(let i=t.spawned;i<t.schedule.length&&t.schedule[i].tick<=t.tick;i++){
  const wave=t.schedule[i],entry=m.entrances[wave.entry];t.spawned++;if(wave.wave!==t.wave){t.wave=wave.wave;note(t,'第 '+wave.wave+' 波丧尸进入'+entry.name,'wave');}
  const offset=(noise(t.seed,i,51)-.5)*.5;newZombie(t,{x:entry.x+offset,y:entry.y+Math.abs(offset)},wave.fast);
 }
 for(const u of t.soldiers.filter(living))move(t,u,2.7*mobility);
 for(const c of t.civilians.filter(civilian)){
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
  const target=[...t.soldiers,...t.civilians,...t.gates].find(u=>u.id===z.target),invalid=!target||(target.kind==='civilian'?!civilian(target):target.hp<=0);
  if(invalid||z.nav!==t.nav||t.tick%15===Number(z.id.slice(1))%15)zombieTargets(t,z);
  const contact=target&&(target.kind==='civilian'||target.kind==='soldier')&&dist(z,target)<z.r+target.r+.07;
  if(!contact)move(t,z,z.fast?1.65:1.03,'zombie');
 }
 spacing(t);shots(t);projectileHits(t);rescueContacts(t);outcome(t);return t;
}
export function rescueStats(s){const map=rescueMap(s.level);return {saved:s.saved,waiting:s.civilians.filter(c=>c.status==='waiting').length,following:s.civilians.filter(c=>c.status==='following').length,lost:s.lost,safe:map.total-s.lost,alive:s.soldiers.filter(living).length,enemies:s.zombies.length,pending:s.schedule.length-s.spawned,remaining:Math.max(0,Math.ceil(map.seconds-s.tick/RESCUE_HZ))};}
export function beginRescue(config){const state=initRescue(config);return {state,record:{format:state.version===1?'rescue-1':RESCUE_FORMAT,game:'rescue',config:{level:state.level,seed:state.seed,difficulty:state.difficulty,upgrades:state.upgrades},commands:[],end:null}};}
export function issueRescue(match,command){match.state=commandRescue(match.state,command);match.record.commands.push({tick:match.state.tick,command:structuredClone(command)});return match.state;}
export function advanceRescue(match){match.state=stepRescue(match.state);return match.state;}
export function sealRescue(match){return {...structuredClone(match.record),end:{tick:match.state.tick,hash:fingerprint(match.state),winner:match.state.winner}};}
export function* playbackRescue(record){
 if(!['rescue-1',RESCUE_FORMAT].includes(record?.format)||record.game!=='rescue'||!Array.isArray(record.commands)||record.commands.length>10000||!Number.isInteger(record.end?.tick)||record.end.tick<0||record.end.tick>3600)throw Error('救援回放无效');
 let s=initRescue({...record.config,version:record.format==='rescue-1'?1:2}),index=0;
 for(let tick=0;tick<=record.end.tick;tick++){
  while(index<record.commands.length&&record.commands[index].tick===tick)s=commandRescue(s,record.commands[index++].command);
  yield s;if(tick===record.end.tick)break;if(s.phase!=='running')throw Error('回放时间不连续');s=stepRescue(s);
 }
 if(index!==record.commands.length||record.end.hash!==fingerprint(s)||record.end.winner!==s.winner)throw Error('救援回放校验失败');
}
export function replayRescue(record){let result;for(const state of playbackRescue(record))result=state;return result;}
