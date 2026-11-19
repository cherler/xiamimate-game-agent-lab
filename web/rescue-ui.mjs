import {localGameStorage as localStorage,sessionGameStorage as sessionStorage} from './storage.mjs';
import {beginRescue,issueRescue,advanceRescue,sealRescue,replayRescue,playbackRescue,rescueStats,rescueMap,UPGRADES,RESCUE_HZ,insideExit} from '../src/rescue.mjs';
import {drawRescue} from './rescue-board.mjs';
import {bindRescueInput} from './rescue-input.mjs';
const $=id=>document.getElementById(id),root=()=>$('rescue'),SAVE='glimmer-rescue-save',CAMPAIGN='glimmer-rescue-campaign';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const icons={mobility:'↗',fire:'✦',gate:'▥'};
let match,active=false,selected='all',building=false,support=null,hover=null,raf=0,last=0,acc=0,hudAt=-1,hudPhase='',resultKey='',soundId=-1,lastShot=0;
let watch=null,reader=null,replayPlaying=false,replayDone=false,speed=1;
let restoreNotice='';
let cancelInput=()=>{},selectionBox=null,movePreview=null,orderMarker=null,selectTool=false;
let campaign={unlocked:1,choices:[],medals:{}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function saveCampaign(){try{localStorage.setItem(CAMPAIGN,JSON.stringify(campaign));}catch{}}
function save(){if(!match||watch)return;try{localStorage.setItem(SAVE,JSON.stringify(sealRescue(match)));}catch{}}
function restore(){
 try{const c=JSON.parse(localStorage.getItem(CAMPAIGN));if(c&&Number.isInteger(c.unlocked)&&c.unlocked>=1&&c.unlocked<=3&&Array.isArray(c.choices)&&c.choices.length<=2&&c.choices.every(x=>UPGRADES[x])&&c.medals&&typeof c.medals==='object')campaign=c;}catch{}
 try{const r=JSON.parse(localStorage.getItem(SAVE));if(r){const state=replayRescue(r);match={state,record:{...r,end:null}};if(state.phase==='running')issueRescue(match,{type:'pause'});}}catch{try{const raw=localStorage.getItem(SAVE);if(raw){localStorage.setItem(SAVE+'-unreadable',raw);restoreNotice='上次行动未能恢复，已保留原记录。这次从部署重新开始。';}}catch{}}
}
function newMission(level=match?.state.level||1,difficulty=match?.state.difficulty||'normal'){
 cancelInput();orderMarker=null;selectTool=false;
 watch=null;reader=null;replayPlaying=false;replayDone=false;speed=1;
 match=beginRescue({level,seed:41003,difficulty,upgrades:campaign.choices.slice(0,level-1)});selected='all';building=false;support=null;hover=null;acc=0;resultKey='';soundId=-1;save();if(active)mount();
}
export function openRescue(){active=true;document.body.classList.add('rescue-mode');if(!match){restore();if(!match)newMission();}mount();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);}
export function closeRescue(){cancelInput();if(active&&match&&!watch&&match.state.phase==='running')issueRescue(match,{type:'pause'});save();active=false;replayPlaying=false;cancelAnimationFrame(raf);document.body.classList.remove('rescue-mode');}
export function rescueNotice(text){if(active&&$('rs-notice'))$('rs-notice').textContent=text;}
function command(a){if(watch)return false;try{issueRescue(match,a);rescueNotice('');if(a.type==='gate')building=false;if(['decoy','medic'].includes(a.type))support=null;save();hud(true);paint();return true;}catch(e){rescueNotice(e.message);return false;}}
function ids(){return match.state.soldiers.filter(u=>u.hp>0&&(selected==='all'||(Array.isArray(selected)?selected.includes(u.id):u.group===selected))).map(u=>u.id);}
function selectSquad(group){cancelInput();selected=group;building=false;support=null;selectTool=false;rescueNotice('');hud(true);paint();$('rescue-board')?.focus({preventScroll:true});}
function selectUnits(units){selected=units;building=false;support=null;rescueNotice('');hud(true);paint();}
function moveTo(p){const count=ids().length,ok=command({type:'move',ids:ids(),x:p.x,y:p.y});orderMarker={...p,ok,count,at:performance.now()};paint();}
function pause(){if(watch){replayPlaying=!replayPlaying;last=performance.now();hud(true);return;}const phase=match.state.phase;if(phase==='deploy')command({type:'start'});else if(phase==='running')command({type:'pause'});else if(phase==='paused')command({type:'resume'});last=performance.now();acc=0;}
function retreat(){const ex=rescueMap(match.state.level,match.state.version).exit;command({type:'move',ids:ids(),x:ex.x+ex.w/2,y:ex.y+ex.h/2});}
function mount(){
 cancelInput();selectTool=false;
 if(!active)return;resultKey='';const s=match.state,m=rescueMap(s.level,s.version);
 root().innerHTML=`<div class="rs-heading"><div><span class="rs-eyebrow">GLIMMER RESCUE</span><h1>微光救援</h1></div><div class="rs-missions" aria-label="救援关卡">${[1,2,3].map(i=>`<button data-mission="${i}" ${i>campaign.unlocked?'disabled':''} aria-current="${s.level===i?'step':'false'}"><b>${String(i).padStart(2,'0')}</b><span>${rescueMap(i).name}</span>${campaign.medals[i]?'✓':''}</button>`).join('')}</div><button id="rs-export" class="quiet">导出回放</button></div>
 <div class="rs-layout"><div class="rs-center"><div class="rs-map-head"><div><span id="rs-phase"></span><b>${esc(m.name)}</b></div><strong id="rs-timer">01:00</strong><button id="rs-start" class="primary">开始行动</button></div>
 <div class="rs-live-bar"><div id="rs-field-goals" aria-live="polite"></div><button id="rs-box-select" class="quiet" aria-pressed="false">框选</button><button id="rs-zoom" class="quiet" aria-pressed="false">放大地图</button></div><section id="rs-evac" class="rs-evac" aria-live="polite" ${s.version<3?'hidden':''}></section>${s.version>=4?'<div class="rs-callbar"><span id="rs-call-note"></span><button id="rs-call" class="primary">呼叫接驳</button></div>':''}${s.version<5&&!watch?'<div class="rs-legacy"><span>历史行动</span><button id="rs-modern" class="quiet">体验火力救援版</button></div>':''}<div class="rs-map-wrap"><canvas id="rescue-board" width="1200" height="800" tabindex="0" aria-label="救援地图：蓝色军队、黄色平民、红色丧尸，选择小队后点击地面下令"></canvas><div id="rs-pause" hidden><span>Ⅱ</span><b>战术暂停</b><small>可以继续布置指令</small></div></div>
 <div class="rs-legend"><span><i class="rs-blue"></i>军队</span><span><i class="rs-gold"></i>平民</span><span><i class="rs-pink"></i>丧尸</span><span><i class="rs-green"></i>撤离区</span><span id="rs-hint">选择小队 → 点地图部署</span></div>
 <div class="rs-control-status"><b id="rs-selected" role="status"></b><span>点选 · 拖框多选 · 点地面 / 右键移动</span></div><div class="rs-command-bar"><div class="rs-squads" role="group" aria-label="选择小队"><button data-squad="all" aria-pressed="true"><span class="rs-group-icon">◉◉</span><b>全队 <kbd>4</kbd></b><small id="rs-alive">5 人</small></button>${[0,1,2].map(i=>`<button data-squad="${i}" aria-pressed="false"><span class="rs-group-icon">${i===2?'◈':'●●'}</span><b>${i===2?'护卫 3':'步枪 '+(i+1)}</b><small>就绪</small><i class="rs-health"><i></i></i></button>`).join('')}</div><div class="rs-orders"><button id="rs-retreat"><span>↙</span>返回撤离区</button><button id="rs-hold"><span>⊙</span>原地防守</button><button id="rs-gate" aria-pressed="false"><span>▥</span>门障 <b>2</b></button></div></div>
 ${s.version>=4?`<div class="rs-supportbar"><span>战术补给 <b id="rs-supplies">${s.supplies}</b></span><button id="rs-decoy" aria-pressed="false"><b>◉ 诱饵信标</b><small>引开尸群 6 秒 · 用 1 份</small></button><button id="rs-medic" aria-pressed="false"><b>＋ 范围急救</b><small>队员恢复 55 · 用 1 份</small></button></div>`:''}<p id="rs-notice" role="status" aria-live="polite"></p><section id="rs-result" hidden aria-live="polite"></section></div>
 <aside class="rs-rail"><section class="rs-objective"><span class="rs-eyebrow">本关目标</span><h2>${s.version>=3?(m.mode==='hold'?'撤离平民 · 守住接驳':'撤离平民 · 清剿尸群'):(m.mode==='hold'?'保护平民 · 守住防线':'保护平民 · 清除感染')}</h2><div class="rs-goal"><strong id="rs-safe">${m.total}</strong><span>/ ${m.total} 人${s.version>=3?'已撤离':'存活'}<br><b>至少${s.version>=3?'撤离':'保住'} ${m.quota} 人</b></span></div><div id="rs-civilians" class="rs-people" aria-label="平民状态"></div><div class="rs-civil-count"><span>已撤离 <b id="rs-saved">0</b></span><span>跟随 <b id="rs-following">0</b></span><span ${s.version<3?'hidden':''}>集结 <b id="rs-boarding">0</b></span><span>感染 <b id="rs-lost">0</b></span></div><p class="rs-win-rule">${s.version>=3?'接应 → 集结 → 守住 '+m.extraction.seconds+' 秒'+(m.mode==='clear'?'，再清除全部尸群':'') :m.mode==='hold'?(s.version>=2?'全员撤离即可完成；也可坚持 '+m.seconds+' 秒或清除全部丧尸':'坚持 '+m.seconds+' 秒，或清除全部丧尸'):'在 '+m.seconds+' 秒内清除全部丧尸'}</p></section>
 <section class="rs-threat"><div><h2>感染潮</h2><span id="rs-wave">0 / ${m.waves.length}</span></div><div class="rs-wave-track">${m.waves.map((w,i)=>`<i data-wave="${i+1}" style="--at:${w.at/m.seconds*100}%" title="第 ${i+1} 波 · ${w.at} 秒"></i>`).join('')}<b id="rs-wave-progress"></b></div><div class="rs-threat-count"><span><b id="rs-enemies">0</b>场上丧尸</span><span><b id="rs-kills">0</b>已清除</span></div><p id="rs-next-wave"></p></section>
 <section class="rs-intel"><h2>战场动态</h2><ol id="rs-log"></ol></section><section class="rs-settings"><div id="rs-upgrades">${s.upgrades.map(id=>`<span title="${UPGRADES[id].text}">${icons[id]} ${UPGRADES[id].name}</span>`).join('')}</div><label>感染强度<select id="rs-difficulty" ${s.phase==='deploy'&&!watch?'':'disabled'}><option value="normal">标准 · 接触后可抢救</option><option value="challenge">险境 · 接触即感染</option></select></label><button id="rs-restart" class="quiet">重新部署本关</button><button id="rs-new-campaign" class="quiet">从第一关开始</button><div id="rs-replay-controls" ${watch?'':'hidden'}><label>回放速度<select id="rs-speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label><span id="rs-replay-status"></span></div></section></aside></div>`;
 root().querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>newMission(Number(b.dataset.mission)));
 root().querySelectorAll('[data-squad]').forEach(b=>b.onclick=()=>selectSquad(b.dataset.squad==='all'?'all':Number(b.dataset.squad)));
 if($('rs-call'))$('rs-call').onclick=()=>command({type:'evacuate'});
 for(const type of ['decoy','medic'])if($('rs-'+type))$('rs-'+type).onclick=()=>{support=support===type?null:type;building=false;rescueNotice(support?'点队员附近的地面使用'+(type==='decoy'?'诱饵':'急救'):'');hud(true);paint();};
 if($('rs-modern'))$('rs-modern').onclick=()=>newMission();
 $('rs-start').onclick=pause;$('rs-retreat').onclick=retreat;$('rs-hold').onclick=()=>command({type:'hold',ids:ids()});$('rs-gate').onclick=()=>{support=null;building=!building;hud(true);paint();};
 $('rs-export').onclick=exportReplay;$('rs-restart').textContent=watch?'回到行动':'重新部署本关';$('rs-restart').onclick=()=>{if(watch){watch=null;reader=null;replayPlaying=false;replayDone=false;match=null;restore();if(!match)newMission(1);else mount();}else newMission();};$('rs-new-campaign').onclick=()=>{campaign={unlocked:1,choices:[],medals:{}};saveCampaign();newMission(1);};
 $('rs-difficulty').value=s.difficulty;$('rs-difficulty').onchange=e=>newMission(s.level,e.target.value);$('rs-speed').value=String(speed);$('rs-speed').onchange=e=>{speed=Number(e.target.value);};
 const canvas=$('rescue-board'),wrap=canvas.parentElement;
 $('rs-box-select').onclick=()=>{cancelInput();selectTool=!selectTool;building=false;support=null;hud(true);paint();};
 $('rs-zoom').onclick=()=>{cancelInput();const zoomed=wrap.classList.toggle('rs-zoomed');$('rs-zoom').setAttribute('aria-pressed',String(zoomed));$('rs-zoom').textContent=zoomed?'缩小地图':'放大地图';if(zoomed){const units=match.state.soldiers.filter(u=>ids().includes(u.id));const x=units.reduce((n,u)=>n+u.x,0)/Math.max(1,units.length),y=units.reduce((n,u)=>n+u.y,0)/Math.max(1,units.length);wrap.scrollLeft=canvas.clientWidth*x/24-wrap.clientWidth/2;wrap.scrollTop=canvas.clientHeight*y/16-wrap.clientHeight/2;}paint();};
 function placeAt(p){
  if(watch||match.state.phase==='ended')return;
  if(building){const radius=Math.max(.85,22*24/canvas.getBoundingClientRect().width),door=[...m.doors].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(door&&Math.hypot(door.x-p.x,door.y-p.y)<radius)command({type:'gate',door:door.id});else rescueNotice('点亮起的门口部署门障');return;}
  if(support){command({type:support,x:p.x,y:p.y});return;}
 }
 cancelInput=bindRescueInput(canvas,{state:()=>({...match.state,interactive:!watch&&match.state.phase!=='ended'}),selected:ids,select:selectUnits,move:moveTo,place:placeAt,placing:()=>building||support,boxMode:()=>selectTool,boxDone:()=>{selectTool=false;hud(true);},cancelPlacement:()=>{building=false;support=null;hud(true);paint();},visual:v=>{hover=v?.hover||null;selectionBox=v?.box||null;movePreview=v?.move||null;paint();}});
 hud(true);paint();if(restoreNotice){rescueNotice(restoreNotice);restoreNotice='';}
}
function hud(force=false){
 if(!active||!match)return;const s=match.state;if(!force&&s.phase===hudPhase&&s.tick-hudAt<6)return;hudAt=s.tick;hudPhase=s.phase;const m=rescueMap(s.level,s.version),st=rescueStats(s);
 $('rs-phase').textContent=watch?'回放':({deploy:'部署中',running:'行动中',paused:'已暂停',ended:s.winner?'救援成功':'行动结束'})[s.phase];
 const selectedCount=ids().length;$('rs-selected').textContent=watch?'行动回放':selectedCount?'已选 '+selectedCount+' 人'+(selected==='all'?' · 全队':typeof selected==='number'?' · '+(selected===2?'护卫队':'步枪 '+(selected+1)+' 队'):''):'未选中队员';
 $('rs-box-select').setAttribute('aria-pressed',String(selectTool));$('rs-box-select').disabled=!!watch||s.phase==='ended';
 $('rs-timer').textContent=String(Math.floor(st.remaining/60)).padStart(2,'0')+':'+String(st.remaining%60).padStart(2,'0');$('rs-timer').classList.toggle('urgent',st.remaining<=15);
 $('rs-start').textContent=watch?(replayDone?'回放结束':replayPlaying?'暂停回放':'继续回放'):({deploy:'▶ 开始行动',running:'Ⅱ 暂停',paused:'▶ 继续行动',ended:s.winner?'✓ 行动完成':'行动结束'})[s.phase];$('rs-start').disabled=watch?replayDone:s.phase==='ended';
 $('rs-pause').hidden=watch?!(!replayPlaying&&!replayDone):s.phase!=='paused';
 $('rs-safe').textContent=s.version>=3?st.saved:st.safe;$('rs-safe').classList.toggle('danger',st.safe<=m.quota);$('rs-saved').textContent=st.saved;$('rs-following').textContent=st.following;$('rs-boarding').textContent=st.boarding;$('rs-lost').textContent=st.lost;$('rs-alive').textContent=st.alive+' 人';
 $('rs-civilians').innerHTML=s.civilians.map(c=>`<i class="${c.status} ${c.infection?'threatened':''}" title="${({waiting:'等待接应',following:'跟随小队',boarding:'等待接驳，仍需保护',saved:'安全撤离',infected:'已感染'})[c.status]}">${c.status==='saved'?'✓':c.status==='infected'?'×':''}</i>`).join('');
 $('rs-enemies').textContent=st.enemies;$('rs-kills').textContent=s.kills;$('rs-wave').textContent=s.wave+' / '+m.waves.length;
 $('rs-wave-progress').style.width=Math.min(100,s.tick/(m.seconds*RESCUE_HZ)*100)+'%';root().querySelectorAll('[data-wave]').forEach(i=>i.classList.toggle('past',Number(i.dataset.wave)<=s.wave));
 const next=s.schedule[s.spawned],count=next?s.schedule.slice(s.spawned).filter(w=>w.wave===next.wave).length:0;$('rs-next-wave').textContent=next?`${m.entrances[next.entry].name} · ${count} 只 · ${Math.max(0,Math.ceil((next.tick-s.tick)/RESCUE_HZ))} 秒后进入`:'全部丧尸已入场';
 $('rs-field-goals').innerHTML=`<span class="${st.saved===m.total?'complete':''}">${st.saved===m.total?'✓':'↙'} 撤离 ${st.saved}/${m.total}</span><span class="${m.mode==='clear'?'clear-goal':''}">${m.mode==='clear'?'◎ 清剿剩余 '+(st.enemies+st.pending):next?'下一波 '+Math.max(0,Math.ceil((next.tick-s.tick)/30))+' 秒':'守住防线'}${m.mode==='clear'&&st.pending?' · 待入场 '+st.pending:''}</span>`;
 $('rs-log').innerHTML=s.log.slice(-4).reverse().map(e=>`<li class="${e.kind}"><time>${String(Math.floor(e.tick/30/60)).padStart(2,'0')}:${String(Math.floor(e.tick/30)%60).padStart(2,'0')}</time>${esc(e.text)}</li>`).join('');
 root().querySelectorAll('[data-squad]').forEach(b=>{const group=b.dataset.squad==='all'?'all':Number(b.dataset.squad),units=s.soldiers.filter(u=>group==='all'||u.group===group),alive=units.filter(u=>u.hp>0);const chosen=ids(),complete=alive.length>0&&alive.every(u=>chosen.includes(u.id));b.setAttribute('aria-pressed',String(complete));b.classList.toggle('part-selected',!complete&&alive.some(u=>chosen.includes(u.id)));b.disabled=!alive.length||!!watch||s.phase==='ended';if(group!=='all'){b.querySelector('small').textContent=!alive.length?'已倒下':alive.some(u=>u.reload)?'换弹中':alive.some(u=>u.path.length)?'行进中':s.phase==='deploy'?'待命':'防守中';b.querySelector('.rs-health i').style.width=units.reduce((n,u)=>n+u.hp,0)/units.reduce((n,u)=>n+u.maxHp,0)*100+'%';}});
 $('rs-gate').setAttribute('aria-pressed',String(building));$('rs-gate').querySelector('b').textContent=s.gateCharges;
 for(const id of ['rs-retreat','rs-hold','rs-gate'])$(id).disabled=!!watch||s.phase==='ended'||(id==='rs-gate'?s.gateCharges===0:ids().length===0);
 $('rs-hint').textContent=watch?'行动回放':support?'点队员 4 格内的地面 · 共享战术补给':building?'点亮起的门口，放置门障':s.phase==='deploy'?(s.version>=2?'绿色接应区内调整小队，开始后出发':'选择小队 → 点地图部署'):s.phase==='ended'?'行动结算':s.evac?.phase==='gathering'?'可以先布置防线，再呼叫接驳':s.evac?.phase==='contested'?'清除撤离区附近丧尸，继续读秒':s.evac?.phase==='unguarded'?'留下队员守卫撤离区':s.evac?.phase==='loading'?'保住撤离区，门障可拖慢尸潮':'选择小队 → 点地面移动 · 接近平民自动接应';
 $('rs-difficulty').disabled=s.phase!=='deploy'||!!watch;$('rs-replay-status').textContent=watch?(replayDone?'已校验的回放':'回放中 · 不可下令'):'';
 if(s.version>=3){
  const e=s.evac,remaining=Math.ceil((e.required-e.progress)/30),raging=st.raging&&s.winner===null,alarm=e.alertTick!==null&&s.tick<e.alertTick;
  const status=({idle:'接应平民 → 撤离区集结',gathering:'平民已集结 · 选择时机呼叫',called:'呼叫已发出 · 准备守住阵地',waiting:'等待平民返回集结',loading:'正在接驳 · 守住阵地',contested:'敌人逼近 · 读秒暂停',unguarded:'缺少护卫 · 读秒暂停',complete:'接驳完成'})[e.phase];
  const box=$('rs-evac');box.dataset.phase=e.phase;box.className='rs-evac '+e.phase+(raging?' raging':'');
  box.innerHTML=`<div class="rs-evac-dial" style="--progress:${e.progress/e.required*100}%"><b>${e.phase==='complete'?'✓':remaining}</b><small>${e.phase==='complete'?'已撤离':'秒'}</small></div><div class="rs-evac-info"><strong>${status}</strong><span>${st.boarding?st.boarding+' 人等待撤离':'至少撤离 '+m.quota+' 人'}${e.phase==='idle'?(s.version>=4?' · 集结后自主呼叫':' · 进入后呼叫接驳'):''}</span><div class="rs-evac-track" role="progressbar" aria-label="撤离接驳进度" aria-valuemin="0" aria-valuemax="${e.required}" aria-valuenow="${e.progress}"><i style="width:${e.progress/e.required*100}%"></i></div></div><b class="rs-rage-label">${alarm?'⚠ 尸潮 '+Math.ceil((e.alertTick-s.tick)/30)+' 秒后突入':raging?'▲ 尸潮狂暴':e.phase==='complete'?'✓ 已登车':'↙ 集结点'}</b>`;
 }
 if(s.version>=4){
  const e=s.evac,canCall=e.phase==='gathering'&&s.soldiers.some(u=>u.hp>0&&insideExit(m,u));
  $('rs-call').disabled=!!watch||s.phase==='deploy'||s.phase==='ended'||!canCall;$('rs-call').textContent=e.phase==='called'?'已呼叫':e.active?'接驳进行中':e.phase==='complete'?'撤离完成':'呼叫接驳';
  $('rs-call-note').textContent=e.phase==='gathering'?st.boarding+' 人就位 · 呼叫将引来尸潮':e.phase==='idle'?'接应平民，回到绿色撤离区':e.phase==='complete'?(m.mode==='clear'?'继续清剿剩余尸群':'平民已安全撤离'):s.phase==='paused'?'战术暂停 · 可以布置防线':'守住撤离区，保留一名队员掩护';
  $('rs-supplies').textContent=s.supplies;for(const type of ['decoy','medic']){const b=$('rs-'+type);b.disabled=!!watch||!['running','paused'].includes(s.phase)||s.supplies<1;b.setAttribute('aria-pressed',String(support===type));}
 }
 showResult();
}
function showResult(){
 const s=match.state,key=(s.phase==='ended'?'ended':'other')+'/'+s.level+'/'+!!watch+'/'+campaign.choices.length;if(key===resultKey)return;resultKey=key;const panel=$('rs-result');panel.hidden=s.phase!=='ended';if(panel.hidden)return;
 const m=rescueMap(s.level,s.version),allSaved=s.saved===m.total,allAlive=s.soldiers.every(u=>u.hp>0);
 if(s.winner&&!watch){const old=campaign.medals[s.level]||{};campaign.medals[s.level]={allSaved:old.allSaved||allSaved,allAlive:old.allAlive||allAlive};saveCampaign();}
 const needUpgrade=s.winner&&!watch&&s.level<3&&!campaign.choices[s.level-1];
 panel.innerHTML=`<div class="rs-result-heading"><span>${s.winner?'✦':'◇'}</span><div><h2>${s.winner?'救援成功':s.reason==='清剿时间耗尽'?'清剿未完成':'救援未完成'}</h2><p>${esc(s.reason)} · 保住 ${m.total-s.lost} 人，撤离 ${s.saved} 人</p></div></div><div class="rs-medals">${allSaved?'<span>✧ 全员撤离</span>':''}${allAlive?'<span>✧ 小队无伤亡</span>':''}</div>${watch?'<p>行动回放结束</p>':needUpgrade?`<h3>带一项升级进入下一关</h3><div class="rs-upgrade-choices">${Object.entries(UPGRADES).map(([id,u])=>`<button data-upgrade="${id}"><i>${icons[id]}</i><b>${u.name}</b><small>${u.text}</small></button>`).join('')}</div>`:`<button id="rs-next" class="primary">${s.winner&&s.level<3?'下一关 →':s.winner?'三关完成 · 再挑战':'重新部署'}</button>`}`;
 panel.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>{campaign.choices[s.level-1]=b.dataset.upgrade;campaign.unlocked=Math.max(campaign.unlocked,s.level+1);saveCampaign();newMission(s.level+1);});
 if($('rs-next'))$('rs-next').onclick=()=>newMission(s.winner&&s.level<3?s.level+1:s.winner?1:s.level);
 queueMicrotask(()=>{if(active&&panel.isConnected)panel.scrollIntoView({block:'nearest',behavior:reduced?'auto':'smooth'});});
 if(!watch)save();
}
function paint(){if(active&&match&&$('rescue-board'))drawRescue($('rescue-board'),match.state,{selectedIds:ids(),building,support,hover,reduced,selectionBox,movePreview,orderMarker:orderMarker&&performance.now()-orderMarker.at<1600?orderMarker:null});}
function sounds(){const s=match.state;for(const e of s.events){if(e.id<=soundId)continue;soundId=e.id;let kind=({rescue:'rescue',infection:'infection',build:'gate',victory:'victory',fallen:'damage',evacAlarm:'damage',evacComplete:'rescue',medic:'heal',supply:'rescue',decoy:'gate'})[e.kind];if(e.kind==='shot'&&s.tick-lastShot>=7){lastShot=s.tick;kind='shot';}if(kind)window.dispatchEvent(new CustomEvent('glimmer-effect',{detail:kind}));}}
function frame(now){
 if(!active)return;acc+=Math.min(now-last,120)*(watch?speed:1);last=now;
 try{while(acc>=1000/RESCUE_HZ){acc-=1000/RESCUE_HZ;
  if(watch){if(replayPlaying&&!replayDone){const next=reader.next();if(next.done){replayDone=true;replayPlaying=false;hud(true);}else match.state=next.value;}}
  else if(match.state.phase==='running'){advanceRescue(match);if(match.state.tick%150===0||match.state.phase==='ended')save();}
 }}catch(e){replayPlaying=false;replayDone=true;rescueNotice(e.message);}
 sounds();hud();paint();raf=requestAnimationFrame(frame);
}
function exportReplay(){const r=watch||sealRescue(match),url=URL.createObjectURL(new Blob([JSON.stringify(r)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`glimmer-rescue-${r.config.level}-${r.config.seed}-${r.end.tick}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function watchRescue(record){replayRescue(record);closeRescue();watch=structuredClone(record);reader=playbackRescue(watch);match=beginRescue(record.config);match.state=reader.next().value;active=true;replayPlaying=true;replayDone=false;selected='all';building=false;support=null;acc=0;speed=1;soundId=-1;document.body.classList.add('rescue-mode');mount();last=performance.now();raf=requestAnimationFrame(frame);}
window.addEventListener('keydown',e=>{if(!active||e.repeat||e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(e.code==='Space'&&document.activeElement?.tagName!=='BUTTON'){e.preventDefault();pause();}else if(['1','2','3','4'].includes(e.key)&&!watch){e.preventDefault();selectSquad(e.key==='4'?'all':Number(e.key)-1);}else if(e.key==='Escape'){cancelInput();building=false;support=null;selectTool=false;hud(true);paint();}else if(e.key.toLowerCase()==='r'&&!watch)retreat();});
window.addEventListener('blur',()=>{if(active)cancelInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active){cancelInput();if(watch)replayPlaying=false;else if(match.state.phase==='running')command({type:'pause'});save();hud(true);}});
window.addEventListener('pagehide',()=>{if(active){if(!watch&&match.state.phase==='running')issueRescue(match,{type:'pause'});save();}});
