import {UNITS} from './chess-catalog-v1.mjs';
import {noise} from './common.mjs';
export const distance=(a,b)=>Math.abs(a%6-b%6)+Math.abs(Math.floor(a/6)-Math.floor(b/6));
const adjacent=cell=>[cell-6,cell+6,...(cell%6?[cell-1]:[]),...(cell%6<5?[cell+1]:[])].filter(n=>n>=0&&n<36);
export function synergies(units){
 const types=[...new Set(units.map(u=>u.type))],races={},roles={};
 for(const type of types){const u=UNITS[type];races[u.race]=(races[u.race]||0)+1;roles[u.role]=(roles[u.role]||0)+1;}
 return {races,roles};
}
export function synergyLabels(units){const {races,roles}=synergies(units);return [...Object.entries(races).filter(([,v])=>v>=2).map(([k,v])=>`${v>=3?3:2} ${k}`),...Object.entries(roles).filter(([,v])=>v>=2).map(([k,v])=>`${v>=4?4:2} ${k}`)];}
function tier(count,high){return count>=high?2:count>=2?1:0;}
export function combatUnits(s){
 return s.players.flatMap((p,actor)=>{
  const team=p.units.filter(u=>u.cell!==null),syn=synergies(team);
  return team.map(u=>{
   const c=UNITS[u.type],star=[1,1.8,3.2][u.star-1],skill=[1,1.6,2.6][u.star-1];
   const raceTier=tier(syn.races[c.race],3),roleTier=tier(syn.roles[c.role],4);
   const hp=Math.round(c.hp*star*(c.race==='岩灵'?1+.12*raceTier:1));
   const speed=(c.race==='游民'?.1*raceTier:0)+(c.role==='游击'?.15*roleTier:0);
   return {...u,actor,maxHp:hp,hp,attack:Math.round(c.attackValue*star),range:c.range,interval:Math.ceil(c.interval*10/(1+speed)),
    skill,energy:c.role==='术师'?30*roleTier:0,regen:c.race==='林地'?.03*raceTier:0,reduction:c.role==='前卫'?.1*roleTier:0,
    shields:c.race==='工坊'&&raceTier?[{key:'origin',value:70*raceTier,expires:10000}]:[],nextAttack:0,nextMove:0,buffHits:u.type==='C08'?3:0,buffAmount:u.type==='C08'?Math.round(30*skill):0,
    dealt:0,taken:0,healed:0,summon:false};
  });
 });
}
function pathStep(unit,target,occupied,tick){
 const queue=[[unit.cell,null]],seen=new Set([unit.cell]);
 for(let i=0;i<queue.length;i++){
  const [cell,first]=queue[i];if(distance(cell,target.cell)<=unit.range)return first;
  const ns=adjacent(cell),shift=(tick+Number(unit.uid.replace(/\D/g,'')))%Math.max(1,ns.length);
  const ordered=ns.slice(shift).concat(ns.slice(0,shift));
  for(const n of ordered)if(!occupied.has(n)&&!seen.has(n)){seen.add(n);queue.push([n,first??n]);}
 }return null;
}
export function runBattle(s){
 let units=combatUnits(s),clock=0,spawnId=0;const frames=[];
 const allStats=new Map(units.map(u=>[u.uid,u]));
 const frame=()=>frames.push({tick:clock,units:units.map(u=>({uid:u.uid,type:u.type,actor:u.actor,cell:u.cell,star:u.star,hp:u.hp,maxHp:u.maxHp,energy:u.energy,shield:u.shields.reduce((v,a)=>v+a.value,0),summon:u.summon}))});
 const order=u=>noise(s.seed,s.round,Number(u.uid.replace(/\D/g,''))+71);
 for(const u of [...units].filter(u=>u.type==='C08').sort((a,b)=>order(a)-order(b))){
  const targets=units.filter(v=>v.actor!==u.actor).sort((a,b)=>distance(u.cell,b.cell)-distance(u.cell,a.cell)||order(a)-order(b));
  const spaces=targets[0]?adjacent(targets[0].cell).filter(c=>!units.some(v=>v.cell===c)):[];
  if(spaces.length)u.cell=spaces.sort((a,b)=>distance(a,u.cell)-distance(b,u.cell)||a-b)[0];
 }
 frame();
 while(clock<300&&units.some(u=>u.actor===0)&&units.some(u=>u.actor===1)){
  clock++;const occupied=new Set(units.map(u=>u.cell)),hits=[],heals=[],shields=[],moves=[],summons=[];
  for(const u of units){
   u.shields=u.shields.filter(a=>a.expires>clock&&a.value>0);if(u.type!=='C08'&&!u.summon)u.energy=Math.min(100,u.energy+.5);
   const enemies=units.filter(v=>v.actor!==u.actor).sort((a,b)=>distance(u.cell,a.cell)-distance(u.cell,b.cell)||order(a)-order(b));
   if(!enemies.length)continue;
   let target=enemies.find(v=>distance(u.cell,v.cell)<=u.range)||enemies[0];
   const amount=n=>Math.round(n*u.skill),hit=(v,n)=>{if(v)hits.push([u,v,amount(n)]);};
   const shield=(v,n)=>shields.push([v,{key:u.uid,value:amount(n),expires:clock+40}]);
   const injured=units.filter(v=>v.actor===u.actor&&v.hp<v.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||order(a)-order(b));
   let cast=u.energy>=100&&!u.summon&&u.type!=='C08';
   if(u.type==='C04'&&u.hp>=u.maxHp||u.type==='C06'&&!injured.length)cast=false;
   if(cast){
    u.energy=0;
    if(u.type==='C01')shield(u,180);
    if(u.type==='C02'){u.buffHits=3;u.buffAmount=amount(40);}
    if(u.type==='C03')summons.push(u);
    if(u.type==='C04')heals.push([u,u,amount(180)]);
    if(u.type==='C05'){hit(target,130);shield(u,120);}
    if(u.type==='C06')for(const v of injured.slice(0,3))heals.push([u,v,amount(160)]);
    if(u.type==='C07'){shield(u,100);for(const v of units.filter(v=>v.actor===u.actor&&distance(u.cell,v.cell)===1))shield(v,80);}
    if(u.type==='C09')hit([...enemies].sort((a,b)=>distance(u.cell,b.cell)-distance(u.cell,a.cell)||order(a)-order(b))[0],220);
    if(u.type==='C10'){for(const v of enemies.filter(v=>distance(u.cell,v.cell)===1))hit(v,140);shield(u,200);}
    if(u.type==='C11')hit(target,160);
    if(u.type==='C12')for(const v of enemies.filter(v=>distance(v.cell,target.cell)<=1))hit(v,160);
   }else if(distance(u.cell,target.cell)<=u.range){
    if(clock>=u.nextAttack){hits.push([u,target,u.attack+(u.buffHits>0?u.buffAmount:0)]);u.buffHits=Math.max(0,u.buffHits-1);u.nextAttack=clock+u.interval;if(!u.summon&&u.type!=='C08')u.energy=Math.min(100,u.energy+10);}
   }else if(clock>=u.nextMove){
    let step=null;for(const enemy of enemies){step=pathStep(u,enemy,occupied,clock);if(step!==null){target=enemy;break;}}
    if(step!==null)moves.push([u,step]);u.nextMove=clock+4;
   }
   if(clock%30===0&&u.regen)heals.push([u,u,Math.round(u.maxHp*u.regen)]);
  }
  const reserved=new Set();moves.sort((a,b)=>((Number(a[0].uid.replace(/\D/g,''))+clock)%101)-((Number(b[0].uid.replace(/\D/g,''))+clock)%101));
  for(const [u,cell] of moves)if(!reserved.has(cell)){u.cell=cell;reserved.add(cell);}
  for(const [u,a] of shields){u.shields=u.shields.filter(x=>x.key!==a.key);u.shields.push(a);}
  for(const [source,target,damage] of hits){
   let rest=Math.round(damage*(1-target.reduction));target.shields.sort((a,b)=>a.expires-b.expires);
   for(const shield of target.shields){const absorbed=Math.min(rest,shield.value);rest-=absorbed;shield.value-=absorbed;}
   const real=Math.max(0,Math.min(rest,target.hp));target.hp-=rest;source.dealt+=real;target.taken+=real;
  }
  units=units.filter(u=>u.hp>0);
  for(const [source,target,n] of heals)if(target.hp>0){const actual=Math.min(target.maxHp-target.hp,n);target.hp+=actual;source.healed+=actual;}
  for(const caster of summons)for(let n=0;n<2;n++){
   if(units.filter(u=>u.actor===caster.actor).length>=12)break;
   const free=Array.from({length:36},(_,i)=>i).filter(c=>!units.some(u=>u.cell===c)).sort((a,b)=>distance(a,caster.cell)-distance(b,caster.cell)||a-b);if(!free.length)break;
   const hp=Math.round(150*caster.skill),u={...caster,uid:'summon'+(++spawnId),type:'T02',star:1,hp,maxHp:hp,attack:Math.round(25*caster.skill),cell:free[0],range:1,interval:10,energy:0,shields:[],nextAttack:clock+1,nextMove:clock+1,buffHits:0,buffAmount:0,regen:0,reduction:0,summon:true,dealt:0,taken:0,healed:0};
   units.push(u);allStats.set(u.uid,u);
  }
  if(clock%3===0)frame();
 }
 if(frames.at(-1)?.tick!==clock)frame();
 const living=[0,1].map(a=>units.filter(u=>u.actor===a));
 const winner=!living[0].length&&!living[1].length||living.every(x=>x.length)?-1:living[0].length?0:1;
 const damage=winner===-1?[2,2]:winner===0?[0,2+living[0].filter(u=>!u.summon).length]:[2+living[1].filter(u=>!u.summon).length,0];
 return {frames,ticks:clock,winner,damage,stats:[...allStats.values()].map(u=>({uid:u.uid,type:u.type,actor:u.actor,dealt:u.dealt,taken:u.taken,healed:u.healed}))};
}
