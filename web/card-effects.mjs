import {cardInfo} from '../src/cards.mjs';
import {HEROES,POWER_ALTERNATIVES} from '../src/catalog.mjs';
import {glyph,captureTable,animateTable} from './card-table.mjs';
import {portrait} from './art.mjs';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const artFor=f=>({W:'W03',F:'F03',S:'S05'}[f]||'N01');
const themeFor=id=>id?.startsWith('F')?'forest':id?.startsWith('S')?'starlight':id?.startsWith('N')?'neutral':'workshop';
const iconFor=kind=>({damage:'sword',block:'shield',heal:'heart',buff:'up',death:'skull',summon:'plus',draw:'cards',generate:'cards',burn:'cross',mana:'gem',freeze:'snow',silence:'cross',shield:'shield',full:'cross'}[kind]||'spark');
const primaryEvents=e=>e.events.filter(x=>!['trigger','turn'].includes(x.kind));
export function sourceInfo(source={}){
 const c=cardInfo(source.cardId,source.version),hero=HEROES[source.faction];
 if(source.kind==='cycle')return {name:'手牌调度',art:artFor(source.faction),effect:'花费 1 能量，将一张手牌放到牌库底，再抽 1 张。',cost:1,kind:'cycle',theme:'neutral'};
 if(source.kind==='power'&&source.mode){const a=POWER_ALTERNATIVES[source.faction];return {name:a.name,art:a.art,effect:a.text,cost:2,kind:'power',theme:themeFor(source.faction)};}
 return {name:c?.name||(source.kind==='fatigue'?'疲劳':source.kind==='power'?hero?.power:source.kind==='start'?'回合开始':'回合结束')||'英雄技能',art:c?.id||artFor(source.faction),effect:c?.effect||(source.kind==='fatigue'?'牌库已空。':source.kind==='power'?hero?.text:'')||'',cost:c?.cost??(source.kind==='power'?2:null),kind:c?.kind||source.kind,theme:themeFor(c?.id)};
}
export function decoratePresentation(cue,before,after){
 if(!cue)return null;cue=structuredClone(cue);cue.source.version=before?.version||after.version;for(const e of cue.events)if(e.source)e.source.version=cue.source.version;const pieces={};
 for(const s of [before,after])if(s)for(const [actor,p] of s.players.entries()){pieces['h'+actor]={actor,hero:true,faction:p.faction};for(const u of p.board)pieces[u.uid]={actor,cardId:u.cardId};}
 for(const e of cue.events){if(e.source?.uid&&e.source.cardId)pieces[e.source.uid]={actor:e.source.actor,cardId:e.source.cardId};if(e.kind==='summon')pieces[e.unit.uid]={actor:e.actor,cardId:e.unit.cardId};if(e.kind==='death')pieces[e.target]={actor:e.actor,cardId:e.cardId};}
 const focus=['end','mulligan'].includes(cue.source.kind)?cue.events.find(e=>e.kind==='trigger')?.source:cue.source;
 return {...cue,pieces,focus:focus||cue.source,round:Math.max(...after.players.map(p=>p.turns))};
}
export const worthRemembering=entry=>entry&&!['mulligan'].includes(entry.source.kind)&&(!['end'].includes(entry.source.kind)||entry.events.some(e=>['damage','heal','summon','buff'].includes(e.kind)));
function targetInfo(entry,id){const p=entry.pieces[id];return p?.hero?{name:HEROES[p.faction]?.name,art:artFor(p.faction),actor:p.actor}:p?{name:cardInfo(p.cardId)?.name,art:p.cardId,actor:p.actor}:{name:'战场',art:null};}
function amountHTML(e){return ['damage','heal','block'].includes(e.kind)?(e.kind==='damage'?'−':e.kind==='heal'?'+':'')+e.amount:e.kind==='mana'?'+'+e.amount:e.kind==='buff'?`+${e.attackGain}/+${e.healthGain}`:['draw','generate','summon'].includes(e.kind)?'+1':'';}
export function timelineHTML(entries,actor){
 const recent=entries.slice(-7).reverse();
 return `<div class="action-timeline" aria-label="最近行动">${recent.length?recent.map((e,i)=>{const src=sourceInfo(e.focus),outcome=primaryEvents(e).find(x=>x.source?.uid===e.focus.uid&&['damage','heal','buff','block','summon'].includes(x.kind))||primaryEvents(e)[0];return `<button class="action-chip ${i===0?'latest':''} ${e.focus.actor===actor?'by-you':'by-rival'}" data-action-history="${e.seq}" aria-label="${e.focus.actor===actor?'你':'对手'}：${esc(src.name)}，查看经过" title="${esc(src.name)}"><span class="action-thumb ${src.theme}">${portrait(src.art)}</span>${i===0?`<span class="action-chip-title"><small>${e.focus.actor===actor?'你':'对手'}${e.focus.trigger?' · '+e.focus.trigger:''}</small><b>${src.name}</b></span>${outcome?`<span class="action-outcome">${glyph(iconFor(outcome.kind))}${amountHTML(outcome)}</span>`:''}`:''}</button>`;}).join(''):`<span class="timeline-empty">${glyph('cards')}<span>最近行动</span></span>`}</div>`;
}
export function receiptHTML(entry,actor){
 const source=sourceInfo(entry.focus),events=primaryEvents(entry);
 return `<div class="deck-heading"><h2>${entry.focus.actor===actor?'你':'对手'} · ${source.name}</h2><button class="quiet" id="history-close" aria-label="关闭行动记录">${glyph('cross')}</button></div><div class="action-receipt"><article class="revealed-card ${source.theme}">${source.cost!==null?`<span class="mana-orb">${source.cost}</span>`:''}${portrait(source.art)}<strong>${source.name}</strong><p>${esc(source.effect)}</p></article><div class="receipt-sequence">${events.map(e=>{const src=sourceInfo(e.source),target=e.target?targetInfo(entry,e.target):{name:e.kind==='summon'?cardInfo(e.unit?.cardId)?.name:e.kind==='draw'||e.kind==='generate'?'手牌':e.kind==='burn'?'弃牌':'战场',art:e.kind==='summon'?e.unit.cardId:null};const label={damage:'伤害',heal:'治疗',block:'护盾抵挡',buff:'强化',death:'退场',summon:'召唤',draw:'抽牌',generate:'获得',burn:'手牌已满',freeze:'冰封',silence:'沉默',shield:'护盾',full:'战场已满',mana:'能量'}[e.kind]||'';return `<div class="receipt-step ${effectTheme(e,entry)}"><span class="receipt-source">${portrait(src.art)}<small>${src.name}${e.source.trigger?' · '+e.source.trigger:''}</small></span>${glyph('arrow')}<span class="receipt-target">${target.art?portrait(target.art):glyph(iconFor(e.kind))}<small>${target.name}</small></span><b>${glyph(iconFor(e.kind))}${amountHTML(e)}<small>${label}</small></b></div>`;}).join('')}</div></div>`;
}
export function projectCardEvent(s,e){
 const find=id=>id?.startsWith('h')?s.players[Number(id[1])]:s.players.flatMap(p=>p.board).find(u=>u.uid===id),u=find(e.target);
 if((e.kind==='damage'||e.kind==='heal')&&u)u.hp=Math.max(0,e.hp);
 if(e.kind==='block'&&u)u.shield=false;
 if(e.kind==='buff'&&u)Object.assign(u,{attack:e.attack,hp:e.hp,maxHp:e.maxHp});
 if(['shield','freeze'].includes(e.kind)&&u)Object.assign(u,e.change);
 if(e.kind==='silence'&&u)Object.assign(u,e.unit);
 if(e.kind==='summon'&&!find(e.unit.uid))s.players[e.actor].board.push(structuredClone(e.unit));
 if(e.kind==='death')for(const p of s.players)p.board=p.board.filter(u=>u.uid!==e.target);
 if(e.kind==='mana')s.players[e.actor].mana=e.mana;
 if(e.kind==='turn'){s.turn=e.actor;const p=s.players[e.actor];p.turns=e.turns;p.mana=e.mana;p.maxMana=e.maxMana;p.powerUsed=false;p.cardsPlayed=p.spellsPlayed=0;for(const u of p.board){u.fresh=false;u.exhausted=false;u.spellTriggers=0;}}
 return s;
}
function effectTheme(e,entry){
 if(e.kind==='freeze'||['S02','S07'].includes(e.source?.cardId))return 'ice-effect';
 if(e.kind==='heal')return 'heal-effect';if(e.kind==='shield'||e.kind==='block')return 'shield-effect';if(e.kind==='silence')return 'silence-effect';
 if(e.kind==='buff'||e.kind==='summon')return e.source?.cardId?.startsWith('F')?'heal-effect':'gold-effect';
 if(e.source?.cardId?.startsWith('S'))return 'arcane-effect';return 'ember-effect';
}
let epoch=0;const mounted=new Set();
export function stopCardEffects(){epoch++;for(const n of mounted){n.getAnimations().forEach(a=>a.cancel());n.remove();}mounted.clear();}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};
function attach(node){document.body.append(node);mounted.add(node);return node;}
function remove(node){node?.remove();mounted.delete(node);}
function animate(node,frames,duration=400){if(reduce())return;node.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.3,1)',fill:'forwards'}).finished.catch(()=>{});}
const sound=kind=>window.dispatchEvent(new CustomEvent('glimmer-effect',{detail:kind}));
function sourceSpot(root,source,positions){return positions.get(source.uid)||box(root.querySelector(`[data-piece="h${source.actor}"]`));}
function pieceSpot(root,id,positions){return box(root.querySelector(`[data-piece="${id}"]`))||positions.get(id);}
function refreshPositions(root,positions){for(const [id,r] of captureTable(root))positions.set(id,{...r,w:r.width,h:r.height});}
async function reveal(root,source,actor,{trigger=false,pace=1,token}={}){
 const info=sourceInfo(source),table=box(root.querySelector('.card-table'));if(!table)return null;
 const small=innerWidth<700,width=small?(trigger?132:155):(trigger?165:190),height=small?(trigger?167:205):(trigger?193:238);
 const node=document.createElement('div');node.className=`spell-reveal ${trigger?'trigger-reveal':''} ${source.actor===actor?'by-you':'by-rival'}`;node.dataset.sourceCard=source.cardId||source.kind;node.setAttribute('role','status');
 node.innerHTML=`<div class="reveal-owner">${source.actor===actor?'你':'对手'}${source.trigger?' · '+source.trigger:source.kind==='power'?' · 英雄技能':''}</div><article class="revealed-card ${info.theme}">${info.cost!==null?`<span class="mana-orb">${info.cost}</span>`:''}${portrait(info.art)}<strong>${info.name}</strong><p>${esc(info.effect)}</p></article>`;
 node.style.cssText=`left:${table.cx-width/2}px;top:${Math.max(table.y+70,table.cy-height/2-15)}px;width:${width}px;`;attach(node);
 animate(node,[{opacity:0,transform:'translateY(-14px) scale(.8)'},{opacity:1,transform:'translateY(0) scale(1)'}],220);sound(source.kind==='power'?'power':'cast');
 await sleep((trigger?530:source.actor===actor?650:1000)*pace);
 if(token!==epoch){remove(node);return null;}const spot=box(node);animate(node,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.75)'}],170);setTimeout(()=>remove(node),180);return spot;
}
async function beam(root,events,entry,positions,sourceOverride,pace){
 const nodes=[],duration=reduce()?100:290*pace;
 for(const e of events){if(!e.target)continue;const from=sourceOverride||sourceSpot(root,e.source,positions),to=pieceSpot(root,e.target,positions);if(!from||!to)continue;
  const theme=effectTheme(e,entry),ring=document.createElement('div');ring.className='effect-target '+theme;ring.style.cssText=`left:${to.cx}px;top:${to.cy}px;width:${Math.max(to.w||to.width,40)+14}px;height:${Math.max(to.h||to.height,40)+14}px;`;attach(ring);nodes.push(ring);
  if(!reduce()&&Math.hypot(to.cx-from.cx,to.cy-from.cy)>25){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('spell-beam',theme);svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);svg.innerHTML=`<path d="M${from.cx} ${from.cy} Q${(from.cx+to.cx)/2} ${Math.min(from.cy,to.cy)-35} ${to.cx} ${to.cy}"/><circle r="7"/>`;attach(svg);nodes.push(svg);const path=svg.querySelector('path'),length=path.getTotalLength();path.style.strokeDasharray=length;animate(path,[{strokeDashoffset:length},{strokeDashoffset:0}],duration);const orb=svg.querySelector('circle');orb.style.offsetPath=`path('M${from.cx} ${from.cy} Q${(from.cx+to.cx)/2} ${Math.min(from.cy,to.cy)-35} ${to.cx} ${to.cy}')`;animate(orb,[{offsetDistance:'0%'},{offsetDistance:'100%'}],duration);}
 }
 await sleep(duration);for(const n of nodes)remove(n);
}
function impact(root,e,entry,positions){
 const to=pieceSpot(root,e.target,positions);if(!to)return;const theme=effectTheme(e,entry),info=sourceInfo(e.source),node=document.createElement('div');node.className=`effect-impact ${theme}`;node.dataset.effect=e.kind;node.dataset.effectTarget=e.target;node.dataset.effectSource=e.source?.cardId||e.source?.kind||'';node.style.cssText=`left:${to.cx}px;top:${to.cy}px`;
 const text=e.kind==='damage'?'−'+e.amount:e.kind==='heal'?'+'+e.amount:e.kind==='buff'?`↑${e.attackGain?` +${e.attackGain}`:''}${e.healthGain?` / +${e.healthGain}`:''}`:'';
 node.innerHTML=`<b>${text||glyph(iconFor(e.kind))}</b>${e.source?.kind!=='attack'?`<small>${esc(info.name)}</small>`:''}`;attach(node);
 animate(node,[{opacity:0,transform:'translate(-50%,-20%) scale(.65)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.1)',offset:.22},{opacity:1,transform:'translate(-50%,-80%) scale(1)',offset:.75},{opacity:0,transform:'translate(-50%,-110%) scale(.95)'}],870);setTimeout(()=>remove(node),900);
 const ring=document.createElement('div');ring.className='effect-ripple '+theme;ring.innerHTML=glyph(iconFor(e.kind));ring.style.cssText=`left:${to.cx}px;top:${to.cy}px;width:${Math.max(to.w||to.width,50)}px;height:${Math.max(to.h||to.height,50)}px`;attach(ring);animate(ring,[{opacity:.9,transform:'translate(-50%,-50%) scale(.6)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.6)'}],550);setTimeout(()=>remove(ring),570);
 sound(e.kind);
}
async function attackMotion(root,entry,positions,pace){
 const from=positions.get(entry.source.uid),to=pieceSpot(root,entry.action.target,positions);if(!from?.clone||!to||reduce())return;
 const n=from.clone.cloneNode(true);n.classList.add('card-motion-ghost','attack-motion');n.style.cssText=`position:fixed;left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px;pointer-events:none;z-index:10001;margin:0;`;attach(n);
 animate(n,[{transform:'translate(0,0)'},{transform:`translate(${(to.cx-from.cx)*.7}px,${(to.cy-from.cy)*.7}px)`,offset:.7},{transform:'translate(0,0)',opacity:0}],320*pace);await sleep(200*pace);setTimeout(()=>remove(n),150*pace);
}
function flyCard(root,e,actor){
 const row=root.querySelector(e.actor===actor?'.hero-row.own':'.hero-row.enemy'),from=box(row?.querySelector('.deck-stack'))||box(row),to=box(root.querySelector(e.actor===actor?'.hand':'.enemy-hand'));if(!from||!to)return;
 const n=document.createElement('div');n.className='draw-flight';n.innerHTML=glyph('cards');n.style.cssText=`left:${from.cx}px;top:${from.cy}px`;attach(n);animate(n,[{transform:'translate(-50%,-50%) rotate(-8deg)',opacity:1},{transform:`translate(${to.cx-from.cx}px,${to.cy-from.cy}px) rotate(6deg)`,opacity:0}],360);setTimeout(()=>remove(n),400);sound('draw');
}
export async function presentCardAction({root,before,after,entry,actor,paint,pace=1}){
 const token=epoch;if(!entry||before.version===1){const pos=captureTable(root);paint(after);await animateTable(root,before,after,pos,entry?.action);return;}
 if(root.querySelector('dialog[open]')||before.phase==='mulligan'){paint(after);return;}
 const shown=structuredClone(before),positions=new Map();refreshPositions(root,positions);
 const p=shown.players[entry.actor],src=entry.source,info=sourceInfo(src);
 if(entry.action.type==='play'){const index=p.hand.findIndex(c=>c.uid===entry.action.uid);if(index>=0)p.hand.splice(index,1);else if(p.hand.every(c=>c.cardId===null))p.hand.pop();p.mana=Math.max(0,p.mana-(info.cost||0));}
 if(entry.action.type==='power'){p.mana=Math.max(0,p.mana-2);p.powerUsed=true;}
 if(entry.action.type==='cycle'){p.mana=Math.max(0,p.mana-1);p.cycled=true;const i=p.hand.findIndex(c=>c.uid===entry.action.uid);if(i>=0)p.hand.splice(i,1);else if(p.hand.every(c=>c.cardId===null))p.hand.pop();}
 if(entry.action.type==='attack'){const u=p.board.find(u=>u.uid===entry.source.uid);if(u)u.exhausted=true;}
 paint(shown);refreshPositions(root,positions);
 let launch=null;
 if(['spell','unit','power','cycle'].includes(src.kind))launch=await reveal(root,src,actor,{pace,token});
 if(token!==epoch)return;
 if(src.kind==='attack')await attackMotion(root,entry,positions,pace);
 for(let i=0;i<entry.events.length;i++){
  if(token!==epoch)return;const e=entry.events[i];
  if(e.kind==='trigger'){launch=await reveal(root,e.source,actor,{trigger:true,pace,token});continue;}
  const group=[e];
  while(i+1<entry.events.length){const n=entry.events[i+1],same=e.batch?e.batch===n.batch:['buff','heal','summon','freeze','shield','draw','generate','death'].includes(e.kind)&&n.kind===e.kind&&n.source?.uid===e.source?.uid;if(!same)break;group.push(n);i++;}
  const travel=['damage','block','heal','buff','silence','freeze','shield'].includes(e.kind)&&!(src.kind==='attack'&&e.batch===1);
  if(travel)await beam(root,group,entry,positions,launch,pace);if(token!==epoch)return;launch=null;
  const dying=group.filter(v=>v.kind==='death').map(v=>positions.get(v.target)).filter(Boolean);
  for(const event of group)projectCardEvent(shown,event);paint(shown);
  for(const event of group){
   if(['damage','heal','buff','silence','freeze','shield','block'].includes(event.kind))impact(root,event,entry,positions);
   if(event.kind==='draw'||event.kind==='generate'||event.kind==='burn')flyCard(root,event,actor);
   if(event.kind==='summon'){const el=root.querySelector(`[data-piece="${event.target}"]`);if(el&&!reduce())el.animate([{opacity:0,transform:'scale(.25)'},{opacity:1,transform:'scale(1.12)',offset:.7},{transform:'scale(1)'}],{duration:380});}
  }
  for(const pos of dying){if(!pos.clone)continue;const n=pos.clone.cloneNode(true);n.classList.add('card-motion-ghost');n.style.cssText=`position:fixed;left:${pos.x}px;top:${pos.y}px;width:${pos.width}px;height:${pos.height}px;margin:0;pointer-events:none;z-index:10001;`;attach(n);animate(n,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(20px) scale(.5) rotate(7deg)'}],330);setTimeout(()=>remove(n),360);}
  refreshPositions(root,positions);if(e.kind!=='turn')await sleep((e.kind==='death'?220:e.kind==='draw'||e.kind==='generate'?180:340)*pace);
 }
 if(token===epoch)paint(after);
}
