import {noise} from './common.mjs';
import {UNIT_LIST,UNITS,POOL_COPIES,SHOP_ODDS,LEVEL_XP,LEVEL_COST,ITEMS} from './chess-catalog.mjs';
import {runBattle,synergies,synergyLabels,synergyDetails} from './chess-battle.mjs';
export {UNIT_LIST,UNITS,LEVEL_COST,LEVEL_XP,SHOP_ODDS,ITEMS,synergies,synergyLabels,synergyDetails};
export const board=p=>p.units.filter(u=>u.cell!==null),bench=p=>p.units.filter(u=>u.cell===null);
export const isCreepRound=round=>round<=3||round>=10&&round%5===0;
export const interest=gold=>Math.min(5,Math.floor(gold/10));
export const streakBonus=n=>n>=7?3:n>=5?2:n>=3?1:0;
const names=['你','铜铃工匠','苔光园丁','星灯旅者','岩谷守望','潮汐旅人','暮影巡者','森歌祭司'];
const legalCell=cell=>Number.isInteger(cell)&&cell>=32&&cell<64;
function log(s,text){s.log.push(text);s.log=s.log.slice(-24);}
function shop(s,actor){
 const p=s.players[actor];for(const type of p.shop)if(type)s.pool[type]++;p.shop=[];
 for(let i=0;i<5;i++){
  const costs=[1,2,3,4,5].filter(cost=>SHOP_ODDS[p.level][cost-1]>0&&UNIT_LIST.some(u=>u.cost===cost&&s.pool[u.id]>0));
  const sum=costs.reduce((n,c)=>n+SHOP_ODDS[p.level][c-1],0);if(!sum){p.shop.push(null);continue;}
  let r=noise(s.seed,s.roll++,actor+55)*sum,cost=costs.at(-1);for(const c of costs){r-=SHOP_ODDS[p.level][c-1];if(r<0){cost=c;break;}}
  const types=UNIT_LIST.filter(u=>u.cost===cost&&s.pool[u.id]>0);let pick=noise(s.seed,s.roll++,actor+66)*types.reduce((n,c)=>n+s.pool[c.id],0),id=types.at(-1).id;
  for(const c of types){pick-=s.pool[c.id];if(pick<0){id=c.id;break;}}p.shop.push(id);s.pool[id]--;
 }
}
function xp(p,n){p.xp+=n;while(p.level<10&&p.xp>=LEVEL_XP[p.level]){p.xp-=LEVEL_XP[p.level];p.level++;}if(p.level===10)p.xp=0;}
export function initChess(seed=1){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('开局无效');
 const s={game:'chess',version:2,seed,seq:0,round:1,roll:0,uid:0,phase:'prep',winner:null,reason:'',log:[],battle:null,lastBattle:null,lastGhost:null,pool:Object.fromEntries(UNIT_LIST.map(c=>[c.id,POOL_COPIES[c.cost]])),players:names.map((name,i)=>({name,hp:100,gold:1,level:1,xp:0,units:[],shop:[],inventory:[],locked:false,ready:false,streak:0,placement:null,lastOpponent:null,lastIncome:null,style:['balanced','economy','strength','level'][i%4]}))};
 for(let i=0;i<8;i++)shop(s,(i+seed%8)%8);return s;
}
function merge(p,type,preferred){
 for(let star=1;star<=2;star++){let group=p.units.filter(u=>u.type===type&&u.star===star);while(group.length>=3){
  const keep=group.find(u=>u.uid===preferred)||group.find(u=>u.cell!==null)||group[0],others=group.filter(u=>u!==keep).slice(0,2),items=[...(keep.items||[]),...others.flatMap(u=>u.items||[])];keep.star++;keep.items=items.slice(0,3);p.inventory.push(...items.slice(3));p.units=p.units.filter(u=>!others.includes(u));group=p.units.filter(u=>u.type===type&&u.star===star);
 }}
}
function creeps(round){
 if(round<=3)return Array.from({length:round},(_,i)=>({uid:'wild'+i,type:'Z01',star:1,cell:11+i*2,items:[]}));
 const tier=Math.min(3,1+Math.floor((round-10)/10)),boss=round>=20;return Array.from({length:boss?3:4},(_,i)=>({uid:'wild'+i,type:boss&&i===0?'Z03':'Z02',star:tier,cell:10+i*2,items:[]}));
}
function battles(s){
 const alive=s.players.map((p,i)=>p.hp>0?i:null).filter(i=>i!==null),results=[];let visible=null;
 const fight=(a,b,ghost=false)=>{
  const own=structuredClone(board(s.players[a])),enemy=b===-1?creeps(s.round):structuredClone(board(s.players[b])).map(u=>({...u,cell:63-u.cell}));
  const fightSeed=(s.seed^((s.round*65537+a*977+(b+1)*197)>>>0))>>>0,result=runBattle({seed:fightSeed,round:s.round,players:[{units:own},{units:enemy}]}),pve=b===-1;
  results.push({actor:a,opponent:b,win:result.winner===0,draw:result.winner===-1,damage:result.damage[0],pve,ghost});s.players[a].lastOpponent=b;
  if(!pve&&!ghost){results.push({actor:b,opponent:a,win:result.winner===1,draw:result.winner===-1,damage:result.damage[1],pve:false,ghost:false});s.players[b].lastOpponent=a;}
  if(a===0)visible={...result,opponent:b,pve,home:own,away:enemy};
  else if(b===0&&!ghost){// Use the same resolved battle for both seats; transform its frames for the human view.
   visible={...result,winner:result.winner===-1?-1:1-result.winner,damage:[result.damage[1],result.damage[0]],frames:result.frames.map(f=>({...f,units:f.units.map(u=>({...u,actor:1-u.actor,cell:63-u.cell}))})),stats:result.stats.map(u=>({...u,actor:1-u.actor})),opponent:a,pve:false};
  }
 };
 if(isCreepRound(s.round))for(const i of alive)fight(i,-1);
 else{
  // Rotate shuffled pairings, avoiding the previous rival when possible.
  const order=[...alive].sort((a,b)=>noise(s.seed,s.round,500+a)-noise(s.seed,s.round,500+b));
  while(order.length>1){const a=order.shift();let i=order.findIndex(b=>b!==s.players[a].lastOpponent);if(i<0)i=0;fight(a,order.splice(i,1)[0]);}
  if(order.length){const a=order[0],b=alive.find(b=>b!==a);fight(a,b,true);}
 }
 s.battle={...visible,results};s.phase='battle';
}
function settle(s){
 const results=s.battle.results,previousHP=s.players.map(p=>p.hp);
 for(const r of results){const p=s.players[r.actor];p.hp=Math.max(0,p.hp-r.damage);if(!r.pve){p.streak=r.draw?0:r.win?Math.max(0,p.streak)+1:Math.min(0,p.streak)-1;if(r.win)p.gold++;}else if(r.win){const ids=Object.keys(ITEMS),id=ids[Math.floor(noise(s.seed,s.round,r.actor+203)*ids.length)];p.inventory.push(id);log(s,p.name+'获得'+ITEMS[id].name);}}
 const aliveBefore=s.players.filter(p=>p.placement===null).length,dead=s.players.map((p,i)=>({p,i})).filter(({p})=>p.hp===0&&p.placement===null).sort((a,b)=>previousHP[a.i]-previousHP[b.i]||b.i-a.i);
 dead.forEach(({p,i},index)=>{p.placement=aliveBefore-index;s.lastGhost=structuredClone(p.units);for(const u of p.units)s.pool[u.type]+=3**(u.star-1);for(const type of p.shop)if(type)s.pool[type]++;p.units=[];p.shop=[];log(s,p.name+'淘汰 · 第'+p.placement+'名');});
 s.lastBattle={round:s.round,results,stats:s.battle.stats,winner:s.battle.winner,damage:s.battle.damage,opponent:s.battle.opponent,pve:s.battle.pve};
 const alive=s.players.map((p,i)=>p.hp>0?i:null).filter(i=>i!==null);
 if(alive.length<=1||s.players[0].hp<=0||s.round>=40){
  const order=alive.sort((a,b)=>s.players[b].hp-s.players[a].hp||a-b);if(alive.length===1)s.players[alive[0]].placement=1;
  if(s.round>=40)order.forEach((i,k)=>s.players[i].placement=k+1);
  s.winner=!alive.length?-1:s.players[0].hp<=0?-2:order[0];s.reason=!alive.length?'最后的棋手同时倒下':s.players[0].hp<=0?'你已淘汰':s.round>=40?'决胜轮结束':'最后一位棋手';s.phase='ended';return;
 }
 s.round++;s.phase='prep';s.battle=null;
 for(const i of alive){const p=s.players[i],base=Math.min(5,s.round),interestGold=interest(p.gold),streak=streakBonus(Math.abs(p.streak));p.lastIncome={base,interest:interestGold,streak,total:base+interestGold+streak};p.gold+=p.lastIncome.total;p.ready=false;xp(p,1);}
 for(let offset=0;offset<8;offset++){const i=(s.round+offset)%8,p=s.players[i];if(p.hp>0&&!p.locked)shop(s,i);}
}
export function stepChess(s,actor,a){
 if(s.winner!==null)throw Error('本局已经结束');
 if(a.type==='advance'){if(actor!==-1||s.phase!=='battle')throw Error('战斗尚未完成');const t=structuredClone(s);settle(t);t.seq++;return t;}
 if(!Number.isInteger(actor)||actor<0||actor>=8||s.phase!=='prep'||s.players[actor].hp<=0||s.players[actor].ready)throw Error('现在不能调整阵容');
 const t=structuredClone(s),p=t.players[actor];
 if(a.type==='buy'){
  if(!Number.isInteger(a.slot)||a.slot<0||a.slot>=5)throw Error('商品无效');const type=p.shop[a.slot],c=UNITS[type];if(!c||p.gold<c.cost)throw Error('金币不足或已售出');
  p.gold-=c.cost;p.shop[a.slot]=null;p.units.push({uid:'c'+t.uid++,type,star:1,cell:null,items:[]});merge(p,type,a.keep);if(bench(p).length>8)throw Error('备战席已满');log(t,p.name+'招募'+c.name);
 }else if(a.type==='sell'){
  const u=p.units.find(u=>u.uid===a.uid);if(!u)throw Error('棋子不存在');const copies=3**(u.star-1);p.gold+=UNITS[u.type].cost*copies;t.pool[u.type]+=copies;p.inventory.push(...u.items);p.units=p.units.filter(v=>v!==u);
 }else if(a.type==='move'){
  const u=p.units.find(u=>u.uid===a.uid);if(!u||!legalCell(a.cell))throw Error('只能放在己方半场');const other=p.units.find(v=>v.cell===a.cell);if(other)other.cell=u.cell;u.cell=a.cell;if(board(p).length>p.level)throw Error('上场人数已满');
 }else if(a.type==='bench'){
  const u=p.units.find(u=>u.uid===a.uid);if(!u||u.cell===null||bench(p).length>=8)throw Error('备战席已满');u.cell=null;
 }else if(a.type==='arrange'){
  if(!Array.isArray(a.layout)||a.layout.length>p.level||new Set(a.layout.map(u=>u.uid)).size!==a.layout.length||new Set(a.layout.map(u=>u.cell)).size!==a.layout.length||!a.layout.every(u=>p.units.some(v=>v.uid===u.uid)&&legalCell(u.cell))||p.units.length-a.layout.length>8)throw Error('布阵无效');
  p.units.forEach(u=>u.cell=a.layout.find(v=>v.uid===u.uid)?.cell??null);
 }else if(a.type==='roll'){if(p.gold<2)throw Error('刷新需要 2 金币');p.gold-=2;shop(t,actor);
 }else if(a.type==='lock')p.locked=!p.locked;
 else if(a.type==='level'){if(p.level>=10||p.gold<5)throw Error('购买经验需要 5 金币');p.gold-=5;xp(p,4);
 }else if(a.type==='equip'){
  const u=p.units.find(u=>u.uid===a.uid);if(!u||u.items.length>=3||!Number.isInteger(a.slot)||!ITEMS[p.inventory[a.slot]])throw Error('请选择装备和持有它的棋子');u.items.push(p.inventory.splice(a.slot,1)[0]);
 }else if(a.type==='ready'){p.ready=true;if(t.players.every(p=>p.hp<=0||p.ready))battles(t);}
 else throw Error('未知操作');t.seq++;return t;
}
const unitValue=u=>{const c=UNITS[u.type];return (c.hp*.018+c.attackValue*.24+c.cost*2)*[1,1.8,3.2][u.star-1];};
export function formation(s,actor){
 const p=s.players[actor],chosen=[],remaining=[...p.units];
 while(chosen.length<Math.min(p.level,p.units.length)){
  const traits=synergyDetails(chosen);remaining.sort((a,b)=>{const score=u=>unitValue(u)+(chosen.some(v=>v.type===u.type)?0:traits.filter(t=>[UNITS[u.type].race,UNITS[u.type].role].includes(t.id)&&t.count+1>=t.next).length*10)+(UNITS[u.type].role==='前卫'&&!chosen.some(v=>UNITS[v.type].role==='前卫')?12:0);return score(b)-score(a)||a.uid.localeCompare(b.uid);});chosen.push(remaining.shift());
 }
 const taken=new Set(),layout=chosen.map(u=>{const c=UNITS[u.type],preferred=c.role==='前卫'?[35,36,34,37,33,38,32,39,43,44]:c.role==='刺客'?[56,63,57,62,58,61,59,60]:c.range>1?[59,60,58,61,57,62,56,63,51,52]:[43,44,42,45,41,46,40,47];const cell=[...preferred,...Array.from({length:32},(_,i)=>32+i)].find(c=>!taken.has(c));taken.add(cell);return {uid:u.uid,cell};});return {type:'arrange',layout};
}
export function chessPlan(s,actor,style=s.players[actor].style||'balanced'){
 const actions=[];let t=s;const add=a=>{t=stepChess(t,actor,a);actions.push(a);};
 for(let count=0;count<24;count++){
  const p=t.players[actor],reserve=s.round<=5||p.hp<30?0:style==='economy'?Math.min(50,10*Math.floor(s.round/4)):style==='strength'?Math.min(20,10*Math.floor(s.round/8)):Math.min(40,10*Math.floor(s.round/5));
  const types=new Set(p.units.map(u=>u.type));
  const offers=p.shop.map((id,slot)=>{const c=UNITS[id];if(!c||p.gold-c.cost<reserve)return null;const same=p.units.filter(u=>u.type===id),merging=same.filter(u=>u.star===1).length>=2;if(bench(p).length>=8&&!merging)return null;const syn=synergyDetails(p.units),value=(merging?50:same.length?18:0)+(p.units.length<p.level?30:0)+(!types.has(id)?syn.filter(tr=>[c.race,c.role].includes(tr.id)).length*7:0)+c.cost*3-(same.some(u=>u.star===3)?90:0);return {slot,value};}).filter(Boolean).sort((a,b)=>b.value-a.value||a.slot-b.slot);
  if(offers[0]?.value>=12){add({type:'buy',slot:offers[0].slot});continue;}
  if(p.level<10&&p.gold>=reserve+5&&(p.units.length>p.level||style==='level')&&p.level<Math.min(10,3+Math.floor(s.round/3))){add({type:'level'});continue;}
  if(p.gold>=reserve+2&&actions.filter(a=>a.type==='roll').length<(style==='strength'?3:style==='economy'?0:1)&&bench(p).length<8){add({type:'roll'});continue;}
  break;
 }
 add(formation(t,actor));
 for(let i=0;i<3&&t.players[actor].inventory.length;i++){const u=board(t.players[actor]).filter(u=>u.items.length<3).sort((a,b)=>unitValue(b)-unitValue(a))[0];if(!u)break;add({type:'equip',slot:0,uid:u.uid});}
 add({type:'ready'});return actions;
}
export function chessPacket(s,actor){const p=s.players[actor];return {state:{round:s.round,yourHP:p.hp,gold:p.gold,population:p.level,owned:p.units.map(u=>({type:u.type,stars:u.star})),shop:p.shop},questions:{move:{type:'choice',instructions:'Choose an economy plan for an eight-player auto battler.',criteria:{balanced:'Buy useful copies, preserve interest.',economy:'Save for interest.',strength:'Spend to protect health.',level:'Prioritize population and higher-cost units.'}}}};}
export function chessView(s,actor){const t=structuredClone(s);delete t.seed;delete t.roll;delete t.uid;delete t.pool;t.players.forEach((p,i)=>{if(i!==actor)delete p.shop;});return t;}
