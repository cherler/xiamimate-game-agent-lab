import {noise} from './common.mjs';
import {UNIT_LIST,UNITS,SHOP_ODDS,LEVEL_COST} from './chess-catalog-v1.mjs';
import {runBattle,synergies,synergyLabels} from './chess-battle-v1.mjs';
export {UNIT_LIST,UNITS,LEVEL_COST,synergies,synergyLabels};
const board=p=>p.units.filter(u=>u.cell!==null),bench=p=>p.units.filter(u=>u.cell===null);
const cellAllowed=(actor,cell)=>Number.isInteger(cell)&&cell>=0&&cell<36&&(actor===0?cell>=18:cell<18);
function shop(s,actor){
 const p=s.players[actor];for(const type of p.shop)if(type)s.pool[type]++;
 p.shop=[];for(let i=0;i<4;i++){
  const available=[1,2,3].filter(cost=>UNIT_LIST.some(u=>u.cost===cost&&s.pool[u.id]>0)),weights=SHOP_ODDS[p.level];
  const sum=available.reduce((v,c)=>v+weights[c-1],0);let r=noise(s.seed,s.roll++,actor+55)*sum,cost=available.at(-1);
  if(!sum){p.shop.push(null);continue;}
  for(const c of available){r-=weights[c-1];if(r<0){cost=c;break;}}
  const types=UNIT_LIST.filter(u=>u.cost===cost&&s.pool[u.id]>0);let index=Math.floor(noise(s.seed,s.roll++,actor+66)*types.reduce((v,u)=>v+s.pool[u.id],0)),picked=null;
  for(const u of types){index-=s.pool[u.id];if(index<0){picked=u.id;break;}}
  p.shop.push(picked);if(picked)s.pool[picked]--;
 }
}
export function initChess(seed=1){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('开局无效');
 const s={game:'chess',version:1,seed,seq:0,round:1,roll:0,uid:0,phase:'prep',winner:null,reason:'',log:[],battle:null,lastBattle:null,pool:Object.fromEntries(UNIT_LIST.map(u=>[u.id,12])),players:[0,1].map(()=>({hp:30,gold:5,level:3,units:[],shop:[],locked:false,ready:false}))};
 for(const actor of seed%2?[1,0]:[0,1])shop(s,actor);return s;
}
function merge(p,type,preferred){
 for(let star=1;star<=2;star++){
  let group=p.units.filter(u=>u.type===type&&u.star===star);
  while(group.length>=3){
   const keep=group.find(u=>u.uid===preferred)||group.find(u=>u.cell!==null)||group[0],remove=group.filter(u=>u.uid!==keep.uid).slice(0,2);
   keep.star++;p.units=p.units.filter(u=>!remove.includes(u));group=p.units.filter(u=>u.type===type&&u.star===star);
  }
 }
}
export function stepChess(s,actor,a){
 if(s.winner!==null)throw Error('对局已经结束');
 if(a.type==='advance'){
  if(actor!==-1||s.phase!=='battle')throw Error('战斗尚未完成');const t=structuredClone(s);t.seq++;
  for(const i of [0,1]){t.players[i].hp-=t.battle.damage[i];t.players[i].ready=false;}
  t.lastBattle={winner:t.battle.winner,damage:t.battle.damage,stats:t.battle.stats};
  const dead=t.players.map(p=>p.hp<=0);
  if(dead.some(Boolean)||t.round>=20){t.winner=dead[0]&&dead[1]?-1:dead[0]?1:dead[1]?0:t.players[0].hp===t.players[1].hp?-1:Number(t.players[1].hp>t.players[0].hp);t.reason=dead.some(Boolean)?'棋手生命归零':'二十轮结束';t.phase='ended';return t;}
  t.round++;t.phase='prep';
  for(const i of [0,1]){const p=t.players[i];p.gold+=5+Math.min(3,Math.floor(p.gold/5))+(t.battle.winner===i?1:0);}
  t.battle=null;for(const i of t.round%2?[0,1]:[1,0])if(!t.players[i].locked)shop(t,i);
  return t;
 }
 if(![0,1].includes(actor)||s.phase!=='prep'||s.players[actor].ready)throw Error('现在不能调整阵容');
 const t=structuredClone(s),p=t.players[actor];
 if(a.type==='buy'){
  if(!Number.isInteger(a.slot)||a.slot<0||a.slot>=4)throw Error('商品无效');
  const type=p.shop[a.slot],c=UNITS[type];if(!c||p.gold<c.cost)throw Error('金币不足或商品已售');
  p.gold-=c.cost;p.shop[a.slot]=null;p.units.push({uid:'c'+t.uid++,type,star:1,cell:null});merge(p,type,a.keep);
  if(bench(p).length>5)throw Error('备战席已满，请先卖出或上阵');
  t.log.push((actor===0?'青方':'橙方')+'购买'+c.name);
 }else if(a.type==='sell'){
  const u=p.units.find(u=>u.uid===a.uid);if(!u)throw Error('棋子不存在');const copies=3**(u.star-1);p.gold+=UNITS[u.type].cost*copies;t.pool[u.type]+=copies;p.units=p.units.filter(x=>x.uid!==u.uid);
 }else if(a.type==='move'){
  const u=p.units.find(u=>u.uid===a.uid);if(!u||!cellAllowed(actor,a.cell))throw Error('请选择己方的格子');
  const other=p.units.find(v=>v.cell===a.cell);if(other)other.cell=u.cell;u.cell=a.cell;if(board(p).length>p.level)throw Error('上场人数已满');
 }else if(a.type==='bench'){
  const u=p.units.find(u=>u.uid===a.uid);if(!u||u.cell===null||bench(p).length>=5)throw Error('无法放回备战席');u.cell=null;
 }else if(a.type==='arrange'){
  if(!Array.isArray(a.layout)||a.layout.length>p.level||new Set(a.layout.map(x=>x.uid)).size!==a.layout.length||new Set(a.layout.map(x=>x.cell)).size!==a.layout.length||!a.layout.every(x=>p.units.some(u=>u.uid===x.uid)&&cellAllowed(actor,x.cell)))throw Error('阵容无效');
  if(p.units.length-a.layout.length>5)throw Error('备战席已满');for(const u of p.units)u.cell=a.layout.find(x=>x.uid===u.uid)?.cell??null;
 }else if(a.type==='roll'){if(p.gold<2)throw Error('刷新需要 2 金币');p.gold-=2;shop(t,actor);
 }else if(a.type==='lock')p.locked=!p.locked;
 else if(a.type==='level'){const cost=LEVEL_COST[p.level];if(!cost||p.gold<cost)throw Error('金币不足或人口已满');p.gold-=cost;p.level++;
 }else if(a.type==='ready'){p.ready=true;if(t.players.every(p=>p.ready)){t.phase='battle';t.battle=runBattle(t);}}
 else throw Error('未知操作');
 t.seq++;t.log=t.log.slice(-20);return t;
}
function strength(units){
 const syn=synergies(units);return units.reduce((v,u)=>v+(UNITS[u.type].hp*.018+UNITS[u.type].attackValue*.22)*[1,1.8,3.2][u.star-1],0)
  +Object.values(syn.races).reduce((v,n)=>v+(n>=3?8:n>=2?4:0),0)+Object.values(syn.roles).reduce((v,n)=>v+(n>=4?12:n>=2?4:0),0)
  +(units.some(u=>UNITS[u.type].role==='前卫')?8:-12);
}
export function formation(s,actor){
 const p=s.players[actor],n=Math.min(p.level,p.units.length);let best=[],bestValue=-Infinity;
 function combinations(start,picked){if(picked.length===n){const value=strength(picked);if(value>bestValue){bestValue=value;best=[...picked];}return;}for(let i=start;i<=p.units.length-(n-picked.length);i++)combinations(i+1,[...picked,p.units[i]]);}
 combinations(0,[]);const taken=new Set();
 const layout=best.sort((a,b)=>Number(UNITS[a.type].role!=='前卫')-Number(UNITS[b.type].role!=='前卫')||b.star-a.star).map(u=>{
  const c=UNITS[u.type],preferred=c.role==='前卫'?[20,21,19,22,18,23]:c.range===1?[24,29,25,28,26,27]:[31,34,30,35,32,33];
  const cell=preferred.find(c=>!taken.has(c));taken.add(cell);return {uid:u.uid,cell:actor===0?cell:35-cell};
 });return {type:'arrange',layout};
}
export function chessPlan(s,actor,style='balanced'){
 const actions=[];let t=s;
 const add=a=>{t=stepChess(t,actor,a);actions.push(a);};
 for(let count=0;count<24;count++){
  const p=t.players[actor],reserve=p.hp<12||s.round<=2||style==='strength'?0:style==='economy'?10:5;
  const cost=LEVEL_COST[p.level];
  if(cost&&p.gold>=cost+reserve&&p.units.length>p.level&&(style==='level'||p.units.filter(u=>u.star>=2).length>=2)){add({type:'level'});continue;}
  const types=[...new Set(p.units.map(u=>u.type))],syn=synergies(p.units);
  const offers=p.shop.map((id,slot)=>{
   const c=UNITS[id];if(!c||p.gold-c.cost<reserve)return null;
   const same=p.units.filter(u=>u.type===id),copies=same.reduce((n,u)=>n+3**(u.star-1),0);
   const merging=same.filter(u=>u.star===1).length>=2;
   if(bench(p).length>=5&&!merging)return null;
   const value=(merging?35:copies?12:0)+(p.units.length<p.level?18:0)+(!types.includes(id)?(syn.races[c.race]===1?7:0)+(syn.roles[c.role]===1?7:0):0)+c.cost*2-(same.some(u=>u.star===3)?80:0);
   return {slot,value};
  }).filter(Boolean).sort((a,b)=>b.value-a.value||a.slot-b.slot);
  if(offers[0]?.value>=8){add({type:'buy',slot:offers[0].slot});continue;}
  if(cost&&p.gold>=cost+reserve&&(style==='level'||p.units.length>=p.level)){add({type:'level'});continue;}
  const rolls=actions.filter(a=>a.type==='roll').length;
  if(p.gold>=reserve+2&&rolls<(style==='strength'?3:style==='economy'?0:1)&&bench(p).length<5){add({type:'roll'});continue;}
  break;
 }
 add(formation(t,actor));add({type:'ready'});return actions;
}
export function chessPacket(s,actor){
 const p=s.players[actor],e=s.players[1-actor];return {state:{round:s.round,yourHP:p.hp,enemyHP:e.hp,gold:p.gold,population:p.level,owned:p.units.map(u=>({type:u.type,stars:u.star})),shop:p.shop},questions:{move:{type:'choice',instructions:'Choose an economy plan for this auto battler preparation round. Protect low health, improve your army, and save gold for interest when safe.',criteria:{balanced:'Buy upgrades and useful synergies, keep a small savings buffer.',economy:'Save at least 10 gold after round 2 unless health is below 12; avoid rerolling.',strength:'Spend now on copies and useful units, reroll up to 3 times to protect health.',level:'Prioritize buying more population when affordable, then field a larger team.'}}}};
}
export function chessView(s,actor){const t=structuredClone(s);delete t.seed;delete t.roll;delete t.uid;delete t.pool;t.players.forEach((p,i)=>{if(i!==actor){delete p.gold;delete p.shop;delete p.locked;}});return t;}
