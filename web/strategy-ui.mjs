import {cardGuidance} from './card-guidance.mjs';
import {localGameStorage as localStorage,sessionGameStorage as sessionStorage} from './storage.mjs';
import {CARDS,CARD_LIST,STARTERS,HEROES,PRESETS,KEYWORDS,POWER_ALTERNATIVES} from '../src/catalog.mjs';
import {cardInfo as lookupCard,cardActions,chooseCard,cardCandidates,cardActionText,validateDeck} from '../src/cards.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {portrait} from './art.mjs';
import {glyph,bindTableGestures,cancelCardDrag} from './card-table.mjs';
import {cardPresentation} from '../src/card-events.mjs';
import {sourceInfo,decoratePresentation,worthRemembering,timelineHTML,receiptHTML,presentCardAction,stopCardEffects} from './card-effects.mjs';
import {UNITS,LEVEL_COST,formation,chessPlan,synergyLabels} from '../src/chess-v1.mjs';
import {beginDraft,draftOptions,pickDraft,manaCurve} from '../src/draft.mjs';
const root=()=>document.getElementById('strategy');
let kind='cards',match=null,selected=null,mulligan=new Set(),cap={},active=false,busy=false,generation=0;
let faction='W',opponent='rule',room=null,poll=null,view=null,message='',lastAI='',modelTurn=-1,modelWaitUsed=0,recordToWatch=null,watchTimer=null;
let deckKey='W-swarm',rivalDeck='auto',enemyDeckName='',draftSession=null;
let cardDifficulty='practice';try{const value=localStorage.getItem('glimmer-card-difficulty');if(['practice','standard','challenge'].includes(value))cardDifficulty=value;}catch{}
let battleKey='',battleStarted=0,battleTimer=null;
let presentedState=null,presenting=false,actionHistory=[],queuedSelection=null,suspendedCard=null;
const me=()=>room?room.actor:0;
const state=()=>presentedState||(room?view?.state:match?.state);
const cardInfo=id=>lookupCard(id,state()?.version||4);
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
window.addEventListener('keydown',e=>{if(active&&kind==='cards'&&e.key==='Escape'&&!root().querySelector('dialog[open]')){selected=null;cancelCardDrag();render();}});
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function savedDeck(f){try{const d=JSON.parse(localStorage.getItem('glimmer-deck-'+f));if(validateDeck(f,d))return d;}catch{}return STARTERS[f];}
function savedDraft(){try{const deck=JSON.parse(localStorage.getItem('glimmer-draft-'+faction));return validateDeck(faction,deck)?deck:null;}catch{return null;}}
function config(){return {faction,deck:deckKey==='custom'?savedDeck(faction):deckKey==='draft'?savedDraft()||STARTERS[faction]:PRESETS.find(d=>d.id===deckKey)?.deck||STARTERS[faction]};}
const palette=id=>id.startsWith('F')||['T03','T07'].includes(id)?'forest':id.startsWith('S')||['T04','T05'].includes(id)?'starlight':id.startsWith('N')||id==='T06'?'neutral':'workshop';
function curveHTML(deck){const counts=manaCurve(deck);return `<div class="mana-curve" aria-label="费用曲线">${counts.map((n,i)=>`<div title="${i===6?'6 费及以上':i+' 费'}：${n} 张"><b>${n}</b><i style="height:${Math.max(3,n*7)}px"></i><span>${i===6?'6+':i}</span></div>`).join('')}</div>`;}

