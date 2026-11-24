import {localGameStorage as localStorage,sessionGameStorage as sessionStorage} from './storage.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {board,bench,formation,chessPlan,interest,streakBonus,isCreepRound,synergyDetails,nextChessOpponent,scoutChess} from '../src/chess.mjs';
import {UNITS,chessInfo,chessSkillText,ITEMS,LEVEL_XP,SHOP_ODDS} from '../src/chess-catalog.mjs';
import {combatUnits} from '../src/chess-battle.mjs';
import {portrait} from './art.mjs';
import {glyph} from './card-table.mjs';
import {recruitPreview,placementPreview,battleMoment} from './chess-feedback.mjs';
import {ChessPhaseClock,chessPresentationPhase} from './chess-phase-clock.mjs';
const root=()=>document.getElementById('strategy');
let deploymentZoom=true,lastReview=null,review=null,lastFxTick=-1,shopOpen=true,sideOpen=false;
let match=null,active=false,selected=null,equipment=null,inspect=0,error='',clock=0,speed=2,timer=null,played=0,watch=null,watchIndex=0,battleFinished=false,lastBattleKey='',drag=null,suppressClick=false;
const phaseClock=new ChessPhaseClock();
let phaseTimer=null,phaseCheckpoint=null,phaseSavedSecond=null,undoPlacement=null;
const s=()=>match.state,own=()=>s().players[0],esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const sound=kind=>window.dispatchEvent(new CustomEvent('glimmer-effect',{detail:kind}));
function saveClock(){if(watch||!match||!phaseClock.key)return;try{localStorage.setItem('glimmer-chess-clock',JSON.stringify({...phaseClock.snapshot(),seq:s().seq,seed:s().seed,format:match.record.format}));}catch{}}
function save(){if(watch||!match)return;try{localStorage.setItem('glimmer-chess-save',JSON.stringify(sealStrategy(match)));saveClock();}catch{}}
function restore(){try{const r=JSON.parse(localStorage.getItem('glimmer-chess-save'));if(r?.game==='chess'&&['glimmer-3','glimmer-4','glimmer-5'].includes(r.format)){replayStrategy(r);match=beginStrategy('chess',r.seed,null,r.format);for(const row of r.actions)advanceStrategy(match,row.actor,row.action);const checkpoint=JSON.parse(localStorage.getItem('glimmer-chess-clock'));if(checkpoint?.seq===s().seq&&checkpoint.seed===s().seed&&checkpoint.format===r.format)phaseCheckpoint=checkpoint;}}catch{}}
export function openChess(){active=true;clock=performance.now();document.body.classList.add('chess-mode');window.scrollTo(0,0);if(!match){restore();if(!match)newGame();}if(!watch&&!review){prepareRivals();save();}render();animateBattle();startPhaseTimer();}
export function closeChess(){if(active&&match?.state.phase==='battle'&&!document.hidden)played=Math.min(s().battle.ticks,played+(performance.now()-clock)/100*speed);phaseClock.suspend(true);save();active=false;clearInterval(timer);timer=null;clearInterval(phaseTimer);phaseTimer=null;document.body.classList.remove('chess-mode');cancelDrag();}
function prepareRivals(){if(watch||s().version<3||s().phase!=='prep')return;for(let actor=1;actor<8;actor++)if(s().players[actor].hp>0&&!s().players[actor].ready)for(const action of chessPlan(s(),actor))advanceStrategy(match,actor,action);}
function newGame(){if(match&&!watch&&s().version<4)try{localStorage.setItem('glimmer-chess-save-before-glimmer5',JSON.stringify(sealStrategy(match)));}catch{}lastReview=null;undoPlacement=null;phaseClock.clear();phaseCheckpoint=null;shopOpen=true;sideOpen=false;review=null;lastFxTick=-1;clearInterval(timer);timer=null;watch=null;watchIndex=0;match=beginStrategy('chess',crypto.getRandomValues(new Uint32Array(1))[0]);selected=null;equipment=null;inspect=0;error='';lastBattleKey='';battleFinished=false;prepareRivals();save();if(active){render();startPhaseTimer();}}
function apply(action,remember=true){if(watch||review&&action.type!=='loot')return;try{const priorLayout=own().units.filter(u=>u.cell!==null).map(({uid,cell})=>({uid,cell}));const prior=own().units.filter(u=>u.star>1).map(u=>u.uid+u.star).join();advanceStrategy(match,0,action);undoPlacement=remember&&['move','bench','arrange'].includes(action.type)?{seq:s().seq,layout:priorLayout}:null;error='';if(prior!==own().units.filter(u=>u.star>1).map(u=>u.uid+u.star).join())sound('buff');else if(action.type==='buy')sound('draw');save();render();}catch(e){error=e.message;render();}}
function ready(){undoPlacement=null;if(watch||review||s().phase!=='prep')return;if(s().round===1&&!board(own()).length){error='先把一枚棋子放到亮起的格子';render();return;}cancelDrag();shopOpen=false;sideOpen=false;lastFxTick=-1;inspect=0;selected=null;equipment=null;error='';
 try{for(let actor=1;actor<8;actor++)if(s().players[actor].hp>0&&!s().players[actor].ready)for(const action of chessPlan(s(),actor))advanceStrategy(match,actor,action);advanceStrategy(match,0,{type:'ready'});save();render();animateBattle();}catch(e){error=e.message;render();}
}
function nextRound(){undoPlacement=null;if(watch||!battleFinished||own().loot)return;shopOpen=true;sideOpen=false;if(review)review=null;else advanceStrategy(match,-1,{type:'advance'});error='';selected=null;equipment=null;lastBattleKey='';prepareRivals();save();render();}
function syncPhase(){
 const phase=chessPresentationPhase(s(),{review,watch}),key=[match.record.format,s().seed,review?.round||s().round,phase.kind].join('/');
 const changed=phaseClock.enter(key,phase.duration,phaseCheckpoint);phaseCheckpoint=null;
 const waiting=phase.kind==='prep'&&s().round===1&&!board(own()).length;
 phaseClock.suspend(!active||document.hidden||waiting||!!drag||!!root()?.querySelector('dialog[open]'));
 if(changed){shopOpen=phase.kind==='prep';phaseSavedSecond=null;saveClock();}
 return {...phase,waiting,...phaseClock.snapshot()};
}
function paintPhase(){
 if(!active||!match)return;const phase=syncPhase(),node=root().querySelector('#ac-phase');if(!node)return;
 const seconds=Math.ceil(phase.remaining/1000),label=phase.waiting?'先布阵':phase.paused?'已暂停':phase.label;
 node.dataset.phase=phase.kind;node.classList.toggle('is-urgent',phase.kind==='prep'&&seconds<=5&&!phase.paused&&!phase.waiting);node.classList.toggle('is-paused',phase.paused||phase.waiting);
 node.style.setProperty('--phase-progress',(phase.duration?phase.remaining/phase.duration*100:0)+'%');
 const title=node.querySelector('#ac-phase-label');if(title.textContent!==label)title.textContent=label;
 const count=node.querySelector('#ac-countdown');count.hidden=!phase.duration;count.textContent=String(seconds);count.setAttribute('aria-label',label+'剩余 '+seconds+' 秒');
 const pause=node.querySelector('#ac-phase-pause');pause.hidden=!phase.duration;pause.disabled=phase.waiting;pause.textContent=phase.paused?'▶':'Ⅱ';pause.setAttribute('aria-pressed',String(phase.paused));pause.setAttribute('aria-label',phase.paused?'继续倒计时':'暂停倒计时');
 const result=root().querySelector('#ac-battle-result');if(result&&phase.kind==='prep')result.textContent=phase.waiting?'上阵第一枚棋子后开始计时':phase.paused?'准备已暂停':phaseClock.suspended?'查看中 · 计时暂停':'倒计时结束自动开战';
 if(result&&phase.kind==='settle'){const battle=review?.battle||s().battle;result.textContent=battle?battleLabel(battle):'结算';}
 if(phaseSavedSecond!==seconds){phaseSavedSecond=seconds;saveClock();}
}
function phaseTick(){
 if(!active||watch)return;paintPhase();
 if(phaseClock.consumeExpiry()){
  const phase=chessPresentationPhase(s(),{review,watch});if(phase.kind==='prep')ready();else if(phase.kind==='settle')nextRound();
 }
}
function startPhaseTimer(){clearInterval(phaseTimer);phaseTimer=setInterval(phaseTick,100);phaseTick();}
function drawPiece(u,side=0,battle=false){const c=chessInfo(u.type)||{name:'维修偶',art:'T02',hp:150,attackValue:25,cost:1},health=battle?Math.max(0,u.hp/u.maxHp)*100:100,energy=battle?u.energy:0;
 return `<button class="ac-piece ${side?'enemy-piece':'home-piece'} ${selected===u.uid?'picked':''} cost-${c.cost}" data-uid="${u.uid}" ${battle?'data-battle-piece':''} aria-label="${c.name} ${u.star} 星${battle?' 生命 '+u.hp:''}" style="--col:${u.cell%8};--row:${Math.floor(u.cell/8)}"><span class="ac-stars">${'★'.repeat(u.star)}</span><span class="ac-avatar">${portrait(c.art)}</span><span class="ac-unit-name">${c.name}</span><span class="ac-health"><i style="width:${health}%"></i></span>${battle?`<span class="ac-mana"><i style="width:${energy}%"></i></span>`:''}${u.shield?'<span class="ac-shield">'+glyph('shield')+'</span>':''}${u.items?.length?`<span class="ac-equipped">${u.items.map(id=>glyph(ITEMS[id].icon)).join('')}</span>`:''}</button>`;
}
function detail(){const p=s().players[inspect],u=p.units.find(u=>u.uid===selected)||own().units.find(u=>u.uid===selected);if(!u)return `<div class="ac-detail-empty">${glyph('eye')}<span>选择棋子</span></div>`;const c=chessInfo(u.type),ours=own().units.includes(u),mutable=s().phase==='prep'&&!review&&!watch&&ours;const team=ours?own():p,stats=combatUnits({players:[{units:u.cell===null?[{...u,cell:35}]:team.units}] }).find(v=>v.uid===u.uid);
 return `<div class="ac-detail cost-${c.cost}">${portrait(c.art)}<h3>${c.name} <small>${'★'.repeat(u.star)}</small></h3><div class="ac-trait-pair"><span>${c.race}</span><span>${c.role}</span></div><small class="ac-stat-context">${u.cell===null?'单体 · 含装备':'上阵 · 含装备与羁绊'}</small><div class="ac-numbers"><span>${glyph('heart')}${stats.maxHp}</span><span>${glyph('sword')}${stats.attack}</span><span>射程 ${c.range}</span></div><small class="ac-stat-context">技能强度 ×${Number(stats.skill.toFixed(2))}</small><p>${chessSkillText(c.id,s().version,stats.skill)}</p><div class="ac-detail-items">${u.items.map((id,slot)=>mutable&&s().version>=3?`<button class="ac-remove-item" data-unequip="${slot}" ${own().gold<1?'disabled':''} title="${ITEMS[id].text}">${glyph(ITEMS[id].icon)}${ITEMS[id].name}<small>拆卸 1 金</small></button>`:`<span title="${ITEMS[id].text}">${glyph(ITEMS[id].icon)}${ITEMS[id].name}</span>`).join('')}</div>${mutable?`<button id="ac-to-bench" class="quiet" ${u.cell===null||bench(own()).length>=8?'disabled':''}>备战席</button><button id="ac-sell" class="quiet ac-sell">出售 +${c.cost*3**(u.star-1)} 金</button>`:''}</div>`;
}
function render(){
 if(!active)return;
 syncPhase();
 if(s().phase==='battle'&&lastBattleKey!==s().round+'/'+s().seq){lastBattleKey=s().round+'/'+s().seq;clock=performance.now();played=0;battleFinished=false;lastFxTick=-1;}
 const st=s(),p=own(),prep=st.phase==='prep'&&!review,finished=st.phase==='ended',observed=st.players[inspect],traits=synergyDetails(board(observed)),editable=prep&&!watch&&inspect===0;
 const combat=review?.battle||st.battle,round=review?.round||st.round,upcoming=scoutChess(st),rival=upcoming.rival;
 const opp=combat?.opponent,enemyName=opp===-1?'野怪':st.players[opp]?.name||'等待配对',chosen=p.units.find(u=>u.uid===selected),shopVisible=shopOpen&&prep&&!watch&&!p.loot;
 const canTrade=prep&&!watch;
 root().innerHTML=`<div class="ac-top"><div><h1>微光棋阵</h1><span>你与 7 位 AI 棋手</span></div><div class="ac-round"><b>第 ${round} 轮</b><span>${isCreepRound(round)?'野怪轮':'棋手对战'}</span></div><div class="ac-top-actions"><button id="ac-info-toggle" class="quiet" aria-expanded="${sideOpen}">阵容</button><button id="ac-export" class="quiet">${glyph('cards')}回放</button><button id="ac-new" class="quiet">新对局</button></div></div>
 <div class="ac-layout"><aside class="ac-standings" aria-label="八名棋手"><h2>棋手</h2>${st.players.map((q,i)=>({q,i})).sort((a,b)=>(a.q.placement??0)-(b.q.placement??0)||b.q.hp-a.q.hp||a.i-b.i).map(({q,i})=>`<button class="ac-player ${prep&&rival===i?'next-rival':''} ${inspect===i?'viewing':''} ${q.hp<=0?'eliminated':''}" data-observe="${i}" aria-label="查看${q.name}的棋盘"><span class="ac-player-avatar">${portrait(['W03','W02','F03','S05','N05','S04','N04','F10'][i])}</span><span><b>${q.name}</b><small>${q.placement?'第 '+q.placement+' 名':'等级 '+q.level+' · '+board(q).length+' 人'}</small><i class="ac-player-health"><i style="width:${q.hp}%"></i></i></span><strong>${q.hp}</strong></button>`).join('')}</aside>
 <div class="ac-center"><div class="ac-board-heading">${editable?`<button id="ac-deploy-zoom" class="quiet ac-zoom-toggle" aria-pressed="${deploymentZoom}" aria-label="切换全盘与放大布阵">${deploymentZoom?'全盘':'放大布阵'}</button>`:''}<span id="ac-live-readout">${inspect?`正在查看 ${observed.name}`:prep?`第 ${st.round} 轮`:`对阵 ${enemyName}`}</span><span id="ac-phase" class="ac-phase"><span id="ac-phase-label"></span><b id="ac-countdown" role="timer"></b><button id="ac-phase-pause" class="quiet" aria-label="暂停倒计时">Ⅱ</button></span>${inspect?'<button class="quiet" id="ac-home">回到我的棋盘</button>':`<span class="ac-population ${board(p).length<p.level?'roomy':''}">${glyph('cards')}${board(p).length} / ${p.level}</span>`}</div>
 ${prep&&st.version>=3?`<div class="ac-scout-bar"><span>${glyph('eye')}本轮 <b>${rival===-1?'野怪':st.players[rival]?.name||'待定'}</b></span><small>${upcoming.units.length} 枚 · 阵容已显示</small><button id="ac-scout" class="quiet" aria-pressed="${inspect!==0}" ${rival===-1?'disabled':''}>${inspect?'返回布阵':'查看羁绊'}</button></div>`:''}
 <div class="ac-tablewell"><div class="ac-table"><div class="ac-board-viewport ${editable&&deploymentZoom?'focus-home':''}"><div class="ac-board ${!prep&&!finished&&inspect===0?'is-combat':''}" aria-label="八乘八棋盘">${Array.from({length:64},(_,cell)=>`<button class="ac-cell ${(Math.floor(cell/8)+cell%8)%2?'dark':''} ${cell>=32?'home-cell':'away-cell'} ${editable&&cell>=32&&(selected||!board(p).length&&bench(p).length)?'placeable':''}" data-cell="${cell}" aria-label="第 ${Math.floor(cell/8)+1} 行，第 ${cell%8+1} 列" ${editable&&cell>=32?'':'disabled'}></button>`).join('')}<div class="ac-river"><span>${review?'战斗结束':prep?inspect?'观战':'部署区域':'自动战斗'}</span></div>${review&&battleMoment(combat)?momentMarker(battleMoment(combat)):!!chosen&&editable?`<div class="ac-piece-lens" aria-hidden="true">${portrait(chessInfo(chosen.type).art)}<span>${chessInfo(chosen.type).name} ${'★'.repeat(chosen.star)}</span></div>`:''}<svg class="ac-focus-path" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden="true"></svg><div class="ac-piece-layer"></div>${editable&&!board(p).length&&bench(p).length?'<svg class="ac-deploy-cue" viewBox="0 0 100 100" aria-hidden="true"><rect x="38" y="64" width="12" height="12" rx="2"/><path d="M8 98 Q10 78 40 71 M32 65 L43 70 L36 79"/></svg>':''}<div class="ac-fx" aria-hidden="true"></div><svg class="ac-shots" viewBox="0 0 800 800" preserveAspectRatio="none"></svg>${finished?`<div class="ac-final"><b>${st.winner===0?'冠军':'第 '+(p.placement||st.players.filter(p=>p.hp>0).length+1)+' 名'}</b><span>${st.reason}</span><button class="primary" id="ac-again">再来一局</button></div>`:''}</div>
 </div><div class="ac-bench" aria-label="八个备战席"><span class="ac-bench-label">备战席</span>${Array.from({length:8},(_,i)=>{const u=bench(p)[i];return `<div class="ac-bench-slot">${u?drawPiece({...u,cell:0}):'<span>＋</span>'}</div>`;}).join('')}</div></div></div>
 <div class="ac-hud"><div class="ac-selection" role="status">${lastReview&&prep?'<button id="ac-last-round" class="quiet" aria-label="查看上一轮战况">上轮</button>':''}${undoPlacement&&canTrade?'<button id="ac-undo" class="quiet" aria-label="撤销上次布阵">↶ 撤销</button>':''}${error?`<span class="ac-error">${esc(error)}</span>`:chosen?`<b>${chessInfo(chosen.type).name} ${'★'.repeat(chosen.star)}</b><button id="ac-detail-toggle" class="quiet">详情</button>${canTrade&&chosen.cell!==null?`<button id="ac-recall-short" class="quiet" ${bench(p).length>=8?'disabled':''}>备战席</button>`:''}`:`<span>${equipment!==null?'选择棋子':prep?p.units.length?'拖入亮格':'招募棋子':review?battleLabel(review.battle):finished?'本局结束':'战斗中'}</span>`}</div>
 <div class="ac-economy"><div class="ac-gold">${glyph('gem')}<strong>${p.gold}</strong><small title="每存 10 金多获得 1 金，上限 5 金">利息 +${interest(p.gold)}${streakBonus(Math.abs(p.streak))?' · 连'+(p.streak>0?'胜':'败')+' +'+streakBonus(Math.abs(p.streak)):''}</small></div><div class="ac-level"><b>等级 ${p.level} <small>${p.level===10?'已满':p.xp+' / '+LEVEL_XP[p.level]+' 经验'}</small></b><i><i style="width:${p.level===10?100:p.xp/LEVEL_XP[p.level]*100}%"></i></i></div><button id="ac-level" class="quiet" ${!canTrade||p.level>=10||p.gold<5?'disabled':''}>+4 经验 <b>5 金</b></button><button id="ac-shop-toggle" class="primary" aria-expanded="${shopVisible}" aria-controls="ac-shop-panel" title="空格打开或收起招募" ${!canTrade||p.loot?'disabled':''}>${glyph('cards')}${shopVisible?'收起':'招募'}${p.locked?' · 锁定':''}</button></div>
 <div class="ac-combat-bar"><span id="ac-battle-result">${review?battleLabel(review.battle):watch?'回放中':prep?'准备就绪后开战':finished?'':enemyName+' · 自动战斗'}</span><div><select id="ac-speed" aria-label="战斗速度">${[1,2,4].map(n=>`<option value="${n}" ${speed===n?'selected':''}>${n} 倍速</option>`).join('')}</select>${prep?`<button class="quiet" id="ac-arrange" ${!p.units.length||watch?'disabled':''}>自动布阵</button><button class="primary" id="ac-ready" ${watch||p.loot||st.round===1&&!board(p).length?'disabled':''}>${glyph('sword')}开战</button>`:finished?'':`<button class="quiet" id="ac-skip" ${battleFinished?'disabled':''}>快进</button><button class="primary" id="ac-next" ${!battleFinished||watch||p.loot?'disabled':''}>下一轮</button>`}</div></div></div>
 <section id="ac-shop-panel" class="ac-shop-panel" aria-label="招募商店" ${shopVisible?'':'hidden'}><div class="ac-shop-heading"><h2>招募棋子</h2><span>准备阶段</span><button id="ac-shop-close" class="quiet" aria-label="收起招募商店">收起 ×</button></div><div class="ac-shop">${p.shop.map((id,slot)=>{const c=UNITS[id],copies=p.units.filter(u=>u.type===id).reduce((n,u)=>n+3**(u.star-1),0),preview=c?recruitPreview(p,id):null,merges=preview?.mergeStar;return c?`<div class="ac-offer-wrap"><button title="${esc(chessSkillText(c.id,s().version))} · 射程 ${c.range}" class="ac-offer cost-${c.cost} ${merges?'merge-ready':''}" data-buy="${slot}" ${!canTrade||p.gold<c.cost?'disabled':''} aria-label="招募${c.name} ${c.cost} 金币"><span class="ac-offer-cost">${c.cost} ${glyph('gem')}</span>${portrait(c.art)}<b>${c.name}</b><span>${c.race} · ${c.role}</span><small>♥ ${c.hp} ⚔ ${c.attackValue} · 射程 ${c.range}</small>${preview.ones?`<em class="ac-merge-recipe" aria-label="已拥有 ${preview.ones} 枚一星，三枚合成二星">${[0,1,2].map(i=>`<i class="${i<preview.ones?'owned':'missing'}">★</i>`).join(' + ')} → ★★${preview.mergeStar===3?' ↗★★★':''}</em>`:copies?`<em>已有 ${copies} 份</em>`:''}${offerTraits(preview)}</button><button class="ac-preview-button" data-preview="${slot}" aria-label="查看${c.name}技能">ⓘ</button></div>`:'<div class="ac-offer sold">已招募</div>';}).join('')}</div><div class="ac-shop-footer"><div class="ac-shop-odds" aria-label="商店稀有度概率">${SHOP_ODDS[p.level].map((v,i)=>`<span class="cost-${i+1}">${i+1}费 ${v}%</span>`).join('')}</div><button id="ac-roll" class="quiet" ${!canTrade||p.gold<2?'disabled':''}>${glyph('swap')}刷新 2 金</button><button id="ac-lock" class="quiet ${p.locked?'locked':''}" ${!canTrade?'disabled':''} aria-pressed="${p.locked}">${p.locked?'已锁定':'锁定商店'}</button></div></section>
 ${!finished&&(review||p.loot)?`<section class="ac-reward-panel" aria-label="本轮结算">${p.loot?`<section class="ac-loot" aria-label="选择战利品"><div><b>战利品 · 三选一</b></div><div class="ac-loot-options">${p.loot.options.map((id,slot)=>`<button data-loot="${slot}" ${watch||finished?'disabled':''}>${glyph(ITEMS[id].icon)}<b>${ITEMS[id].name}</b><span>${ITEMS[id].text}</span></button>`).join('')}</div></section>`:''}${review?battleRecap(review.battle):''}</section>`:''}</div>
 <aside class="ac-sidebar ${sideOpen?'is-open':''}"><div class="ac-sidebar-heading"><b>阵容与装备</b><button id="ac-info-close" class="quiet" aria-label="关闭阵容面板">×</button></div><section class="ac-synergies"><h2>羁绊 <small>${inspect?observed.name:'已上阵'}</small></h2>${traits.length?traits.sort((a,b)=>b.level-a.level||b.count-a.count).map(t=>`<div class="ac-synergy ${t.level?'active':''}" title="${t.text}"><b>${t.id}</b><span>${t.count} / ${t.next}</span><div class="ac-trait-pips" aria-hidden="true">${Array.from({length:t.next},(_,i)=>`<i class="${i<t.count?'filled':''}"></i>`).join('')}</div><small>${t.level?'✓ 已激活 · ':'未激活 · '}${t.text}</small></div>`).join(''):'<span class="ac-muted">不同棋子组成羁绊</span>'}</section><section class="ac-inspector">${detail()}</section><section class="ac-items"><h2>装备</h2><div>${p.inventory.map((id,slot)=>`<button class="quiet ${equipment===slot?'selected':''}" data-equip="${slot}" ${!canTrade?'disabled':''} title="${ITEMS[id].name}：${ITEMS[id].text}">${glyph(ITEMS[id].icon)}<span>${ITEMS[id].name}</span></button>`).join('')||'<span class="ac-muted">击败野怪获得装备</span>'}</div>${equipment!==null?'<small>选择己方棋子装备</small>':''}</section></aside></div><dialog id="ac-preview"></dialog>`;
 const bind=(id,fn)=>{const n=root().querySelector('#'+id);if(n)n.onclick=fn;};
 bind('ac-deploy-zoom',()=>{deploymentZoom=!deploymentZoom;render();});
 bind('ac-last-round',()=>{const d=root().querySelector('#ac-preview');d.className='ac-review-dialog';d.innerHTML='<button class=quiet id=ac-review-close>关闭 ×</button><h3>第 '+lastReview.round+' 轮</h3>'+battleRecap(lastReview.battle);d.querySelector('#ac-review-close').onclick=()=>d.close();d.showModal();});
 bind('ac-undo',()=>{if(undoPlacement?.seq===s().seq){const layout=undoPlacement.layout;apply({type:'arrange',layout},false);}});
 bind('ac-phase-pause',()=>{phaseClock.pause(!phaseClock.paused);saveClock();paintPhase();});
 bind('ac-shop-toggle',()=>{shopOpen=!shopOpen;render();document.getElementById('ac-shop-toggle')?.focus({preventScroll:true});});bind('ac-shop-close',()=>{shopOpen=false;render();document.getElementById('ac-shop-toggle')?.focus({preventScroll:true});});
 bind('ac-info-toggle',()=>{sideOpen=!sideOpen;render();});bind('ac-info-close',()=>{sideOpen=false;render();});bind('ac-detail-toggle',()=>{sideOpen=true;render();root().querySelector('.ac-inspector')?.scrollIntoView({block:'nearest'});});
 bind('ac-recall-short',()=>apply({type:'bench',uid:selected}));
 bind('ac-scout',()=>{inspect=inspect?0:rival;selected=null;shopOpen=false;sideOpen=inspect!==0;render();});
 root().querySelectorAll('[data-loot]').forEach(b=>b.onclick=()=>apply({type:'loot',slot:Number(b.dataset.loot)}));
 root().querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>apply({type:'unequip',uid:selected,slot:Number(b.dataset.unequip)}));
 bind('ac-new',newGame);bind('ac-again',newGame);bind('ac-home',()=>{inspect=0;selected=null;sideOpen=false;render();});bind('ac-ready',ready);bind('ac-arrange',()=>{shopOpen=false;sideOpen=false;apply(formation(s(),0));});bind('ac-level',()=>apply({type:'level'}));bind('ac-roll',()=>apply({type:'roll'}));bind('ac-lock',()=>apply({type:'lock'}));bind('ac-next',nextRound);bind('ac-skip',()=>{played=s().battle.ticks;clock=performance.now();paintBattle();});bind('ac-to-bench',()=>apply({type:'bench',uid:selected}));bind('ac-sell',()=>{const uid=selected;selected=null;apply({type:'sell',uid});});bind('ac-export',exportReplay);
 root().querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>previewOffer(Number(b.dataset.preview)));
 root().querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>apply({type:'buy',slot:Number(b.dataset.buy)}));
 root().querySelectorAll('[data-observe]').forEach(b=>b.onclick=()=>{inspect=Number(b.dataset.observe);selected=null;shopOpen=false;render();});
 root().querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{equipment=equipment===Number(b.dataset.equip)?null:Number(b.dataset.equip);sideOpen=false;shopOpen=false;inspect=0;render();});
 root().querySelectorAll('[data-cell]').forEach(b=>b.onclick=()=>{const uid=selected||(!board(p).length?bench(p)[0]?.uid:null);if(uid&&editable){shopOpen=false;apply({type:'move',uid,cell:Number(b.dataset.cell)});}});
 root().querySelector('#ac-speed').onchange=e=>{if(s().phase==='battle'){played+=Math.max(0,performance.now()-clock)/100*speed;clock=performance.now();}speed=Number(e.target.value);};
 if((st.phase==='battle'||review)&&inspect===0)paintBattle();else{const units=board(observed);root().querySelector('.ac-piece-layer').innerHTML=units.map(u=>drawPiece(u,inspect?1:0)).join('')+(prep&&!inspect&&st.version>=3?upcoming.units.map(u=>drawPiece(u,1)).join(''):'');}
 root().querySelectorAll('[data-cell]').forEach(n=>{n.onpointerenter=()=>paintPlacement(selected,Number(n.dataset.cell));n.onpointerleave=()=>paintPlacement(null);});
 bindPieces();paintPhase();
}
function bindPieces(){root().querySelectorAll('[data-uid]').forEach(b=>b.onclick=()=>{if(suppressClick)return;shopOpen=false;const uid=b.dataset.uid;if(equipment!==null&&own().units.some(u=>u.uid===uid)){const slot=equipment;equipment=null;apply({type:'equip',uid,slot});}else{if(s().version>=3&&s().phase==='prep'&&!own().units.some(u=>u.uid===uid)){const owner=s().players.findIndex(p=>p.units.some(u=>u.uid===uid));if(owner>0)inspect=owner;}selected=selected===uid?null:uid;render();}});}
function animateBattle(){if(!active||s().phase!=='battle')return;const key=s().round+'/'+s().seq;if(key!==lastBattleKey){lastBattleKey=key;clock=performance.now();played=0;battleFinished=false;}
 clearInterval(timer);timer=setInterval(()=>{if(active&&s().phase==='battle')paintBattle();},60);paintBattle();}
