import {CARD_LIST,HEROES} from './catalog.mjs';
import {noise} from './common.mjs';
export function beginDraft(seed,faction){if(!HEROES[faction]||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('轮抽设置无效');return {seed,faction,picks:[]};}
export function draftOptions(d){
 if(d.picks.length>=20)return [];
 const eligible=CARD_LIST.filter(c=>(c.id[0]==='N'||c.id[0]===d.faction)&&d.picks.filter(id=>id===c.id).length<2);
 const order=eligible.sort((a,b)=>noise(d.seed,d.picks.length,Number(a.id.slice(1))+a.id.charCodeAt(0)*37)-noise(d.seed,d.picks.length,Number(b.id.slice(1))+b.id.charCodeAt(0)*37));
 // Every offer has a unit; every fifth offer includes a cheap opening card.
 const first=order.find(c=>c.kind==='unit'&&(d.picks.length%5!==0||c.cost<=2))||order.find(c=>c.kind==='unit')||order[0];
 return [first,...order.filter(c=>c.id!==first.id).slice(0,2)].map(c=>c.id);
}
export function pickDraft(d,id){if(!draftOptions(d).includes(id))throw Error('请选择当前提供的卡牌');return {...d,picks:[...d.picks,id]};}
export function manaCurve(deck){return Array.from({length:7},(_,cost)=>deck.filter(id=>{const c=CARD_LIST.find(c=>c.id===id);return c&&(cost===6?c.cost>=6:c.cost===cost);}).length);}