function rememberRoom(value){try{const key='glimmer-room-'+kind;value?sessionStorage.setItem(key,JSON.stringify(value)):sessionStorage.removeItem(key);}catch{}}
function savedRoom(){try{const value=JSON.parse(sessionStorage.getItem('glimmer-room-'+kind));return /^[A-F0-9]{6}$/.test(value?.code)&&/^[a-f0-9]{48}$/.test(value?.token)&&[0,1].includes(value?.actor)?value:null;}catch{return null;}}
function cancel(){queuedSelection=null;cancelCardDrag();stopCardEffects();presentedState=null;presenting=false;actionHistory=[];generation++;busy=false;clearInterval(poll);clearInterval(watchTimer);clearInterval(battleTimer);poll=null;watchTimer=null;battleTimer=null;battleKey='';}
function saveCard(){
 if(kind!=='cards'||room||recordToWatch||!match)return;
 suspendedCard={record:sealStrategy(match),history:actionHistory,faction,deckKey,rivalDeck,cardDifficulty};
 try{localStorage.setItem('glimmer-card-save',JSON.stringify(suspendedCard));}catch{}
}
export function closeStrategy(){if(active)saveCard();active=false;cancel();}
window.addEventListener('pagehide',()=>{if(active)saveCard();});
function resumeCard(){
 try{const saved=suspendedCard||JSON.parse(localStorage.getItem('glimmer-card-save'));if(!saved?.record)return false;
 match={state:replayStrategy(saved.record),record:structuredClone(saved.record)};faction=saved.faction;deckKey=saved.deckKey;rivalDeck=saved.rivalDeck;cardDifficulty=saved.cardDifficulty||'practice';actionHistory=saved.history||[];selected=null;mulligan.clear();render();pump();return true;}catch{return false;}
}
export function updateStrategyProviders(providers){cap=providers;if(active)render();}
export function openStrategy(game,providers={},restore=true){
 cancel();active=true;kind=game;cap=providers;room=null;view=null;recordToWatch=null;message='';lastAI='';
 const previous=restore&&location.protocol.startsWith('http')?savedRoom():null;
 if(previous&&cap.rooms)connectRoom(previous);else if(!(restore&&game==='cards'&&resumeCard()))singleMatch();
}
function newMatch(){suspendedCard=null;rememberRoom(null);singleMatch();}
function singleMatch(){
 cancel();room=null;view=null;recordToWatch=null;selected=null;mulligan.clear();message='';lastAI='';modelTurn=-1;
 const seed=freshSeed(),rival=PRESETS.find(d=>d.id===rivalDeck)||PRESETS[seed%PRESETS.length];enemyDeckName=rival.name;
 match=beginStrategy(kind,seed,kind==='cards'?[config(),{faction:rival.faction,deck:rival.deck}]:undefined);render();pump();
}
function flushSelection(){if(queuedSelection&&state()?.phase==='play'&&state().turn===me()&&state().players[me()].hand.some(c=>c.uid===queuedSelection))selected=queuedSelection;queuedSelection=null;}
const canAct=()=>active&&!busy&&!presenting&&!recordToWatch&&state()?.winner===null;
function actionForSelection(s){
 if(!s||s.phase!=='play')return [];
 const actions=cardActions(s,me());if(!selected)return [];
 return actions.filter(a=>selected==='power'?a.type==='power'&&!a.mode:a.uid===selected&&a.type!=='cycle');
}
function targetButton(target,content,cls='',attrs=''){
 const a=actionForSelection(state()).find(a=>a.target===target);
 return `<button class="${cls}${a&&canAct()?' targetable':''}" data-target="${target}" data-piece="${target}" ${attrs} ${a&&canAct()?'':'disabled'}>${content}</button>`;
}
function statIcons(attack,hp,extra=''){return `<span class="stat-badge attack-stat">${glyph('sword')}<b>${attack}</b></span><span class="stat-badge health-stat ${extra}">${glyph('heart')}<b>${hp}</b></span>`;}
function unitCard(u,side){
 const c=cardInfo(u.cardId),ours=side===me(),selectedHere=selected===u.uid;
 const attackable=ours&&canAct()&&cardActions(state(),me()).some(a=>a.type==='attack'&&a.uid===u.uid),target=canAct()&&actionForSelection(state()).some(a=>a.target===u.uid);
 const icons=[u.guard?['shield','守护']:null,u.shield?['spark','护盾']:null,u.drain?['heart','汲取']:null,u.silenced?['cross','沉默']:null].filter(Boolean);
 const resting=u.frozen?'snow':u.fresh&&!u.rush?'moon':u.exhausted?'check':null;
 return `<button class="unit-card ${c.token?'token-unit':c.cost>=5?'core-unit':''} ${palette(c.id)} ${u.guard?'guarded':''} ${u.shield?'shielded':''} ${u.frozen?'frozen':''} ${selectedHere?'chosen':''} ${target?'targetable':''} ${attackable?'can-attack':''} ${resting?'resting':''}" data-unit="${u.uid}" data-piece="${u.uid}" data-source="${u.uid}" data-attack="${u.attack}" data-hp="${u.hp}" data-shield="${!!u.shield}" aria-label="${c.name}，攻击 ${u.attack}，生命 ${u.hp}${attackable?'，可攻击':''}${u.fresh?', 新入场':''}${u.frozen?'，冰封':''}${u.guard?'，守护':''}">
 <span class="unit-portrait">${portrait(c.id)}</span><span class="unit-name">${c.name}</span><span class="unit-stats">${statIcons(u.attack,u.hp,u.hp<u.maxHp?'wounded':'')}</span>
 <span class="unit-tokens">${icons.map(([icon,name])=>`<i title="${name}" aria-label="${name}">${glyph(icon)}</i>`).join('')}</span>${resting?`<span class="rest-marker" aria-label="${u.frozen?'冰封':u.exhausted?'已行动':'新入场'}">${glyph(resting)}</span>`:attackable?`<span class="attack-ready" aria-hidden="true">${glyph('up')}</span>`:''}</button>`;
}
function handCard(c,s){
 const info=cardInfo(c.cardId),isM=s.phase==='mulligan',isChosen=isM?mulligan.has(c.uid):selected===c.uid,combo=info.effect.includes('连奏')&&(s.players[me()].cardsPlayed||0)>0;
 const playable=canAct()&&cardActions(s,me()).some(a=>a.type==='play'&&a.uid===c.uid);
 return `<button class="hand-card ${palette(info.id)} ${isChosen?'chosen':''} ${isM?'opening-card':playable?'playable':'unavailable'}" data-hand="${c.uid}" data-source="${c.uid}" data-piece="${c.uid}" data-cost="${info.cost}" aria-label="${info.name}，${info.cost} 能量${playable?'，可打出':''}" aria-pressed="${isChosen}"><span class="mana-orb">${info.cost}</span>${portrait(info.id)}<span class="card-name">${info.name}</span><span class="card-text">${info.effect}</span><span class="card-bottom">${info.kind==='unit'?statIcons(info.attack,info.health):`<span class="spell-symbol">${glyph('spark')}</span>`}</span>${isM?`<span class="mulligan-mark">${glyph(isChosen?'swap':'check')}<small>${isChosen?'换掉':'保留'}</small></span>`:combo?`<span class="combo-ready" title="连奏就绪">${glyph('chain')}</span>`:playable?`<span class="play-ready">${glyph('up')}</span>`:''}</button>`;
}
function heroHTML(s,side){
 const p=s.players[side],ours=side===me(),h=HEROES[p.faction],guards=p.board.some(u=>u.guard),powerReady=ours&&canAct()&&cardActions(s,me()).some(a=>a.type==='power'&&!a.mode);
 const art={W:'W03',F:'F03',S:'S05'}[p.faction];
 const cost=ours?(selected==='power'?2:cardInfo(p.hand.find(c=>c.uid===selected)?.cardId)?.cost||0):0;
 const energy=`<div class="crystal-meter" aria-label="${ours?'你的':'对手'}能量 ${p.mana}，基础上限 ${p.maxMana}${p.mana>p.maxMana?'，含临时能量 '+(p.mana-p.maxMana):''}"><span class="crystals">${Array.from({length:8},(_,i)=>`<i class="${i<p.mana?'filled':i<p.maxMana?'spent':'locked'} ${i<cost&&i<p.mana?'reserved':''} ${i>=p.maxMana&&i<p.mana?'temporary':''}" ${i>=p.maxMana&&i<p.mana?'title="本回合临时能量"':''}>${glyph('gem')}</i>`).join('')}</span><b>${p.mana}<small> / ${Math.max(p.maxMana,p.mana)}</small></b></div>`;
 const hero=targetButton('h'+side,`<span class="hero-owner">${ours?'你':'对手'}</span><span class="hero-portrait">${portrait(art)}</span><span class="hero-caption"><span>${h.name}</span><span class="hero-health">${glyph('heart')}<b>${Math.max(0,p.hp)}</b><small>/20</small></span><span class="hero-life"><i style="width:${Math.max(0,p.hp)/20*100}%"></i></span></span>${guards?`<span class="hero-guard">${glyph('shield')}</span>`:''}`,'hero '+(s.turn===side&&s.phase==='play'?'active-hero':''),`data-hp="${p.hp}" data-attack="0"`);
 const backs=`<div class="enemy-hand" aria-label="对手 ${p.hand.length} 张手牌">${p.hand.map((_,i)=>`<i class="card-back" style="--fan:${i-(p.hand.length-1)/2}">${glyph('spark')}</i>`).join('')}<b>${p.hand.length}</b></div>`;
 const alternate=POWER_ALTERNATIVES[p.faction],alternateReady=ours&&canAct()&&cardActions(s,me()).some(a=>a.type==='power'&&a.mode);
 const power=ours?`<button id="card-power" ${p.faction==='S'?'':'data-source="power"'} data-piece="power" class="power-button ${powerReady?'power-ready':''} ${selected==='power'?'chosen':''}" aria-label="${h.power}，2 能量" title="${escape(h.text)}" ${powerReady?'':'disabled'}>${glyph(p.faction==='F'?'heart':p.faction==='S'?'spark':'sword')}<span class="power-name">${h.power}</span><b class="mana-orb">2</b>${p.powerUsed?`<i>${glyph('check')}</i>`:''}</button>`:'';
 return `<div class="hero-row ${ours?'own':'enemy'}">${ours?energy:backs}${hero}<div class="hero-side">${ours?power+(s.version>=4?`<button id="card-power-alt" class="power-alternative" title="${escape(alternate.text)}" aria-label="${alternate.name}，2 能量" ${alternateReady?'':'disabled'}>${glyph(alternate.icon)}<b>${alternate.name}</b><small>${alternate.outcome}</small><em>2</em></button>`:''):energy}<span class="deck-stack ${(p.deckCount??p.deck.length)<=3?'low-deck':''}" title="${(p.deckCount??p.deck.length)===0?'牌库已空 · 再抽牌将受到疲劳伤害':'剩余牌库'}" aria-label="牌库 ${p.deckCount??p.deck.length} 张">${glyph('cards')}<b>${p.deckCount??p.deck.length}</b></span></div></div>`;
}
function renderCards(){
 const handScroll=root().querySelector('.hand')?.scrollLeft||0;
 const s=state(),actor=me(),p=s?.players[actor],enemy=s?.players[1-actor],ownTurn=s?.phase==='play'&&s.turn===actor,opening=s?.phase==='mulligan',finished=s?.winner!==null&&s?.winner!==undefined;
 const shownFaction=(room||recordToWatch)?p?.faction||faction:faction;
 const selectedHand=p?.hand.find(c=>c.uid===selected),selectedUnit=s?.players.flatMap(p=>p.board).find(c=>c.uid===selected),info=cardInfo(selectedHand?.cardId||selectedUnit?.cardId),moves=actionForSelection(s),noTarget=moves.find(a=>a.target===null&&!a.choice),choices=moves.filter(a=>a.choice);
 const available=s?cardActions(s,actor):[],done=ownTurn&&!available.some(a=>a.type!=='end'),isUnit=info?.kind==='unit'&&!!selectedHand;
 const status=presenting?'效果结算中':finished?(s.winner===-1?'平局':s.winner===actor?'胜利':'落败'):opening?'起手牌':recordToWatch?'回放':ownTurn?'你的回合':'对手回合';
 function slots(side){const units=s.players[side].board,ours=side===actor;return units.map(u=>unitCard(u,side)).join('')+Array.from({length:5-units.length},(_,i)=>{const ready=ours&&i===0&&isUnit&&!!noTarget&&canAct();return `<${ready?'button':'div'} class="board-slot ${ready?'drop-ready':''} ${ours&&i===0&&ownTurn&&!selected&&available.some(a=>a.type==='play'&&cardInfo(p.hand.find(c=>c.uid===a.uid)?.cardId)?.kind==='unit')?'empty-ready':''}" ${ready?'data-drop="unit" id="card-play" aria-label="放入战场"':''}>${ready?`<span class="summon-ghost">${portrait(info.id)}${statIcons(info.attack,info.health)}</span>${glyph('plus')}`:glyph(ours?'plus':'shield')}</${ready?'button':'div'}>`;}).join('');}
 root().innerHTML=`<div class="card-topbar"><h1>微光牌局</h1>${!room&&!recordToWatch&&opponent==='rule'?`<span class="card-level-tag">${{practice:'练习对手',standard:'标准对手',challenge:'挑战对手'}[cardDifficulty]}</span>`:''}<div class="deck-selects"><select id="card-faction" aria-label="你的阵营" ${room||recordToWatch||s?.phase==='play'&&s.winner===null?'disabled':''}>${Object.entries(HEROES).map(([id,h])=>`<option value="${id}" ${shownFaction===id?'selected':''}>${h.faction}</option>`).join('')}</select><select id="card-preset" aria-label="卡组" ${room||recordToWatch||s?.phase==='play'&&s.winner===null?'disabled':''}>${room||recordToWatch?`<option selected>${recordToWatch?'回放卡组':'好友局卡组'}</option>`:''}${PRESETS.filter(d=>d.faction===shownFaction).map(d=>`<option value="${d.id}" ${!room&&!recordToWatch&&deckKey===d.id?'selected':''}>${d.name}</option>`).join('')}<option value="custom" ${!room&&!recordToWatch&&deckKey==='custom'?'selected':''}>我的自组卡牌</option>${savedDraft()?`<option value="draft" ${!room&&!recordToWatch&&deckKey==='draft'?'selected':''}>我的轮抽卡组</option>`:''}</select></div><div class="card-toolbar"><button class="quiet" id="card-library">${glyph('cards')}<span>图鉴</span></button><button class="quiet" id="card-draft" ${room||recordToWatch||s?.phase==='play'&&s.winner===null?'disabled':''}>${glyph('swap')}<span>轮抽</span></button><button class="quiet" id="card-settings" aria-label="卡组与对战设置">${glyph('gear')}</button></div></div>
 ${timelineHTML(actionHistory,actor)}<section class="card-table visual-table ${ownTurn?'your-turn':'their-turn'} ${opening?'opening-table':''} ${selected?'has-selection':''}" aria-label="卡牌战场">
 ${s?`${heroHTML(s,1-actor)}<div class="battle-row enemy-row">${slots(1-actor)}</div>
 <div class="table-divider"><span class="round-medallion">${glyph('sun')}<b>${Math.max(p.turns,enemy.turns)||1}</b></span><span class="turn-indicator" role="status">${glyph(opening?'cards':ownTurn?'sun':'moon')}${status}${!ownTurn&&!opening&&!finished?'<i class="thinking-dots">•••</i>':''}</span><div class="turn-actions">${s.version>=4&&selectedHand&&!opening&&available.some(a=>a.type==='cycle'&&a.uid===selected)?`<button id="card-cycle" class="table-small card-cycle" aria-label="调度所选手牌，消耗 1 能量，换抽 1 张" title="1 能量：手牌放回牌库底，换抽一张" ${canAct()&&available.some(a=>a.type==='cycle'&&a.uid===selected)?'':'disabled'}>${glyph('swap')}<span>调度</span> <b>1 ${glyph('gem')}</b></button>`:''}${selected?`<button id="card-cancel" class="table-small" aria-label="取消选择">${glyph('cross')}</button>${info?`<button id="card-inspect" class="table-small" aria-label="查看所选卡牌">${glyph('eye')}</button>`:''}`:''}${opening?`<button class="turn-button opening-start" id="card-keep" ${!canAct()||s.kept[actor]?'disabled':''}>${glyph('arrow')}<b>${s.kept[actor]?'等待':'开局'}</b>${mulligan.size?`<span>${glyph('swap')}${mulligan.size}</span>`:''}</button>`:`<button class="turn-button ${done?'turn-complete':''}" id="card-end" ${!canAct()||!ownTurn||finished?'disabled':''}>${glyph(done?'check':'arrow')}<b>结束回合</b></button>`}</div></div>
 <div class="battle-row own-row">${slots(actor)}</div>${heroHTML(s,actor)}<div class="hand" aria-label="你的手牌">${p.hand.map(c=>handCard(c,s)).join('')}</div>
 ${selectedHand&&cardGuidance(s,actor,selectedHand,info,available)?`<div class="card-guidance" role="status">${cardGuidance(s,actor,selectedHand,info,available)}</div>`:''}
 ${!isUnit&&noTarget&&selected!=='power'?`<button class="spell-drop drop-ready" data-drop="spell" id="card-play" aria-label="施放${escape(info?.name)}">${portrait(info?.id)}<span>${glyph('spark')}施放</span></button>`:''}
 ${choices.length?`<div class="card-choices">${choices.map(a=>{const option=info.choices.find(c=>c.id===a.choice);return `<button class="choice-action ${a.choice}" data-choice="${a.id}" ${!canAct()?'disabled':''}><b>${option.name}</b><span class="choice-picture">${a.choice==='bloom'?portrait('T03')+portrait('T03'):glyph('heart')+'<strong>+4</strong>'+glyph('cards')}</span><span class="choice-outcome">${a.choice==='bloom'?glyph('sword')+' +1':glyph('cards')+' +1'}</span></button>`;}).join('')}</div>`:''}
 ${finished?`<div class="table-result">${glyph(s.winner===actor?'spark':'moon')}<strong>${status}</strong><small>最后行动</small><div class="card-finish-recap">${actionHistory.slice(-3).map(e=>{const src=sourceInfo(e.focus);return `<button data-action-history="${e.seq}">${portrait(src.art)}<span>${e.focus.actor===actor?'你':'对手'} · ${escape(src.name)}</span></button>`;}).join('')}</div><button class="primary" id="card-again">再来一局</button></div>`:''}
 `:`<div class="waiting-room"><strong>${escape(room?.code||'')}</strong>${glyph('cards')}<span>等待朋友加入</span><button class="secondary" id="card-leave">返回单人</button></div>`}
 <svg class="table-aim" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="8 6"/><circle r="10" fill="none" stroke="currentColor" stroke-width="3"/></svg></section>
 ${message?`<div class="table-error" role="status">${escape(message)}</div>`:''}${room?'<div class="room-controls table-room-clock"><span>房间 '+escape(room.code)+'</span></div>':opponent==='laya'&&lastAI.startsWith('规则接手')?'<div class="model-fallback" role="status">规则接手</div>':''}<dialog id="deck-dialog" aria-label="卡牌与组卡"></dialog>`;
 if(root().querySelector('.hand'))root().querySelector('.hand').scrollLeft=handScroll;
 root().querySelectorAll('[data-hand]').forEach(b=>b.onclick=e=>{if(recordToWatch)return;const id=b.dataset.hand;if(busy){if(!opening&&s.turn===actor){queuedSelection=id;root().querySelectorAll('.hand-card.queued').forEach(n=>n.classList.remove('queued'));b.classList.add('queued');}return;}if(opening){if(s.kept[actor])return;mulligan.has(id)?mulligan.delete(id):mulligan.add(id);}else selected=selected===id?null:id;render();if(!opening&&e.detail===0)root().querySelector('.drop-ready,.targetable,[data-choice]')?.focus({preventScroll:true});});
 root().querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{const a=actionForSelection(s).find(a=>a.target===b.dataset.unit);if(a&&canAct())apply(a);else if(b.classList.contains('can-attack')){selected=selected===b.dataset.unit?null:b.dataset.unit;render();}else inspectCard(s.players.flatMap(p=>p.board).find(u=>u.uid===b.dataset.unit));});
 root().querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>{const a=actionForSelection(s).find(a=>a.target===b.dataset.target);if(a)apply(a);});
 root().querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>apply(moves.find(a=>a.id===b.dataset.choice)));
 bind('card-play',()=>apply(noTarget));bind('card-end',()=>apply({id:'end',type:'end'}));bind('card-keep',()=>apply({type:'mulligan',replace:[...mulligan]}));
 bind('card-cycle',()=>{const action=available.find(a=>a.type==='cycle'&&a.uid===selected);if(action)apply(action);});
 bind('card-power-alt',()=>{const action=available.find(a=>a.type==='power'&&a.mode);if(action)apply(action);});
 bind('card-power',()=>{const options=cardActions(s,actor).filter(a=>a.type==='power'&&!a.mode);if(options.length===1&&options[0].target===null)apply(options[0]);else{selected=selected==='power'?null:'power';render();}});
 bind('card-cancel',()=>{selected=null;render();});bind('card-inspect',()=>inspectCard(selectedUnit||selectedHand));bind('card-again',newMatch);bind('card-leave',newMatch);
 bind('card-faction',e=>{faction=e.target.value;deckKey=PRESETS.find(d=>d.faction===faction).id;newMatch();},'change');bind('card-preset',e=>{deckKey=e.target.value;newMatch();},'change');
 bind('card-library',()=>editDeck(false));bind('card-draft',startDraft);bind('card-settings',cardSettings);
 root().querySelectorAll('[data-action-history]').forEach(b=>b.onclick=()=>showActionHistory(Number(b.dataset.actionHistory)));
 bindTableGestures(root(),{select:id=>{selected=id;render();},actions:()=>actionForSelection(state()),act:apply});
 const hand=root().querySelector('.hand'),picked=hand?.querySelector('.chosen:not(.opening-card)');if(picked){const a=hand.getBoundingClientRect(),b=picked.getBoundingClientRect();if(b.left<a.left)hand.scrollLeft-=a.left-b.left+5;else if(b.right>a.right)hand.scrollLeft+=b.right-a.right+5;}
}
function inspectCard(value){
 const c=cardInfo(value?.cardId);if(!c)return;const dialog=root().querySelector('#deck-dialog');dialog.className='inspect-dialog';
 dialog.innerHTML=`<button class="quiet inspect-close" id="inspect-close" aria-label="关闭卡牌">${glyph('cross')}</button><article class="collection-card ${palette(c.id)}"><div class="collection-top"><b>${c.cost} ${glyph('gem')}</b><span>${c.faction}</span></div>${portrait(c.id)}<h3>${c.name}</h3><p>${c.effect}</p><dl class="keyword-glossary">${Object.entries(KEYWORDS).filter(([word])=>c.effect.includes(word)).map(([word,text])=>`<div><dt>${word}</dt><dd>${text}</dd></div>`).join('')}</dl><div class="inspect-stats">${c.kind==='unit'?statIcons(value.attack??c.attack,value.hp??c.health):glyph('spark')}</div></article>`;
 dialog.querySelector('#inspect-close').onclick=()=>dialog.close();dialog.onclose=()=>render();dialog.showModal();
}
function cardSettings(){
 const dialog=root().querySelector('#deck-dialog'),s=state();dialog.className='settings-dialog';
 dialog.innerHTML=`<div class="deck-heading"><h2>牌组与对战</h2><button id="settings-close" class="quiet" aria-label="关闭设置">${glyph('cross')}</button></div><div class="settings-grid"><section class="table-settings"><label for="card-rival">对手卡组</label><select id="card-rival" ${room||recordToWatch||s?.phase==='play'&&s.winner===null?'disabled':''}><option value="auto">随机预组</option>${PRESETS.map(d=>`<option value="${d.id}" ${rivalDeck===d.id?'selected':''}>${d.name}</option>`).join('')}</select><label for="card-opponent">对手</label><select id="card-opponent" ${room||s?.phase==='play'&&s.winner===null?'disabled':''}><option value="rule" ${opponent==='rule'?'selected':''}>规则对手</option><option value="laya" ${opponent==='laya'?'selected':''} ${!cap.laya?'disabled':''}>Laya${cap.laya?'':'（需本机服务）'}</option></select><label for="card-difficulty">规则对手难度</label><select id="card-difficulty" ${room||recordToWatch||opponent!=='rule'||s?.phase==='play'&&s.winner===null?'disabled':''}>${[['practice','练习 · 熟悉出牌'],['standard','标准 · 认真对练'],['challenge','挑战 · 连续计算']].map(([id,label])=>`<option value="${id}" ${cardDifficulty===id?'selected':''}>${label}</option>`).join('')}</select><div class="table-buttons"><button class="secondary" id="deck-edit" ${room||recordToWatch||s?.phase==='play'&&s.winner===null?'disabled':''}>编辑卡组</button><button class="secondary" id="card-new">${room?'返回单人':'重新开局'}</button><button class="quiet" id="card-export" ${!s||room&&s.winner===null?'disabled':''}>导出回放</button></div></section><section class="room-controls"><h2>好友对战</h2>${room?'<p>房间 '+escape(room.code)+'</p>':`<button class="secondary" id="room-create" ${!cap.rooms?'disabled title="好友房间需要联机服务"':''}>创建房间</button><div class="room-join"><input id="room-code" maxlength="6" placeholder="六位房间码" aria-label="房间码"><button class="quiet" id="room-join" ${!cap.rooms?'disabled title="好友房间需要联机服务"':''}>加入</button></div>`}</section></div><details class="match-record"><summary>对局记录</summary><p>${escape(lastAI||enemyDeckName)}</p><ol>${(s?.log||[]).slice(-8).reverse().map(x=>'<li>'+escape(x)+'</li>').join('')}</ol></details>`;
 const close=()=>dialog.close();dialog.querySelector('#settings-close').onclick=close;dialog.onclose=()=>render();
 bind('card-rival',e=>{rivalDeck=e.target.value;close();newMatch();},'change');bind('card-opponent',e=>{opponent=e.target.value;close();newMatch();},'change');
 bind('card-difficulty',e=>{cardDifficulty=e.target.value;try{localStorage.setItem('glimmer-card-difficulty',cardDifficulty);}catch{}close();newMatch();},'change');
 bind('card-new',()=>{close();newMatch();});bind('deck-edit',()=>{dialog.onclose=null;dialog.close();editDeck(true);});bind('card-export',exportRecord);
 bind('room-create',()=>{close();enterRoom(false);});bind('room-join',()=>{const code=dialog.querySelector('#room-code').value;enterRoom(true,code);close();});dialog.showModal();updateRoomClock();
}
function bind(id,fn,event='click'){root().querySelector('#'+id)?.addEventListener(event,fn);}
function render(){if(!active||kind==='cards'&&root().querySelector('#deck-dialog[open]'))return;if(kind==='cards')renderCards();else renderChess();updateRoomClock();}
function updateRoomClock(){
 const box=root().querySelector('.room-controls');if(!room||!box)return;
 let clock=box.querySelector('#room-clock');if(!clock){clock=document.createElement('p');clock.id='room-clock';box.append(clock);}
 const s=state(),seconds=Math.max(0,Math.ceil((view?.deadline-view?.now)/1000));
 clock.textContent=!s?'加入后开始计时':s.winner!==null?'对局已结束':(kind==='cards'?(s.phase==='mulligan'?'确认起手':s.turn===me()?'你的回合':'对方回合'):s.phase==='battle'?'自动战斗':'准备阶段')+' · 剩余 '+seconds+' 秒';
}
function rememberAction(entry){if(worthRemembering(entry)&&!actionHistory.some(e=>e.seq===entry.seq)){actionHistory.push(entry);actionHistory=actionHistory.slice(-24);}}
function showActionHistory(seq){
 const entry=actionHistory.find(e=>e.seq===seq);if(!entry)return;const dialog=root().querySelector('#deck-dialog');dialog.className='action-history-dialog';dialog.innerHTML=receiptHTML(entry,me());dialog.querySelector('#history-close').onclick=()=>dialog.close();dialog.onclose=()=>render();dialog.showModal();
}
async function presentStep(before,after,cue,gen,pace=1){
 const entry=decoratePresentation(cue,before,after);rememberAction(entry);presenting=true;presentedState=before;
 await presentCardAction({root:root(),before,after,entry,actor:me(),pace,paint:s=>{if(gen===generation&&active){presentedState=s;render();}}});
 if(gen===generation){presenting=false;presentedState=null;}
}
async function receiveCardRoom(next,before,gen){
 view=next;const rows=next.presentations||[];
 if(!before){for(const row of rows)rememberAction(decoratePresentation(row.cue,null,row.state));render();return;}
 const pending=rows.filter(row=>row.cue.seq>before.seq);let cursor=before;
 if(pending.length&&pending[0].cue.seq===before.seq+1){for(const row of pending){if(gen!==generation)return;await presentStep(cursor,row.state,row.cue,gen,pending.length>3?.7:1);cursor=row.state;}}
 else {for(const row of rows)rememberAction(decoratePresentation(row.cue,null,row.state));}
 if(gen===generation){presentedState=null;render();}
}
async function apply(action){
 if(!action||!canAct())return;
 const gen=generation,before=kind==='cards'?state():null;
 try{
  if(room){busy=true;const next=await roomRequest('action','POST',{seq:state().seq,action});if(gen!==generation)return;selected=null;mulligan.clear();message='';if(before)await receiveCardRoom(next,before,gen);else view=next;}
  else {advanceStrategy(match,action.type==='advance'?-1:me(),action);selected=null;mulligan.clear();message='';if(before){busy=true;await presentStep(before,match.state,cardPresentation(match.state),gen);}}
  if(gen!==generation)return;busy=false;flushSelection();saveCard();render();pump();
 }catch(e){if(gen!==generation)return;busy=false;presenting=false;presentedState=null;message=e.message;render();}
}
async function pump(){
 if(kind==='chess'){pumpChess();return;}
 if(!active||room||busy||recordToWatch||!match||match.state.winner!==null)return;
 const s=match.state,actor=1;
 if(s.phase==='mulligan'){if(!s.kept[actor])advanceStrategy(match,actor,chooseCard(s,actor));render();if(match.state.phase!=='play')return;}
 if(match.state.turn!==actor)return;
 busy=true;const gen=generation;render();
 while(active&&gen===generation&&match.state.winner===null&&match.state.phase==='play'&&match.state.turn===actor){
  const before=match.state;let action=chooseCard(before,actor,cardDifficulty),source='规则（'+({practice:'练习',standard:'标准',challenge:'挑战'}[cardDifficulty])+'）';
  if(modelTurn!==before.players[actor].turns){modelTurn=before.players[actor].turns;modelWaitUsed=0;}
  const candidates=cardCandidates(before,actor);
  if(opponent==='laya'&&candidates.length===1){action=candidates[0].action;source='唯一合法选择';}
  else if(opponent==='laya'&&modelWaitUsed<8000){
   const requestStarted=performance.now();
   try{const r=await fetch('/api/strategy-decision',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(2500),body:JSON.stringify({game:'cards',state:before,actor,provider:'laya'})});if(!r.ok)throw Error();const a=await r.json();const candidate=candidates.find(c=>c.id===a.id);if(!candidate)throw Error();action=candidate.action;source='Laya';}
   catch{source='规则接手';}finally{if(gen===generation)modelWaitUsed+=performance.now()-requestStarted;}
  }else if(opponent==='laya')source='规则接手（本回合等待已达上限）';
  await new Promise(r=>setTimeout(r,320));if(!active||gen!==generation)return;
  lastAI=source+'：'+cardActionText(before,actor,action);match.record.decisions??=[];match.record.decisions.push({seq:before.seq,actor,source,action:action.id});
  advanceStrategy(match,actor,action);await presentStep(before,match.state,cardPresentation(match.state),gen);if(gen!==generation)return;render();
 }
 if(gen===generation){busy=false;flushSelection();saveCard();render();}
}
async function enterRoom(join,roomCode){
 if(busy&&room)return;
 const code=(roomCode??root().querySelector('#room-code')?.value??'').trim().toUpperCase();
 const gen=generation;
 try{const r=await fetch(join?'/api/rooms/'+code+'/join':'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(5000),body:JSON.stringify({game:kind,...config()})});const data=await r.json();if(gen!==generation)return;if(!r.ok)throw Error(data.error||'房间无法连接');connectRoom(data);}
 catch(e){if(gen===generation){message=e.message;render();}}
}
function connectRoom(data){
 cancel();room=data;rememberRoom(data);recordToWatch=null;selected=null;mulligan.clear();view=null;message='正在连接房间…';render();
 const gen=generation;let pending=false,connectionError=true;
 async function refreshRoom(){
  if(pending||busy||presenting||gen!==generation)return;pending=true;
  try{const next=await roomRequest('');if(gen!==generation||busy||presenting||next.state?.seq<view?.state?.seq)return;const changed=connectionError||next.state?.seq!==view?.state?.seq||next.waiting!==view?.waiting;
   const before=view?.state;if(connectionError){message='';connectionError=false;}
   if(changed&&kind==='cards'){busy=true;try{await receiveCardRoom(next,before,gen);}finally{if(gen===generation){busy=false;flushSelection();saveCard();render();}}}else{view=next;if(changed)render();else updateRoomClock();}
  }catch(e){if(gen===generation){connectionError=true;message=e.message+'；正在重连，也可返回单人练习。';render();}}finally{pending=false;}
 }
 refreshRoom();poll=setInterval(refreshRoom,700);
}
async function roomRequest(suffix,method='GET',body){const auth=room;const r=await fetch('/api/rooms/'+auth.code+(suffix?'/'+suffix:''),{method,signal:AbortSignal.timeout(5000),headers:{Authorization:'Bearer '+auth.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'连接失败');return data;}
async function exportRecord(){try{const rec=room?await roomRequest('replay'):recordToWatch||sealStrategy(match);const url=URL.createObjectURL(new Blob([JSON.stringify(rec)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='glimmer-'+rec.game+'-'+rec.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){message=e.message;render();}}
export function watchStrategy(record,providers={}){
 replayStrategy(record);openStrategy(record.game,providers,false);cancel();recordToWatch=record;match=beginStrategy(record.game,record.seed,record.configs,record.format);let index=0;render();
 if(kind==='cards'){
  const gen=generation;async function nextCard(){if(gen!==generation)return;if(index>=record.actions.length){message='回放结束';render();return;}const before=match.state,row=record.actions[index++];advanceStrategy(match,row.actor,row.action);await presentStep(before,match.state,cardPresentation(match.state),gen);if(gen===generation){render();watchTimer=setTimeout(nextCard,140);}}
  watchTimer=setTimeout(nextCard,200);return;
 }
 watchTimer=setInterval(()=>{if(index>=record.actions.length){clearInterval(watchTimer);message='回放结束';render();return;}
  if(kind==='chess'&&match.state.phase==='battle'&&performance.now()-battleStarted<Math.max(1000,match.state.battle.ticks*100))return;
  const row=record.actions[index++];advanceStrategy(match,row.actor,row.action);render();},450);
}
function editDeck(edit=true){
 const dialog=root().querySelector('#deck-dialog'),initial=config().deck,counts=Object.fromEntries(CARD_LIST.map(c=>[c.id,initial.filter(id=>id===c.id).length]));
 let query='',filter=edit?faction:'all',cost='all';
 dialog.className='collection-dialog';dialog.innerHTML=`<div class="deck-heading"><div><h2>${edit?'编辑'+HEROES[faction].faction+'卡组':'卡牌图鉴'}</h2><p>${edit?'20 张牌，同名最多 2 张。':'48 张可构筑卡牌，可按名称、效果和关键词搜索。'}</p></div><button id="deck-close" class="quiet">关闭</button></div>
 <div class="collection-filters"><input id="card-search" type="search" placeholder="搜索卡名或关键词，如连奏" aria-label="搜索卡牌"><select id="library-faction" aria-label="筛选阵营" ${edit?'hidden':''}><option value="all">全部阵营</option><option value="N">中立</option>${Object.entries(HEROES).map(([id,h])=>`<option value="${id}">${h.faction}</option>`).join('')}</select><select id="library-cost" aria-label="筛选费用"><option value="all">全部费用</option><option value="low">0–2 费</option><option value="mid">3–4 费</option><option value="high">5 费以上</option></select></div>
 <div id="deck-summary"></div><div id="collection-results" class="collection-grid"></div><div class="deck-footer">${edit?'<button class="secondary" id="deck-default">恢复预组</button><button class="primary" id="deck-save">保存并开局</button>':'<span>召唤物与英雄生成的火花不加入构筑卡池。</span>'}</div>`;
 function show(){
  const deck=Object.entries(counts).flatMap(([id,n])=>Array(n).fill(id)),filtered=CARD_LIST.filter(c=>(edit?(c.id[0]===faction||c.id[0]==='N'):(filter==='all'||c.id[0]===filter))&&(!query||[c.name,c.effect,c.faction].some(s=>s.includes(query)))&&(cost==='all'||cost==='low'&&c.cost<=2||cost==='mid'&&c.cost>=3&&c.cost<=4||cost==='high'&&c.cost>=5)).sort((a,b)=>a.cost-b.cost||a.id.localeCompare(b.id));
  dialog.querySelector('#deck-summary').innerHTML=edit?`<div class="deck-summary"><b>已选 ${deck.length} / 20 张</b><span>单位 ${deck.filter(id=>CARDS[id].kind==='unit').length} · 法术 ${deck.filter(id=>CARDS[id].kind==='spell').length}</span>${curveHTML(deck)}</div>`:`<p class="collection-count">${filtered.length} 张卡牌</p>`;
  dialog.querySelector('#collection-results').innerHTML=filtered.map(c=>`<article class="collection-card ${palette(c.id)}" data-card-id="${c.id}"><div class="collection-top"><b>${c.cost} 费</b><span>${c.faction}</span></div>${portrait(c.id)}<h3>${c.name}</h3><p>${c.effect}</p><strong class="collection-stats">${c.kind==='unit'?`${c.attack} 攻击 / ${c.health} 生命`:'法术'}</strong>${edit?`<div class="card-counter"><button class="quiet" data-minus="${c.id}" aria-label="移除${c.name}" ${!counts[c.id]?'disabled':''}>−</button><b>${counts[c.id]} / 2</b><button class="quiet" data-plus="${c.id}" aria-label="加入${c.name}" ${counts[c.id]>=2||deck.length>=20?'disabled':''}>+</button></div>`:''}</article>`).join('')||'<p class="collection-empty">没有匹配的卡牌，试试其他关键词。</p>';
  if(edit)dialog.querySelector('#deck-save').disabled=deck.length!==20;
  dialog.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{counts[b.dataset.minus]--;show();});dialog.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{counts[b.dataset.plus]++;show();});
 }
 dialog.querySelector('#deck-close').onclick=()=>dialog.close();dialog.onclose=()=>render();
 dialog.querySelector('#card-search').oninput=e=>{query=e.target.value.trim();show();};dialog.querySelector('#library-faction').onchange=e=>{filter=e.target.value;show();};dialog.querySelector('#library-cost').onchange=e=>{cost=e.target.value;show();};
 if(edit){dialog.querySelector('#deck-default').onclick=()=>{const d=PRESETS.find(d=>d.id===deckKey)?.deck||STARTERS[faction];for(const id of Object.keys(counts))counts[id]=d.filter(c=>c===id).length;show();};dialog.querySelector('#deck-save').onclick=()=>{const deck=Object.entries(counts).flatMap(([id,n])=>Array(n).fill(id));if(validateDeck(faction,deck)){try{localStorage.setItem('glimmer-deck-'+faction,JSON.stringify(deck));}catch{}deckKey='custom';dialog.close();newMatch();}};}
 show();dialog.showModal();
}
function startDraft(){
 const dialog=root().querySelector('#deck-dialog');draftSession=beginDraft(freshSeed(),faction);dialog.className='draft-dialog';
 function show(){
  const done=draftSession.picks.length===20,options=draftOptions(draftSession),counts=Object.fromEntries([...new Set(draftSession.picks)].map(id=>[id,draftSession.picks.filter(c=>c===id).length]));
  dialog.innerHTML=`<div class="deck-heading"><div><h2>${HEROES[faction].faction}轮抽</h2><p>${done?'卡组已完成，可以带着这 20 张牌开局。':'每次从三张中选一张，选满 20 张。同牌最多两张。'}</p></div><button id="draft-close" class="quiet">关闭</button></div><div class="draft-progress"><b>${done?'组卡完成':'第 '+(draftSession.picks.length+1)+' / 20 次选择'}</b><progress value="${draftSession.picks.length}" max="20" aria-label="组卡进度"></progress><span>已选 ${draftSession.picks.length} 张</span></div>
 ${done?`<button id="draft-start" class="primary">使用轮抽卡组开局</button>`:`<div class="draft-offers">${options.map(id=>{const c=CARDS[id];return `<button class="collection-card ${palette(c.id)}" data-draft="${id}"><div class="collection-top"><b>${c.cost} 费</b><span>${c.faction}</span></div>${portrait(c.id)}<h3>${c.name}</h3><p>${c.effect}</p><strong class="collection-stats">${c.kind==='unit'?`${c.attack} 攻击 / ${c.health} 生命`:'法术'}</strong><span class="draft-pick-label">选择这张 · 已有 ${counts[id]||0}</span></button>`;}).join('')}</div>`}
 <div class="draft-pool"><h3>已选卡牌</h3>${curveHTML(draftSession.picks)}<div class="draft-picks">${Object.entries(counts).map(([id,n])=>`<span>${CARDS[id].cost} 费 ${CARDS[id].name} ×${n}</span>`).join('')||'<p>兼顾低费开局、单位数量和卡牌配合。</p>'}</div></div><button id="draft-undo" class="quiet" ${!draftSession.picks.length?'disabled':''}>撤回上一次选择</button>`;
  dialog.querySelectorAll('[data-draft]').forEach(b=>b.onclick=()=>{draftSession=pickDraft(draftSession,b.dataset.draft);show();});
  dialog.querySelector('#draft-close').onclick=()=>dialog.close();dialog.querySelector('#draft-undo').onclick=()=>{draftSession={...draftSession,picks:draftSession.picks.slice(0,-1)};show();};
  if(done)dialog.querySelector('#draft-start').onclick=()=>{try{localStorage.setItem('glimmer-draft-'+faction,JSON.stringify(draftSession.picks));}catch{message='无法保存轮抽卡组，请检查浏览器存储权限。';return;}deckKey='draft';dialog.close();newMatch();};
 }
 dialog.onclose=()=>render();show();dialog.showModal();
}

function chessCells(s){
 let units=s.players.flatMap((p,actor)=>p.units.filter(u=>u.cell!==null).map(u=>({...u,actor})));
 if(s.phase==='battle'&&s.battle){const tick=Math.min(s.battle.ticks,Math.floor((performance.now()-battleStarted)/100));const frame=s.battle.frames.findLast(f=>f.tick<=tick)||s.battle.frames[0];units=frame.units;}
 return Array.from({length:36},(_,pos)=>{
  const cell=me()===0?pos:35-pos,u=units.find(u=>u.cell===cell),c=u?(UNITS[u.type]||{name:'维修偶',art:'T02'}):null;
  return `<button class="chess-cell ${pos>=18?'home-cell':'away-cell'} ${selected===u?.uid?'chosen':''} ${selected&&pos>=18&&s.phase==='prep'?'placeable':''}" data-cell="${cell}" ${s.phase!=='prep'||s.players[me()].ready?'disabled':''} aria-label="${c?c.name+'，'+u.star+'星':'空位'}，第 ${Math.floor(pos/6)+1} 行第 ${pos%6+1} 列">
  ${u?`<span class="chess-piece ${u.actor===me()?'own-piece':'enemy-piece'}">${portrait(c.art)}<span class="piece-name">${c.name.slice(0,2)}</span><span class="piece-stars">${'★'.repeat(u.star)}</span>${u.hp!==undefined?`<span class="piece-health"><i style="width:${Math.max(0,u.hp/u.maxHp*100)}%"></i></span>`:''}</span>`:''}</button>`;
 }).join('');
}
function renderChess(){
 const s=state(),actor=me(),p=s?.players[actor],enemy=s?.players[1-actor];
 if(!s){root().innerHTML=`<div class="tabletop-head"><h1>微光棋阵</h1></div><div class="waiting-room">房间已建立<strong>${escape(room?.code)}</strong><span>朋友输入房间码即可加入。</span><p>${escape(message)}</p><button id="chess-leave" class="secondary">返回单人练习</button></div>`;bind('chess-leave',newMatch);return;}
 if(s.phase==='battle'&&battleKey!==s.round+'/'+s.seq){battleKey=s.round+'/'+s.seq;battleStarted=room?performance.now()-Math.max(0,(s.battle.ticks*100)-(view.deadline-view.now)):performance.now();}
 const picked=p.units.find(u=>u.uid===selected),info=picked?UNITS[picked.type]:null;
 const free=p.units.filter(u=>u.cell===null),onboard=p.units.filter(u=>u.cell!==null),mutable=s.phase==='prep'&&!p.ready&&!recordToWatch;
 const status=s.winner!==null?(s.winner===-1?'平局':s.winner===actor?'你获胜了':'对手获胜'):s.phase==='battle'?'自动战斗中':p.ready?'等待对手准备':'购买并布阵';
 root().innerHTML=`<div class="tabletop-head"><div><h1>微光棋阵</h1><p>买棋、三合一升星、搭配羁绊，让伙伴自动战斗。</p></div><span class="table-status">${status}</span></div>
 <div class="tabletop-layout"><section class="chess-table">
 <div class="chess-score"><span>对手 ♥ ${Math.max(0,enemy.hp)} · 人口 ${enemy.level}</span><strong>第 ${s.round} 轮</strong><span>你 ♥ ${Math.max(0,p.hp)}</span></div>
 <div class="chess-grid" aria-label="六乘六棋盘">${chessCells(s)}</div>
 <div class="chess-synergies">${synergyLabels(onboard).join(' / ')||'两种不同棋子共享种族或职业，即可激活羁绊。'}</div>
 <div class="bench-label">备战席 <span>${free.length}/5 · 点击棋子，再点下半场格子</span></div>
 <div class="chess-bench">${Array.from({length:5},(_,i)=>{const u=free[i];return u?`<button class="bench-piece ${selected===u.uid?'chosen':''}" data-bench="${u.uid}" ${!mutable?'disabled':''}>${portrait(UNITS[u.type].art)}<span>${UNITS[u.type].name}</span><small>${'★'.repeat(u.star)}</small></button>`:'<span class="bench-empty"></span>';}).join('')}</div>
 <div class="shop-heading"><h2>商店</h2><span>${p.gold} 金币 · 下轮利息 +${Math.min(3,Math.floor(p.gold/5))}</span></div>
 <div class="chess-shop">${p.shop.map((id,slot)=>{const c=UNITS[id];return c?`<button class="shop-piece" title="${escape(c.effect)}" data-buy="${slot}" ${!mutable||p.gold<c.cost?'disabled':''}><strong>${c.cost} 金币</strong>${portrait(c.art)}<b>${c.name}</b><small>${c.race} / ${c.role}</small><small>生命 ${c.hp} · 攻击 ${c.attackValue}</small><span>${p.units.some(u=>u.type===id)?'已有同名，收集合成':'购买'}</span></button>`:'<div class="shop-empty">已购买</div>';}).join('')}</div>
 </section><aside class="tabletop-rail">
 <section><h2>${info?.name||'准备阶段'}</h2><p>${info?`${info.race} / ${info.role} · ${picked.star} 星。${info.effect}`:'先买棋子，再放到下半场。三个同名同星棋子自动合成；同名棋子只算一个羁绊成员。'}</p>${info?`<p>一星基础：生命 ${info.hp}，攻击 ${info.attackValue}，间隔 ${info.interval} 秒，射程 ${info.range} 格。</p>`:''}
 ${picked?`<div class="table-buttons"><button id="chess-bench" class="quiet" ${!mutable||picked.cell===null?'disabled':''}>放回备战席</button><button id="chess-sell" class="quiet" ${!mutable?'disabled':''}>卖出 +${UNITS[picked.type].cost*3**(picked.star-1)}</button></div>`:''}
 <div class="table-buttons"><button id="chess-arrange" class="secondary" ${!mutable?'disabled':''}>自动布阵</button><button id="chess-level" class="quiet" ${!mutable||!LEVEL_COST[p.level]||p.gold<LEVEL_COST[p.level]?'disabled':''}>人口 ${p.level} → ${Math.min(6,p.level+1)}${LEVEL_COST[p.level]?' · '+LEVEL_COST[p.level]+' 金':''}</button></div>
 <div class="table-buttons"><button id="chess-roll" class="quiet" ${!mutable||p.gold<2?'disabled':''}>刷新 · 2 金</button><button id="chess-lock" class="quiet" ${!mutable?'disabled':''}>${p.locked?'解锁商店':'锁定商店'}</button></div>
 <button id="chess-ready" class="primary" ${!mutable?'disabled':''}>${p.ready?'已准备':'开始战斗'} · ${onboard.length}/${p.level} 上场</button>
 ${s.phase==='battle'&&!room&&!recordToWatch?'<button id="chess-skip" class="secondary">跳过战斗动画</button>':''}
 <p class="table-notice" role="status">${escape(message||lastAI)}</p></section>
 <section class="table-settings"><label for="chess-opponent">对手</label><select id="chess-opponent" ${room?'disabled':''}><option value="rule" ${opponent==='rule'?'selected':''}>规则经营</option><option value="laya" ${opponent==='laya'?'selected':''} ${!cap.laya?'disabled':''}>Laya 经营方向${cap.laya?'':'（需本机服务）'}</option></select><div class="table-buttons"><button id="chess-new" class="secondary">${room?'返回单人练习':'重新开局'}</button><button id="chess-export" class="quiet" ${room&&s.winner===null?'disabled':''}>导出回放</button></div></section>
 <section class="room-controls"><h2>好友对战</h2>${room?'<p>房间 '+room.code+' · 已连接</p>':`<button class="secondary" id="room-create" ${!cap.rooms?'disabled title="好友房间需要联机服务"':''}>创建房间</button><div class="room-join"><input id="room-code" maxlength="6" placeholder="六位房间码" aria-label="房间码"><button class="quiet" id="room-join" ${!cap.rooms?'disabled title="好友房间需要联机服务"':''}>加入</button></div>`}</section>
 ${s.lastBattle?`<section><h2>上一轮</h2><p>${s.lastBattle.winner===-1?'平局':s.lastBattle.winner===actor?'你赢下战斗':'对手赢下战斗'} · 你损失 ${s.lastBattle.damage[actor]} 生命</p><ol class="chess-stats">${s.lastBattle.stats.filter(u=>u.actor===actor).sort((a,b)=>b.dealt-a.dealt).slice(0,3).map(u=>`<li>${UNITS[u.type]?.name||'维修偶'}<span>伤害 ${u.dealt} / 治疗 ${u.healed}</span></li>`).join('')}</ol></section>`:''}
 </aside></div>`;
 root().querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>apply({type:'buy',slot:Number(b.dataset.buy),keep:selected}));
 root().querySelectorAll('[data-bench]').forEach(b=>b.onclick=()=>{selected=b.dataset.bench;render();});
 bindChessCells();bind('chess-bench',()=>apply({type:'bench',uid:selected}));bind('chess-sell',()=>apply({type:'sell',uid:selected}));
 bind('chess-arrange',()=>apply(formation(s,actor)));bind('chess-level',()=>apply({type:'level'}));bind('chess-roll',()=>apply({type:'roll'}));bind('chess-lock',()=>apply({type:'lock'}));bind('chess-ready',()=>apply({type:'ready'}));bind('chess-skip',()=>apply({type:'advance'}));
 bind('chess-new',newMatch);bind('chess-export',exportRecord);bind('chess-opponent',e=>{opponent=e.target.value;newMatch();},'change');bind('room-create',()=>enterRoom(false));bind('room-join',()=>enterRoom(true));
 if(s.phase==='battle'&&!battleTimer){const gen=generation;battleTimer=setInterval(()=>{
   const current=state();if(!active||gen!==generation||current?.phase!=='battle'){clearInterval(battleTimer);battleTimer=null;return;}
   const grid=root().querySelector('.chess-grid');if(grid)grid.innerHTML=chessCells(current);
   if(!room&&!recordToWatch&&performance.now()-battleStarted>=Math.max(1000,current.battle.ticks*100)){clearInterval(battleTimer);battleTimer=null;apply({type:'advance'});}
  },100);}
}
function bindChessCells(){root().querySelectorAll('[data-cell]').forEach(b=>b.onclick=()=>{
 const s=state(),p=s.players[me()],cell=Number(b.dataset.cell),u=p.units.find(u=>u.cell===cell);
 if(selected&&p.units.some(u=>u.uid===selected))apply({type:'move',uid:selected,cell});else if(u){selected=u.uid;render();}
});}
async function pumpChess(){
 if(!active||room||busy||recordToWatch||!match||match.state.phase!=='prep'||match.state.players[1].ready||match.state.winner!==null)return;
 busy=true;const gen=generation,s=match.state;let style='balanced',source='规则经营';render();
 if(opponent==='laya')try{const r=await fetch('/api/strategy-decision',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(2500),body:JSON.stringify({game:'chess',state:s,actor:1,provider:'laya'})});if(!r.ok)throw Error();const a=await r.json();if(!['balanced','economy','strength','level'].includes(a.id))throw Error();style=a.id;source='Laya 选方向，程序执行';}catch{source='规则接手';}
 await new Promise(r=>setTimeout(r,250));if(!active||gen!==generation)return;
 const actions=chessPlan(match.state,1,style);for(const action of actions)advanceStrategy(match,1,action);
 match.record.decisions??=[];match.record.decisions.push({round:s.round,actor:1,source,style,operations:actions.length});
 lastAI=source+'：'+({balanced:'兼顾阵容与存款',economy:'保留利息',strength:'花钱补强',level:'优先升级人口'})[style];busy=false;render();
}

export const strategyMusicActive=()=>active&&kind==='cards'&&!!state()&&state().phase!=='ended';
