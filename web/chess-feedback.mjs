import {board,synergyDetails} from '../src/chess.mjs';
import {chessInfo} from '../src/chess-catalog.mjs';

export function traitChange(before,after){
 const a=synergyDetails(before),b=synergyDetails(after);
 return b.map(t=>({...t,before:a.find(v=>v.id===t.id)?.count||0,wasLevel:a.find(v=>v.id===t.id)?.level||0})).filter(t=>t.count!==t.before);
}
export function recruitPreview(player,type){
 const ones=player.units.filter(u=>u.type===type&&u.star===1).length;
 const twos=player.units.filter(u=>u.type===type&&u.star===2).length;
 const deployed=board(player),traits=traitChange(deployed,[...deployed,{type}]);
 return {ones,mergeStar:ones>=2?(twos>=2?3:2):null,traits,needsSwap:deployed.length>=player.level};
}
export function placementPreview(player,uid,cell){
 const units=structuredClone(player.units),u=units.find(u=>u.uid===uid);
 if(!u||cell<32||cell>63)return null;
 const other=units.find(v=>v.cell===cell);if(other&&other!==u)other.cell=u.cell;u.cell=cell;
 const after=units.filter(u=>u.cell!==null);
 return {legal:after.length<=player.level,population:after.length,traits:traitChange(board(player),after)};
}
export function battleMoment(battle){
 if(!battle?.frames?.length)return null;
 if(battle.winner!==0){
  for(let i=1;i<battle.frames.length;i++){
   const first=battle.frames[i-1].units.find(u=>u.actor===0&&!u.summon&&!battle.frames[i].units.some(v=>v.uid===u.uid));
   if(first)return {...first,label:'最先倒下',value:Math.round(battle.frames[i].tick/10)+' 秒',name:chessInfo(first.type)?.name||'棋子'};
  }
 }
 const best=battle.stats?.filter(u=>u.actor===0&&!u.summon).sort((a,b)=>b.dealt-a.dealt)[0];
 const unit=best&&battle.frames[0].units.find(u=>u.uid===best.uid);
 return unit?{...unit,label:'主要输出',value:best.dealt+' 伤害',name:chessInfo(unit.type)?.name||'棋子'}:null;
}