function paintBattle(){if(!active||document.hidden||s().phase!=='battle'&&!review)return;const battle=review?.battle||s().battle,tick=review?battle.ticks:Math.min(battle.ticks,played+(performance.now()-clock)/100*speed),frames=battle.frames;let f=frames[0];for(const frame of frames){if(frame.tick>tick)break;f=frame;}
 if(inspect===0){
 const layer=root().querySelector('.ac-piece-layer');if(!layer)return;
 if(!review&&tick<battle.ticks)paintCombatEffects(battle,tick);

 for(const node of layer.querySelectorAll('[data-uid]'))if(!f.units.some(u=>u.uid===node.dataset.uid))node.remove();
 for(const u of f.units){let node=layer.querySelector(`[data-uid="${u.uid}"]`);if(!node){layer.insertAdjacentHTML('beforeend',drawPiece(u,u.actor,true));node=layer.lastElementChild;node.onclick=()=>{selected=selected===u.uid?null:u.uid;render();};}node.style.setProperty('--col',u.cell%8);node.style.setProperty('--row',Math.floor(u.cell/8));node.querySelector('.ac-health i').style.width=Math.max(0,u.hp/u.maxHp)*100+'%';node.querySelector('.ac-mana i').style.width=u.energy+'%';node.setAttribute('aria-label',(chessInfo(u.type)?.name||'维修偶')+' 生命 '+u.hp);}
 paintBattleFocus(f,frames[Math.max(0,frames.indexOf(f)-1)]);
 const shots=root().querySelector('.ac-shots');if(shots&&shots.dataset.frame!==String(f.tick)){shots.dataset.frame=f.tick;const positions=new Map(f.units.map(u=>[u.uid,u.cell]));shots.innerHTML=(f.events||[]).map(e=>{const a=positions.get(e.source),b=positions.get(e.target);if(a===undefined||b===undefined)return '';return `<line x1="${a%8*100+50}" y1="${Math.floor(a/8)*100+50}" x2="${b%8*100+50}" y2="${Math.floor(b/8)*100+50}" class="${e.kind}"/>`;}).join('');if(f.events?.some(e=>e.kind==='cast'))sound('cast');}
 }
 if(!review&&tick>=battle.ticks&&!battleFinished){battleFinished=true;
 if(!watch){review={battle,round:s().round};lastReview=review;advanceStrategy(match,-1,{type:'advance'});inspect=0;selected=null;equipment=null;cancelDrag();clearInterval(timer);timer=null;save();render();sound(battle.winner===0?'heal':'damage');return;}
const result=root().querySelector('#ac-battle-result');if(result)result.textContent=battle.winner===0?(battle.pve?'野怪击败 · 获得装备':'获胜 · +1 金币'):battle.winner===-1?'平局 · −2 生命':'落败 · −'+battle.damage[0]+' 生命';const next=root().querySelector('#ac-next'),skip=root().querySelector('#ac-skip');if(next)next.disabled=!!watch;if(skip)skip.disabled=true;sound(battle.winner===0?'heal':'damage');if(watch)setTimeout(advanceWatch,600);}
}
function paintBattleFocus(frame,previous){
 const unit=frame.units.find(u=>u.uid===selected),range=unit?(chessInfo(unit.type)?.range||1):0;
 root().querySelectorAll('[data-cell]').forEach(node=>{const cell=Number(node.dataset.cell);node.classList.toggle('in-range',!!unit&&Math.max(Math.abs(cell%8-unit.cell%8),Math.abs(Math.floor(cell/8)-Math.floor(unit.cell/8)))<=range);});
 const old=previous?.units.find(u=>u.uid===selected),moving=unit&&old&&unit.cell!==old.cell,path=root().querySelector('.ac-focus-path');
 if(path)path.innerHTML=moving?`<path d="M ${old.cell%8*100+50} ${Math.floor(old.cell/8)*100+50} L ${unit.cell%8*100+50} ${Math.floor(unit.cell/8)*100+50}"/>`:'';
 const label=root().querySelector('#ac-live-readout');if(label){label.textContent=unit?`${chessInfo(unit.type)?.name||'召唤物'} · ${moving?'走位':'交战'} · 普攻射程 ${range}`:selected?'棋子已退场':'自动战斗 · 点棋子看射程';if(unit)label.title='生命 '+unit.hp+' / '+unit.maxHp;}
}
function exportReplay(){const record=watch||sealStrategy(match),url=URL.createObjectURL(new Blob([JSON.stringify(record)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='glimmer-chess-'+record.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function watchChess(record){lastReview=null;shopOpen=false;sideOpen=false;review=null;lastFxTick=-1;replayStrategy(record);closeChess();active=true;document.body.classList.add('chess-mode');watch=record;watchIndex=0;match=beginStrategy('chess',record.seed,null,record.format);lastBattleKey='';inspect=0;selected=null;render();advanceWatch();}
function advanceWatch(){if(!active||!watch)return;while(watchIndex<watch.actions.length){const row=watch.actions[watchIndex++];advanceStrategy(match,row.actor,row.action);if(s().phase==='battle'&&row.action.type==='ready'){render();animateBattle();return;}}render();}
function cancelDrag(){
 const d=drag;drag=null;d?.ghost?.remove();d?.dock?.remove();
 if(d?.source.hasPointerCapture(d.pointer))d.source.releasePointerCapture(d.pointer);
 root()?.classList.remove('ac-dragging');paintPlacement(null);root()?.querySelectorAll('.is-drop-hover,.is-drag-source').forEach(n=>n.classList.remove('is-drop-hover','is-drag-source'));
}
function chessDrop(x,y){
 const target=document.elementFromPoint(x,y);if(!target||!root().contains(target))return null;
 const zone=target.closest('[data-chess-drop],.ac-bench');
 if(zone){const type=zone.dataset.chessDrop||'bench',u=own().units.find(u=>u.uid===drag.uid);return {type,node:zone,valid:type==='sell'||u.cell===null||bench(own()).length<8};}
 const board=target.closest('.ac-board');if(!board)return null;
 const r=board.getBoundingClientRect(),cell=Math.floor((y-r.top)/r.height*8)*8+Math.floor((x-r.left)/r.width*8);
 return {type:'move',cell,node:root().querySelector(`[data-cell="${cell}"]`),valid:cell>=32&&cell<64&&placementPreview(own(),drag.uid,cell)?.legal};
}
document.addEventListener('pointerdown',e=>{
 if(!active||drag||e.button!==0||e.isPrimary===false||watch||review||s().phase!=='prep'||inspect!==0)return;
 const b=e.target.closest('[data-uid]');if(!b||!root().contains(b)||!own().units.some(u=>u.uid===b.dataset.uid))return;
 drag={uid:b.dataset.uid,x:e.clientX,y:e.clientY,pointer:e.pointerId,source:b};b.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;
 if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7){
  const u=own().units.find(u=>u.uid===drag.uid),c=chessInfo(u.type);drag.ghost=document.createElement('div');drag.ghost.className='ac-drag';drag.ghost.innerHTML=portrait(c.art);document.body.append(drag.ghost);
  drag.dock=document.createElement('div');drag.dock.className='ac-drop-dock';drag.dock.innerHTML=`<div data-chess-drop="bench" aria-disabled="${u.cell!==null&&bench(own()).length>=8}"><b>↓ 备战席</b><span>${u.cell!==null&&bench(own()).length>=8?'已满 · 不能退回':'松手退回备战席'}</span></div><div data-chess-drop="sell"><b>出售 +${c.cost*3**(u.star-1)} 金</b><span>${esc(c.name)}${u.items.length?' · 装备退回':''}</span></div>`;
  root().querySelector('.ac-hud').append(drag.dock);root().classList.add('ac-dragging');drag.source.classList.add('is-drag-source');
  root().querySelectorAll('.ac-cell.home-cell').forEach(n=>n.classList.add('placeable'));
 }
 if(drag.ghost){e.preventDefault();drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';root().querySelectorAll('.is-drop-hover').forEach(n=>n.classList.remove('is-drop-hover'));const drop=chessDrop(e.clientX,e.clientY);if(drop?.valid)drop.node?.classList.add('is-drop-hover');drag.ghost.classList.toggle('invalid-drop',!drop?.valid);paintPlacement(drag.uid,drop?.type==='move'?drop.cell:null);}
},{passive:false});
document.addEventListener('pointerup',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;const d=drag,drop=d.ghost?chessDrop(e.clientX,e.clientY):null;cancelDrag();if(!d.ghost)return;
 suppressClick=true;setTimeout(()=>suppressClick=false,0);
 if(drop?.valid){shopOpen=false;sideOpen=false;selected=drop.type==='sell'?null:d.uid;apply({type:drop.type,uid:d.uid,...(drop.type==='move'?{cell:drop.cell}:{})});}
 else{error=drop?.type==='bench'?'备战席已满，棋子留在原位':drop?.type==='move'?'只能部署到下半场':'';render();}
});
function abortDrag(){if(!drag)return;const moved=!!drag.ghost;cancelDrag();if(moved){suppressClick=true;setTimeout(()=>suppressClick=false,0);}if(active)render();}
document.addEventListener('pointercancel',e=>{if(e.pointerId===drag?.pointer)abortDrag();});
document.addEventListener('lostpointercapture',e=>{if(e.pointerId===drag?.pointer)abortDrag();});
window.addEventListener('blur',abortDrag);

function battleLabel(b){return b.winner===0?(b.pve?(s().version>=3?'野怪击败 · 选择战利品':'野怪击败 · 装备已入袋'):'获胜 · 奖励已到账'):b.winner===-1?'平局 · −2 生命':'落败 · −'+b.damage[0]+' 生命';}
function battleRecap(b){
 const m=battleMoment(b);return m?`<div class="ac-recap ac-turning-point" aria-label="本轮关键棋子"><div>${portrait(chessInfo(m.type)?.art)}<span><small>${m.label}</small><b>${m.name}</b><em>${m.value}</em></span></div></div>`:'';
}
function momentMarker(m){return `<div class="ac-moment" style="--col:${m.cell%8};--row:${Math.floor(m.cell/8)}" aria-label="${m.label}：${m.name}">${portrait(chessInfo(m.type)?.art)}<b>${m.label}</b></div>`;}
function offerTraits(preview){
 const trait=preview?.traits.filter(t=>t.before>0).sort((a,b)=>(b.level>b.wasLevel)-(a.level>a.wasLevel))[0];
 return trait?`<span class="ac-offer-trait ${trait.level>trait.wasLevel?'activates':''}" title="上阵后${preview.needsSwap?'需替换棋子，以落格预览为准':''}">${trait.id} ${preview.needsSwap?trait.before+' / '+trait.next:trait.before+' → '+trait.count}${!preview.needsSwap&&trait.level>trait.wasLevel?' ✦':''}</span>`:'';
}
function paintPlacement(uid,cell){
 const node=root()?.querySelector('.ac-population');if(!node||!match)return;
 const v=cell!=null&&uid?placementPreview(own(),uid,cell):null;
 node.classList.toggle('ac-placement-preview',!!v);node.classList.toggle('invalid',!!v&&!v.legal);
 node.innerHTML=v?`${v.legal?'':'× '}${board(own()).length} → ${v.population} / ${own().level}${v.traits.filter(t=>t.level>t.wasLevel).map(t=>`<small>✦ ${t.id}</small>`).join('')}`:`${glyph('cards')}${board(own()).length} / ${own().level}`;
}
function previewOffer(slot){
 const id=own().shop[slot],c=UNITS[id];if(!c)return;const dialog=root().querySelector('#ac-preview');dialog.className='';
 const current=synergyDetails(board(own())),added=synergyDetails([...board(own()),{type:id}]);
 dialog.innerHTML=`<button class="quiet ac-preview-close" aria-label="关闭棋子预览">×</button><div class="ac-preview-art">${portrait(c.art)}</div><h2>${c.name}</h2><p>${c.race} · ${c.role}</p><small class="ac-stat-context">一星基础数值</small><div class="ac-numbers"><span>♥ ${c.hp}</span><span>⚔ ${c.attackValue}</span><span>射程 ${c.range}</span></div><div class="ac-range" aria-label="射程示意">${Array.from({length:81},(_,i)=>{const d=Math.max(Math.abs(i%9-4),Math.abs(Math.floor(i/9)-4));return `<i class="${d===0?'origin':d<=c.range?'within':''}">${d===0?'●':''}</i>`;}).join('')}</div><p class="ac-preview-skill">${esc(chessSkillText(c.id,s().version))}</p><div class="ac-preview-traits"><small>上阵${board(own()).length>=own().level?' · 需替换一枚':'后'}</small>${[c.race,c.role].map(id=>{const before=current.find(t=>t.id===id)?.count||0,after=added.find(t=>t.id===id);return after?`<span>${id} ${before} → ${after.count}${after.level>(current.find(t=>t.id===id)?.level||0)?' ✦ 激活':''}</span>`:'';}).join('')}</div><button id="ac-preview-buy" class="primary" ${watch||review||s().phase!=='prep'||own().gold<c.cost?'disabled':''}>招募 · ${c.cost} 金</button>`;
 dialog.querySelector('.ac-preview-close').onclick=()=>dialog.close();dialog.querySelector('#ac-preview-buy').onclick=()=>{dialog.close();apply({type:'buy',slot});};dialog.showModal();
}
function paintCombatEffects(battle,tick){
 const layer=root().querySelector('.ac-fx');if(!layer)return;
 const flash=(cell,label,kind)=>{const el=document.createElement('span');el.className='ac-float '+kind;el.style.left=(cell%8*12.5+6.25)+'%';el.style.top=(Math.floor(cell/8)*12.5+6.25)+'%';el.textContent=label;layer.append(el);setTimeout(()=>el.remove(),850);};
 for(let i=0;i<battle.frames.length;i++){
  const f=battle.frames[i];if(f.tick<=lastFxTick||f.tick>tick)continue;
  const previous=battle.frames[i-1]?.units||[],positions=new Map([...previous,...f.units].map(u=>[u.uid,u.cell]));
  const hits=new Map();for(const e of f.events||[]){const cell=positions.get(e.kind==='cast'?e.source:e.target);if(cell===undefined)continue;if(e.kind==='cast')flash(cell,'✦','cast');else if(e.kind==='hit'||e.kind==='heal'){const key=e.kind+'/'+cell;hits.set(key,{cell,kind:e.kind,amount:(hits.get(key)?.amount||0)+e.amount});}}
  for(const e of hits.values())flash(e.cell,(e.kind==='heal'?'+':'−')+e.amount,e.kind);
  for(const u of previous)if(!f.units.some(v=>v.uid===u.uid))flash(u.cell,'×','fallen');
 }
 lastFxTick=tick;
}

document.addEventListener('keydown',e=>{
 if(!active||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable=true],#ac-phase-pause')||root().querySelector('dialog[open]'))return;
 if(drag){if(e.key==='Escape'){e.preventDefault();abortDrag();}return;}
 if(e.code==='Space'&&s().phase==='prep'&&!review&&!watch&&!own().loot){e.preventDefault();shopOpen=!shopOpen;render();}
 else if(e.key==='Escape'){e.preventDefault();shopOpen=false;sideOpen=false;equipment=null;render();}
});
document.addEventListener('visibilitychange',()=>{
 if(!active||!match)return;
 if(document.hidden)abortDrag();
 if(s().phase==='battle'){if(document.hidden)played=Math.min(s().battle.ticks,played+(performance.now()-clock)/100*speed);clock=performance.now();}
 syncPhase();saveClock();if(!document.hidden){paintPhase();animateBattle();}
});
window.addEventListener('pagehide',()=>{phaseClock.suspend(true);save();});

export const chessMusicActive=()=>active&&match?.state.phase!=='ended'&&!phaseClock.paused;
