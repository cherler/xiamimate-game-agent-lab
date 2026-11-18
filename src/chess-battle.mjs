import {UNITS,NEUTRALS,chessInfo,ITEMS,TRAITS} from './chess-catalog.mjs';
import {noise} from './common.mjs';
export const distance=(a,b)=>Math.max(Math.abs(a%8-b%8),Math.abs(Math.floor(a/8)-Math.floor(b/8)));
const adjacent=cell=>[-1,0,1].flatMap(dy=>[-1,0,1].filter(dx=>dx||dy).map(dx=>[cell%8+dx,Math.floor(cell/8)+dy])).filter(([x,y])=>x>=0&&x<8&&y>=0&&y<8).map(([x,y])=>y*8+x);
export function synergies(units){
 const types=[...new Set(units.map(u=>u.type))],races={},roles={};
 for(const type of types){const u=chessInfo(type);races[u.race]=(races[u.race]||0)+1;roles[u.role]=(roles[u.role]||0)+1;}
 return {races,roles};
}
export function synergyDetails(units){const syn=synergies(units);return Object.entries({...syn.races,...syn.roles}).filter(([id])=>TRAITS[id]).map(([id,count])=>{const trait=TRAITS[id],level=trait.thresholds.filter(n=>count>=n).length;return {id,count,level,next:trait.thresholds.find(n=>n>count)||trait.thresholds.at(-1),text:trait.text[Math.max(0,level-1)]};});}
export function synergyLabels(units){return synergyDetails(units).filter(t=>t.level).map(t=>t.count+' '+t.id);}
export function combatUnits(s){return s.players.flatMap((p,actor)=>{const team=p.units.filter(u=>u.cell!==null),details=synergyDetails(team),tier=id=>details.find(t=>t.id===id)?.level||0;return team.map(u=>{const c=chessInfo(u.type),star=[1,1.8,3.2][u.star-1],items=(u.items||[]).map(id=>ITEMS[id]).filter(Boolean),bonus=key=>items.reduce((n,i)=>n+(i[key]||0),0),hp=Math.round(c.hp*star*(c.race==='岩灵'?1+.15*tier(c.race):1)+bonus('hp')),role=tier(c.role),speed=(c.role==='游击'?[0,.15,.3,.5][role]:0)+bonus('speed');return {...u,actor,maxHp:hp,hp,attack:Math.round(c.attackValue*star*(c.race==='游民'?1+.12*tier(c.race):1)+bonus('attack')),range:c.range,interval:Math.ceil(c.interval*10/(1+speed)),skill:[1,1.6,2.6][u.star-1]*(c.role==='术师'?1+[0,.15,.3,.5][role]:1),energy:Math.min(100,(c.race==='星塔'?25*tier(c.race):0)+bonus('mana')),regen:(c.race==='林地'?.03*tier(c.race):0)+bonus('regen'),reduction:Math.min(.65,(c.role==='前卫'?[0,.08,.16,.25][role]:0)+(c.race==='潮汐'?.08*tier(c.race):0)+bonus('reduction')),crit:c.role==='刺客'?.4*role:0,hits:0,shields:c.race==='工坊'&&tier(c.race)?[{key:'origin',value:tier(c.race)===1?100:220,expires:10000}]:[],nextAttack:0,nextMove:0,buffHits:c.role==='刺客'?3:0,buffAmount:c.role==='刺客'?Math.round(30*star):0,dealt:0,taken:0,healed:0,summon:false};});});}
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
 let events=[];const frame=()=>{frames.push({tick:clock,events,units:units.map(u=>({uid:u.uid,type:u.type,actor:u.actor,cell:u.cell,star:u.star,hp:u.hp,maxHp:u.maxHp,energy:u.energy,shield:u.shields.reduce((v,a)=>v+a.value,0),summon:u.summon}))});events=[];};
 const order=u=>noise(s.seed,s.round,Number(u.uid.replace(/\D/g,''))+71);
 for(const u of [...units].filter(u=>chessInfo(u.type)?.role==='刺客').sort((a,b)=>order(a)-order(b))){
  const targets=units.filter(v=>v.actor!==u.actor).sort((a,b)=>distance(u.cell,b.cell)-distance(u.cell,a.cell)||order(a)-order(b));
  const spaces=targets[0]?adjacent(targets[0].cell).filter(c=>!units.some(v=>v.cell===c)):[];
  if(spaces.length)u.cell=spaces.sort((a,b)=>distance(a,u.cell)-distance(b,u.cell)||a-b)[0];
 }
 frame();
 while(clock<450&&units.some(u=>u.actor===0)&&units.some(u=>u.actor===1)){
  clock++;const occupied=new Set(units.map(u=>u.cell)),hits=[],heals=[],shields=[],moves=[],summons=[];
  for(const u of units){
   u.shields=u.shields.filter(a=>a.expires>clock&&a.value>0);if(chessInfo(u.type)?.role!=='刺客'&&!u.summon)u.energy=Math.min(100,u.energy+.5);
   const enemies=units.filter(v=>v.actor!==u.actor).sort((a,b)=>distance(u.cell,a.cell)-distance(u.cell,b.cell)||order(a)-order(b));
   if(!enemies.length)continue;
   let target=enemies.find(v=>distance(u.cell,v.cell)<=u.range)||enemies[0];
   const amount=n=>Math.round(n*u.skill),hit=(v,n)=>{if(v)hits.push([u,v,amount(n)]);};
   const shield=(v,n)=>shields.push([v,{key:u.uid,value:amount(n),expires:clock+40}]);
   const injured=units.filter(v=>v.actor===u.actor&&v.hp<v.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||order(a)-order(b));
   const skill=chessInfo(u.type)?.skill||u.type;let cast=u.energy>=100&&!u.summon&&chessInfo(u.type)?.role!=='刺客'&&skill!=='none';
   if(u.type==='C04'&&u.hp>=u.maxHp||u.type==='C06'&&!injured.length)cast=false;
   if(cast){
    u.energy=0;events.push({kind:'cast',source:u.uid,target:target.uid});
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
    if(skill==='guard'){shield(u,220);for(const v of units.filter(v=>v.actor===u.actor&&distance(u.cell,v.cell)<=1))shield(v,100);}
    if(skill==='bolt')hit(target,u.type==='C18'?260:180);
    if(skill==='heal')for(const v of injured.slice(0,3))heals.push([u,v,amount(220)]);
    if(skill==='quake'){for(const v of enemies.filter(v=>distance(u.cell,v.cell)<=2))hit(v,240);shield(u,250);}
    if(skill==='nova')for(const v of enemies.filter(v=>distance(v.cell,target.cell)<=1))hit(v,260);
    if(skill==='meteor')for(const v of enemies)hit(v,240);
    if(u.type==='C12')for(const v of enemies.filter(v=>distance(v.cell,target.cell)<=1))hit(v,160);
   }else if(distance(u.cell,target.cell)<=u.range){
    if(clock>=u.nextAttack){hits.push([u,target,Math.round(u.attack*(++u.hits%3===0?1+u.crit:1))+(u.buffHits>0?u.buffAmount:0)]);u.buffHits=Math.max(0,u.buffHits-1);u.nextAttack=clock+u.interval;if(!u.summon&&chessInfo(u.type)?.role!=='刺客')u.energy=Math.min(100,u.energy+10);}
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
   const real=Math.max(0,Math.min(rest,target.hp));target.hp-=rest;source.dealt+=real;target.taken+=real;target.energy=Math.min(100,target.energy+Math.min(20,real/12));events.push({kind:'hit',source:source.uid,target:target.uid,amount:real});
  }
  units=units.filter(u=>u.hp>0);
  for(const [source,target,n] of heals)if(target.hp>0){const actual=Math.min(target.maxHp-target.hp,n);target.hp+=actual;source.healed+=actual;if(actual)events.push({kind:'heal',source:source.uid,target:target.uid,amount:actual});}
  for(const caster of summons)for(let n=0;n<2;n++){
   if(units.filter(u=>u.actor===caster.actor).length>=16)break;
   const free=Array.from({length:64},(_,i)=>i).filter(c=>!units.some(u=>u.cell===c)).sort((a,b)=>distance(a,caster.cell)-distance(b,caster.cell)||a-b);if(!free.length)break;
   const hp=Math.round(150*caster.skill),u={...caster,uid:'summon'+(++spawnId),type:'T02',star:1,hp,maxHp:hp,attack:Math.round(25*caster.skill),cell:free[0],range:1,interval:10,energy:0,shields:[],nextAttack:clock+1,nextMove:clock+1,buffHits:0,buffAmount:0,regen:0,reduction:0,summon:true,dealt:0,taken:0,healed:0};
   units.push(u);allStats.set(u.uid,u);
  }
  if(clock%3===0)frame();
 }
 if(frames.at(-1)?.tick!==clock)frame();
 const living=[0,1].map(a=>units.filter(u=>u.actor===a));
 const winner=!living[0].length&&!living[1].length||living.every(x=>x.length)?-1:living[0].length?0:1;
 const loss=team=>Math.min(30,Math.max(1,Math.floor(s.round/8))+team.filter(u=>!u.summon).reduce((n,u)=>n+u.star,0)+(s.round>=30?5:0));const damage=winner===-1?[2,2]:winner===0?[0,loss(living[0])]:[loss(living[1]),0];
 return {frames,ticks:clock,winner,damage,stats:[...allStats.values()].map(u=>({uid:u.uid,type:u.type,actor:u.actor,dealt:u.dealt,taken:u.taken,healed:u.healed}))};
}
