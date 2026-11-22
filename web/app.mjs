import {initArenaAudio,readAudioPreferences} from './arena-audio.mjs';
import {initGameScreen} from './game-screen.mjs';
import {localGameStorage as localStorage,sessionGameStorage as sessionStorage} from './storage.mjs';
import { begin, advance, seal, checkReplay, playback, GAMES, describeAction, pick } from '../src/arena.mjs';
import { snakeMoves, safeOptions } from '../src/snake.mjs';
import { planSnake, snakePlans } from '../src/snake-planner.mjs';
import { motor, HEIGHT, DIFFICULTIES, PONG_SKILLS } from '../src/pong.mjs';
import {createPongOpponent,pongOpponentInput} from '../src/pong-opponent.mjs';
import { openWindow } from '../src/decisions.mjs';
import { draw, geometry } from './board.mjs';
import {PONG_VIEWS,pongAxis,pongTarget,foodEvents} from './arcade-view.mjs';
import { openStrategy,closeStrategy,watchStrategy,updateStrategyProviders,strategyMusicActive } from './strategy-ui.mjs';

import {openChess,closeChess,watchChess,chessMusicActive} from './chess-ui.mjs';
import {openRescue,closeRescue,watchRescue,rescueNotice,rescueMusicActive} from './rescue-ui.mjs';
import {openKart,closeKart,watchKart,kartMusicActive} from './kart-ui.mjs';
import {openDance,closeDance,watchDance} from './dance-ui.mjs';
import {closeDance as closeClassicDance,watchDance as watchClassicDance} from './dance-classic-ui.mjs';
import {openRunner,closeRunner,watchRunner,runnerMusicActive} from './runner-ui.mjs';
import {createRunnerAudio} from './runner-audio.mjs';

const $=id=>document.getElementById(id), canvas=$('board');
const samples=JSON.parse($('samples').textContent);
const staticDemo=globalThis.ARENA_STATIC===true;
const sessions=new Map();
const labels={planner:'程序寻路',forage:'争食',cautious:'保留退路',pressure:'抢占近路',rule:'规则',search:'搜索',random:'随机',fixed:'守中',laya:'Laya',jev:'Jev',fallback:'规则接手',forced:'唯一安全路'};
const instructions={
  snake:['争食 · 避撞','方向键、WASD 或滑动棋盘转向。'],
  pong:['移动左拍回球，先得 7 分或限时内领先获胜。','拖动球拍、按住 ↑ ↓ 或 W S 移动。']
};
let game='snake',mode='ready',match,opponent='planner',cap={laya:false,jev:false,rooms:location.protocol.startsWith('http')&&!staticDemo},loaded=false;
let humanDir='right',humanY=300,keyY=0,tactic='steady',tacticEpoch=-1,edge=-1;
let prepared=null, gate=null, request=null, matchId='', nextAt=0, lastTime=0, remainder=0;
let lastPaint=null,movedAt=0,reader=null,replayData=null,replayCursor=0,items=[],lastHud='',audio=null;
let humanTrace=[],shotTrace=[];
let difficulty='easy',botY=300,trail=[],foodBursts=[],snakeQueue=[],pongQueue=[],pongBrain=createPongOpponent();
let pongView='bottom';try{const stored=localStorage.getItem('arena-pong-view');if(PONG_VIEWS.includes(stored))pongView=stored;}catch{}
let sound=readAudioPreferences().enabled,runnerAudio=null,effectsBus=null,soundSystem=null;const history={};const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const playing=()=>mode==='playing';
const replaying=()=>mode.startsWith('replay');
const snapshot=()=>match.state;
function say(msg){$('notice').textContent=msg;}
function beep(freq=480){
  if(!sound||!audio)return;
  const start=audio.currentTime,osc=audio.createOscillator(),vol=audio.createGain();
  osc.type='sine';osc.frequency.value=freq;vol.gain.setValueAtTime(.048,start);
  vol.gain.exponentialRampToValueAtTime(.001,start+.075);osc.connect(vol);vol.connect(effectsBus||audio.destination);osc.onended=()=>{osc.disconnect();vol.disconnect();};osc.start(start);osc.stop(start+.08);
}
window.addEventListener('glimmer-effect',e=>{if(e.detail.startsWith('runner-')){if(sound&&audio)(runnerAudio??=createRunnerAudio(audio,effectsBus)).cue(e.detail);return;}if(e.detail==='blast'){if(sound&&audio){const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(38,t+.16);g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(effectsBus);o.start(t);o.stop(t+.21);o.onended=()=>{o.disconnect();g.disconnect();};}return;}const frequencies={coin:820,cast:520,power:430,damage:170,heal:660,shield:780,block:260,freeze:880,buff:590,draw:360,silence:240,shot:125,rescue:720,infection:145,gate:320,victory:850};beep(frequencies[e.detail]||440);if(['heal','buff','cast','victory','rescue'].includes(e.detail))setTimeout(()=>beep((frequencies[e.detail]||440)*1.25),65);});
window.addEventListener('glimmer-runner-motion',e=>{if(sound&&audio)(runnerAudio??=createRunnerAudio(audio,effectsBus)).update(e.detail);else runnerAudio?.stop();});
function cancelDecision(){gate?.cancel();gate=null;prepared=null;request?.abort();request=null;}
function saveCurrent(){
  if(!match||replaying()||!match.record.frames.length)return;
  const rec=structuredClone(seal(match));history[game]=rec;
  try{localStorage.setItem('arena-round2-'+game,JSON.stringify(rec));}catch{}
}
function lastRecord(){
  if(history[game])return history[game];
  try{const raw=localStorage.getItem('arena-round2-'+game);if(raw){const rec=JSON.parse(raw);checkReplay(rec);history[game]=rec;return rec;}}catch{}
  return null;
}
function opponentMenu(preferModel=false){
  const menu=$('opponent'), choices=[['rule','规则对手',true],['random','随机对手',true]];

  if(game==='pong')choices.push(['fixed','固定守中',true]);
  if(game==='snake')choices.unshift(['planner','主动争食',true],['laya-plan','Laya 战术 + 寻路'+(cap.laya?'':'（需本机服务）'),cap.laya],['laya-guarded','Laya · 安全选路'+(cap.laya?'':'（需本机服务）'),cap.laya],
    ['laya','Laya · 自主选路'+(cap.laya?'':'（需本机服务）'),cap.laya],['jev','Jev'+(cap.jev?'':'（需配置密钥）'),cap.jev]);
  if(!choices.some(c=>c[0]===opponent&&c[2]))opponent='rule';
  if(preferModel&&cap.laya&&game==='snake'&&mode==='ready')opponent='laya-plan';
  menu.replaceChildren(...choices.map(([id,title,enabled])=>{
    const o=new Option(title,id);o.disabled=!enabled;return o;
  }));menu.value=opponent;
}
function reset({stash=true}={}){
  if(stash)saveCurrent();cancelDecision();
  if(stash&&game==='pong'&&match?.state.game==='pong'&&!(match.state.version>=3)){difficulty='easy';$('difficulty').value=difficulty;}
  let seed=Number($('seed').value);
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)seed=41003;
  $('seed').value=seed;match=begin(game,seed);matchId=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
  mode='ready';reader=null;replayData=null;items=[];lastPaint=null;humanDir='right';humanY=300;keyY=0;
  edge=-1;botY=300;trail=[];humanTrace=[];shotTrace=[];foodBursts=[];snakeQueue=[];pongQueue=[];pongBrain=createPongOpponent();tactic='steady';tacticEpoch=-1;remainder=0;say('');
  $('game-title').textContent=GAMES[game].name;$('objective').textContent=instructions[game][0];
  $('how').textContent=instructions[game][1];canvas.setAttribute('aria-label',GAMES[game].name+'棋盘');
  document.querySelectorAll('.game-tab').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.game===game)));
  $('pad').hidden=false;$('pong-level').hidden=game!=='pong';document.body.dataset.arcade=game;setPongView(pongView);
  $('sample').textContent=game==='snake'&&samples.laya?'观看 Laya 实测':'观看实测';
  refresh(true);paint();
}
function setPongView(value){
  pongView=PONG_VIEWS.includes(value)?value:'bottom';keyY=0;touch=null;
  $('pong-view').value=pongView;$('pong-view-controls').hidden=game!=='pong';canvas.dataset.pongView=pongView;
  canvas.classList.toggle('vertical-pong',game==='pong'&&['top','bottom'].includes(pongView));
  document.querySelectorAll('[data-key]').forEach(b=>{b.hidden=game==='pong'&&!pongAxis(pongView,b.dataset.key);});
  if(game==='pong'){$('objective').textContent='先得 7 分获胜';$('how').textContent=['top','bottom'].includes(pongView)?'左右拖动，或按 ← → / A D。':'上下拖动，或按 ↑ ↓ / W S。';}
  try{localStorage.setItem('arena-pong-view',pongView);}catch{}
}
function ate(before,after,now){
  if(before?.game===after.game&&after.tick>before.tick){
    if(after.game==='snake'){if(!humanTrace.length)humanTrace.push(before.bodies[0][0]);if(humanTrace.at(-1)!==after.bodies[0][0])humanTrace.push(after.bodies[0][0]);humanTrace=humanTrace.slice(-7);}
    if(after.game==='pong'){if(after.serve||after.lastHit?.tick!==before.lastHit?.tick)shotTrace=[];if(!after.serve)shotTrace.push(after.ball.slice(0,2));shotTrace=shotTrace.slice(-38);}
  }

  const events=foodEvents(before,after,now);foodBursts.push(...events);
  for(const e of events){const el=$('score'+e.actor);el.classList.remove('score-pop');void el.offsetWidth;el.classList.add('score-pop');el.title='吃到食物 +'+e.points;}
}
function paint(now=performance.now()){ 
  if(!canvas.clientWidth)return;
  foodBursts=foodBursts.filter(e=>now-e.at<800);canvas.dataset.foodBursts=foodBursts.length;
  draw(canvas,snapshot(),{selected:edge,previous:lastPaint,progress:reduced?1:Math.min(1,(now-movedAt)/135),view:pongView,effects:foodBursts,headTrace:humanTrace,shotTrace,now,reduced});
  paintPongSkills();
}
function queuePongSkill(skill){
 const s=snapshot();if(game!=='pong'||!playing()||s.version<3||s.serve||s.cooldowns[0][skill]>0)return;
 if(pongQueue.length<3&&!pongQueue.includes(skill))pongQueue.push(skill);
}
function paintPongSkills(){
 const s=snapshot(),modern=game==='pong'&&s.version>=3;$('pong-skills').hidden=!modern;if(!modern)return;
 for(const [id,spec]of Object.entries(PONG_SKILLS)){
  const b=$('pong-'+id),left=s.cooldowns[0][id],armed=s.armed[0]===id,active=id==='dash'&&s.dash[0]>0;
  b.disabled=!playing()||!!s.serve||left>0;b.setAttribute('aria-pressed',String(armed||active));b.style.setProperty('--ready',(1-left/spec.cooldown)*100+'%');
  b.querySelector('small').textContent=active?'冲刺中':armed?'下一拍触发':left>0?(left/60).toFixed(1)+' 秒':id==='dash'?'快速追球':id==='power'?'加速回击':'滑拍变弧线';
 }
 canvas.dataset.pongArmed=s.armed[0]||'';canvas.dataset.pongDash=String(s.dash[0]);canvas.dataset.pongShot=s.lastHit?.kind||'';canvas.dataset.pongCurve=String(s.curve);
}
function showEvents(){
  const list=$('events');list.replaceChildren(...items.slice(-3).reverse().map(ev=>{
    const li=document.createElement('li'),name=document.createElement('span'),time=document.createElement('span');
    name.textContent=(game==='pong'&&['upper','lower'].includes(ev.id)?({bottom:{upper:'压左侧',lower:'压右侧'},top:{upper:'压右侧',lower:'压左侧'},right:{upper:'压下侧',lower:'压上侧'},left:{upper:'压上侧',lower:'压下侧'}}[pongView][ev.id]):describeAction(game,ev.id))+(ev.strategy?' · '+(labels[ev.strategy]||ev.strategy):'');const src=labels[ev.source]||'记录';
    time.textContent=src+(['laya','jev','fallback'].includes(ev.source)?' '+Math.round(ev.ms||0)+' ms':'');
    li.append(name,time);return li;
  }));$('empty').hidden=items.length>0;
}
function refresh(force=false){
  const s=snapshot(), isReplay=replaying(), finished=mode==='finished'||mode==='replay-ended';
  const remaining=Math.max(0,Math.ceil((GAMES[game].max-s.tick)*GAMES[game].interval/1000-1e-8));
  const tag=[mode,game,...s.score,s.turn,remaining,items.length,opponent,difficulty].join('/');
  if(!force&&tag===lastHud)return;lastHud=tag;
  if(isReplay){
    const agent=replayData?.decisions.find(e=>e.source==='laya'||e.source==='jev');
    for(const i of [0,1])$('name'+i).textContent=agent?(agent.actor===i?labels[agent.source]:'规则'):(i===0?'青方':'橙方');
  }else{$('name0').textContent='你';$('name1').textContent=game==='pong'&&opponent==='rule'?({easy:'练习对手',normal:'标准对手',hard:'进阶对手'})[difficulty]:opponent==='laya-plan'?'混合对手':opponent.startsWith('laya')?'Laya':labels[opponent]||'对手';}
  $('score0').textContent=s.score[0];$('score1').textContent=s.score[1];
  $('timer').textContent=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  $('status').textContent=({ready:'待开局',paused:'已暂停',finished:'已结束',replay:'回放中','replay-paused':'回放暂停','replay-ended':'回放结束'})[mode]||
     '对局中';
  $('start').textContent=({ready:'开始',playing:'暂停',paused:'继续',finished:'再来一局',replay:'暂停回放','replay-paused':'继续回放','replay-ended':'开始'})[mode];
  $('restart').hidden=mode==='ready';$('seed').disabled=$('new-seed').disabled=$('opponent').disabled=mode!=='ready'&&!finished;
  $('restart').textContent=game==='pong'&&!(s.version>=3)?'技巧版 · 新开局':'重开';
  $('last').disabled=!history[game]&&!lastRecord();$('export').disabled=!(isReplay?replayData:match.record.frames.length);
  $('source').textContent=isReplay?'回放':items.length?(labels[items.at(-1).source]||''):'';
  $('result').hidden=!(finished||mode==='paused'||mode==='replay-paused');
  if(!$('result').hidden){
    const partial=finished&&s.winner===null;
    $('result-title').textContent=finished?(partial?'片段结束':s.winner===-1?'平局':$('name'+s.winner).textContent+'获胜'):'已暂停';
    $('result-reason').textContent=finished?(s.reason||'回放已播放完毕'):'';
  }
  $('rally').textContent=game==='pong'?'本次连击 '+s.rally+' · 最高 '+s.bestRally:'食物 '+s.score[0]+' : '+s.score[1];
  $('difficulty').disabled=mode==='playing';
  showEvents();
}
function note(ev){items.push(ev);match.record.decisions.push(ev);}
function prepareSnake(now){
  cancelDecision();const s=snapshot(),actor=1,base=planSnake(s,actor,'forage',trail).id;
  if(opponent==='planner'){prepared={id:base,source:'planner',ms:0};return;}
  if(opponent==='laya-plan'){
    const plans=snakePlans(s,actor,trail);
    if(plans.length===1){prepared={id:plans[0].move,strategy:plans[0].id,source:'planner',ms:0};return;}
    const w=openWindow({matchId,epoch:s.tick,actor,ids:plans.map(p=>p.id),fallback:plans[0].id,budget:Math.max(1,nextAt-performance.now())});
    gate={cancel:()=>w.cancel(),finish:()=>{const a=w.finish();if(!a)return null;const p=plans.find(p=>p.id===a.id)||plans[0];return {...a,id:p.move,strategy:p.id};}};
    request=new AbortController();
    fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},signal:request.signal,body:JSON.stringify({provider:'laya',planning:true,trail,tag:w.token,snapshot:{bodies:s.bodies,food:s.food,dirs:s.dirs,score:s.score,tick:s.tick}})}).then(async r=>{if(!r.ok)throw Error();const e=await r.json();w.offer(e.tag,e.answer);}).catch(e=>{if(e.name!=='AbortError')w.fail('offline');});return;
  }
  const guarded=opponent==='laya-guarded',ids=guarded?safeOptions(s,actor).map(o=>o.id):snakeMoves(s,actor);
  if(!['laya-guarded','laya','jev'].includes(opponent)||ids.length===1){
    const t=performance.now(),id=ids.length===1?ids[0]:pick(s,actor,opponent);
    prepared={id,source:ids.length===1?'forced':opponent,ms:performance.now()-t,candidates:ids};return;
  }
  const provider=opponent==='jev'?'jev':'laya';
  const w=openWindow({matchId,epoch:s.tick,actor,ids,fallback:base,budget:Math.max(1,nextAt-performance.now())});
  gate=w;request=new AbortController();
  const body={provider,guarded,tag:w.token,snapshot:{bodies:s.bodies,food:s.food,dirs:s.dirs}};
  fetch('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},
    signal:request.signal,body:JSON.stringify(body)}).then(async res=>{
      if(!res.ok)throw new Error('offline');
      const e=await res.json();w.offer(e.tag,{...e.answer,candidates:ids});
    }).catch(e=>{if(e.name!=='AbortError')w.fail('offline');});
}
function setTiming(){
  const now=performance.now();lastTime=now;remainder=0;
  nextAt=now+GAMES[game].interval;
  if(playing()&&game==='snake')prepareSnake(now);
}
function start(){
  if(mode==='replay'){mode='replay-paused';refresh(true);return;}
  if(mode==='replay-paused'){mode='replay';setTiming();refresh(true);return;}
  if(playing()){mode='paused';keyY=0;pongQueue=[];cancelDecision();refresh(true);paintPongSkills();return;}
  if(mode!=='paused')reset();
  mode='playing';setTiming();refresh(true);canvas.focus({preventScroll:true});
  if(innerWidth<=650)$('arcade').querySelector('.cabinet').scrollIntoView({block:'center',behavior:'instant'});
}
function after(action,now){
  const old=snapshot(),s=advance(match,action);lastPaint=old;movedAt=now;ate(old,s,now);
  if(s.score[0]!==old.score[0]||s.score[1]!==old.score[1])beep(600);
  else if(game==='pong'&&s.hits!==old.hits)beep(320);
  if(s.winner!==null){mode='finished';cancelDecision();saveCurrent();refresh(true);}
  return s;
}
function frame(now){
  if(playing()){
    if(game==='snake'&&now>=nextAt){
      const s=snapshot(),choice=prepared||gate?.finish()||{id:pick(s,1),source:'fallback',reason:'offline',ms:500};
      const ids=opponent==='laya-guarded'?safeOptions(s,1).map(o=>o.id):snakeMoves(s,1);
      note({tick:s.tick,actor:1,candidates:ids,...choice});cancelDecision();
      if(choice.source==='fallback')say(choice.reason==='timeout'?'模型本步超时，规则接手。':'模型本步未返回有效选择，规则接手。');
      else if(choice.source==='laya'||choice.source==='jev')say('');
      trail.push(s.bodies[1][0]);trail=trail.slice(-12);humanDir=snakeQueue.shift()||humanDir;after([humanDir,choice.id],now);
      if(playing()){nextAt=now+500;prepareSnake(now);}
    }else if(game==='pong'){
      remainder+=Math.min(now-lastTime,120);
      while(remainder>=1000/60&&playing()){
        const s=snapshot();
        if(!(s.version>=3)&&s.epoch!==tacticEpoch){
          tacticEpoch=s.epoch;tactic=pick(s,1,opponent);
          note({tick:s.tick,actor:1,id:tactic,source:opponent,ms:0});
        }
        if(keyY)humanY=Math.max(0,Math.min(600,s.paddles[0]+keyY*60));
        if(s.version>=3){
          botY=pongOpponentInput(s,pongBrain,{difficulty,policy:opponent});const observed=pongBrain.observedEpoch+'/'+pongBrain.phase;
          if(observed!==tacticEpoch){tacticEpoch=observed;note({tick:s.tick,actor:1,id:pongBrain.phase,source:opponent,ms:0});}
        }
        else if(s.tick%DIFFICULTIES[difficulty].reaction===0)botY=motor(s,1,tactic,difficulty);
        const skill=pongQueue.shift(),human=skill&&s.version>=3?{target:Math.round(humanY),skill}:Math.round(humanY);
        after([human,botY],now);remainder-=1000/60;
      }
    }
    paint(now);refresh();
  }else if(mode==='replay'){
    remainder+=Math.min(now-lastTime,160);
    const interval=GAMES[game].interval;
    while(remainder>=interval&&mode==='replay'){
      const step=reader.next();remainder-=interval;
      if(step.done){mode='replay-ended';refresh(true);break;}
      lastPaint=snapshot();movedAt=now;match.state=step.value;ate(lastPaint,step.value,now);
      while(replayCursor<replayData.decisions.length&&replayData.decisions[replayCursor].tick<match.state.tick)items.push(replayData.decisions[replayCursor++]);
    }
    paint(now);refresh();
  }
  if(!playing()&&mode!=='replay'&&foodBursts.length)paint(now);
  lastTime=now;requestAnimationFrame(frame);
}
function watch(record){humanTrace=[];shotTrace=[];
  if(['kart-1','kart-2','dance-1','rhythm-1','rhythm-2','runner-1','runner-2','runner-3'].includes(record?.format)){
    const play={'kart-1':watchKart,'kart-2':watchKart,'dance-1':watchClassicDance,'rhythm-1':watchDance,'rhythm-2':watchDance,'runner-1':watchRunner,'runner-2':watchRunner,'runner-3':watchRunner}[record.format];play(record);
    if(!['kart-1','kart-2'].includes(record.format))closeKart();if(record.format!=='dance-1')closeClassicDance();if(!['rhythm-1','rhythm-2'].includes(record.format))closeDance();if(!['runner-1','runner-2','runner-3'].includes(record.format))closeRunner();document.body.classList.add('motion-mode');
    stashArcade();cancelDecision();mode='paused';closeChess();closeStrategy();closeRescue();
    $('arcade').hidden=true;$('strategy').hidden=true;$('rescue').hidden=true;$('kart').hidden=record.game!=='kart';$('dance').hidden=record.game!=='dance';$('runner').hidden=record.game!=='runner';
    document.querySelectorAll('[data-game]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.game===record.game)));window.history.replaceState(null,'','#'+record.game);return;
  }
  closeKart();closeDance();closeClassicDance();closeRunner();$('kart').hidden=true;$('dance').hidden=true;$('runner').hidden=true;
  if(['rescue-1','rescue-2','rescue-3','rescue-4','rescue-5','rescue-6','rescue-7','rescue-8'].includes(record?.format)){watchRescue(record);saveCurrent();cancelDecision();mode='ready';closeChess();closeStrategy();$('arcade').hidden=true;$('strategy').hidden=true;$('rescue').hidden=false;document.querySelectorAll('[data-game]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.game==='rescue')));window.history.replaceState(null,'','#rescue');return;}
  closeRescue();$('rescue').hidden=true;
  if(['glimmer-1','glimmer-2','glimmer-3','glimmer-4'].includes(record?.format)){saveCurrent();cancelDecision();mode='ready';$('arcade').hidden=true;$('strategy').hidden=false;if(record.game==='chess'&&['glimmer-3','glimmer-4'].includes(record.format)){closeStrategy();watchChess(record);}else{closeChess();watchStrategy(record,cap);}document.querySelectorAll('[data-game]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.game===record.game)));window.history.replaceState(null,'','#'+record.game);return;}
  closeChess();closeStrategy();$('arcade').hidden=false;$('strategy').hidden=true;checkReplay(record);saveCurrent();cancelDecision();game=record.game;opponentMenu();reset({stash:false});
  replayData=record;reader=playback(record);match=begin(game,record.seed,record.opening,record.rules);replayCursor=0;
  $('seed').value=record.seed;mode='replay';setTiming();refresh(true);paint();
}
function control(dir){
  if(!playing())return;
  if(game==='snake'){const last=snakeQueue.at(-1)||snapshot().dirs[0],opposite={up:'down',down:'up',left:'right',right:'left'};if(dir!==last&&dir!==opposite[last]&&snakeQueue.length<2)snakeQueue.push(dir);}
  else if(game==='pong'){const axis=pongAxis(pongView,dir);if(axis)humanY=Math.max(0,Math.min(600,snapshot().paddles[0]+axis*75));}

}
function stashArcade(){
 if($('arcade').hidden||!match)return;
 pongQueue=[];if(playing()){mode='paused';keyY=0;cancelDecision();}
 if(mode==='replay')mode='replay-paused';
 saveCurrent();
 sessions.set(game,{match,mode,opponent,difficulty,humanDir,humanY,botY,pongBrain,tactic,tacticEpoch,trail:[...trail],snakeQueue:[...snakeQueue],items:[...items],reader,replayData,replayCursor,matchId});
 if(!replaying())try{localStorage.setItem('arena-session-'+game,JSON.stringify({record:seal(match),opponent,difficulty}));}catch{}
}
function restoreArcade(target){
 let saved=sessions.get(target);
 if(!saved)try{
  const value=JSON.parse(localStorage.getItem('arena-session-'+target));
  if(value?.record?.game===target){const state=checkReplay(value.record);saved={match:{state,record:value.record},mode:state.winner!==null?'finished':state.tick?'paused':'ready',opponent:value.opponent,difficulty:value.difficulty||'easy',humanDir:state.dirs?.[0]||'right',humanY:state.paddles?.[0]||300,botY:state.paddles?.[1]||300,pongBrain:createPongOpponent(),tactic:'steady',tacticEpoch:-1,trail:[],snakeQueue:[],items:value.record.decisions.slice(-3),reader:null,replayData:null,replayCursor:0,matchId:crypto.randomUUID()};}
 }catch{}
 game=target;opponent=saved?.opponent||(game==='snake'?'planner':'rule');
 reset({stash:false});
 if(saved){({match,mode,opponent,difficulty,humanDir,humanY,botY,pongBrain,tactic,tacticEpoch,trail,snakeQueue,items,reader,replayData,replayCursor,matchId}=saved);$('seed').value=match.state.seed;$('difficulty').value=difficulty;lastPaint=null;foodBursts=[];}
 opponentMenu();refresh(true);paint();
}
function navigate(target,updateURL=true,force=false){
 if(!['snake','pong','cards','chess','rescue','kart','dance','runner'].includes(target))target='snake';
 if(updateURL)window.history.replaceState(null,'','#'+target);
 const current=document.querySelector('[data-game][aria-pressed=true]')?.dataset.game;
 if(!force&&current===target&&((GAMES[target]&&!$('arcade').hidden)||!GAMES[target]))return;
 stashArcade();cancelDecision();mode='paused';closeRescue();closeStrategy();closeChess();closeKart();closeDance();closeClassicDance();closeRunner();
 $('arcade').hidden=!GAMES[target];$('strategy').hidden=!['cards','chess'].includes(target);$('rescue').hidden=target!=='rescue';
 $('kart').hidden=target!=='kart';$('dance').hidden=target!=='dance';$('runner').hidden=target!=='runner';
 if(GAMES[target])restoreArcade(target);
 else if(target==='runner')openRunner();else if(target==='kart')openKart();else if(target==='dance')openDance();else if(target==='rescue')openRescue();else if(target==='chess')openChess();else openStrategy('cards',cap);
 document.querySelectorAll('[data-game]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.game===target)));
 document.querySelector('[data-game="'+target+'"]').scrollIntoView({block:'nearest',inline:'nearest'});
}
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>navigate(b.dataset.game));
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1),false));
window.addEventListener('glimmer-dance-modern',()=>navigate('dance',true,true));
new ResizeObserver(()=>document.querySelector('[data-game][aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest'})).observe(document.querySelector('.switcher'));
window.addEventListener('pagehide',stashArcade);
$('pong-view').onchange=e=>{setPongView(e.target.value);refresh(true);paint();};
$('pong-rotate').onclick=()=>{setPongView(PONG_VIEWS[(PONG_VIEWS.indexOf(pongView)+1)%4]);refresh(true);paint();};
$('difficulty').onchange=e=>{difficulty=e.target.value;pongBrain=createPongOpponent();refresh(true);};
$('opponent').onchange=e=>{opponent=e.target.value;if(mode!=='ready')reset();refresh(true);};
$('new-seed').onclick=()=>{$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];reset();};
$('seed').onchange=()=>reset();$('start').onclick=start;$('restart').onclick=()=>reset();
function setSound(value){sound=value;if(!sound)runnerAudio?.stop();soundSystem?.setEnabled(value);}
$('sound').onclick=()=>setSound(!sound);
window.addEventListener('glimmer-sound',e=>{sound=e.detail;});
$('sample').onclick=()=>{const rec=game==='snake'&&samples.laya?samples.laya:samples[game];if(rec)watch(rec);};
$('last').onclick=()=>{const rec=lastRecord();if(rec)watch(rec);};
$('export').onclick=()=>{
  const rec=replaying()?replayData:seal(match),url=URL.createObjectURL(new Blob([JSON.stringify(rec)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=rec.game+'-'+rec.seed+'-'+rec.end.tick+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
$('import').onclick=()=>$('upload').click();
$('upload').onchange=async e=>{
  const f=e.target.files[0];try{if(!f||f.size>4_000_000)throw Error();watch(JSON.parse(await f.text()));}
  catch{say('无法读取此回放，请选择本轮导出的对局文件。');rescueNotice('无法读取此回放，请选择导出的对局文件。');const message=document.querySelector('#dance:not([hidden]) #rhythm-notice, #kart:not([hidden]) #kart-best, #runner:not([hidden]) #runner-best');if(message)message.textContent='无法读取此回放，请选择导出的对局文件。';}e.target.value='';
};
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
window.addEventListener('keydown',e=>{
  if(!playing()||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  const skill=game==='pong'?({ShiftLeft:'dash',ShiftRight:'dash',KeyJ:'power',KeyK:'spin'})[e.code]:null;
  if(skill){e.preventDefault();if(!e.repeat)queuePongSkill(skill);return;}
  if(keys[e.key]){e.preventDefault();control(keys[e.key]);if(game==='pong')keyY=pongAxis(pongView,keys[e.key]);}
});
window.addEventListener('keyup',e=>{if(keys[e.key]){if(game==='pong'&&keyY)humanY=snapshot().paddles[0];keyY=0;}});
document.querySelectorAll('[data-key]').forEach(b=>{
  b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);control(b.dataset.key);if(game==='pong')keyY=pongAxis(pongView,b.dataset.key);};
  b.onpointerup=b.onpointercancel=()=>{if(game==='pong'&&keyY)humanY=snapshot().paddles[0];keyY=0;};
  b.onclick=e=>{if(e.detail===0)control(b.dataset.key);};
});
for(const id of Object.keys(PONG_SKILLS)){
 const b=$('pong-'+id);b.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();queuePongSkill(id);};b.onclick=e=>{if(e.detail===0)queuePongSkill(id);};
}
let touch=null;
function point(e){const rect=canvas.getBoundingClientRect();return [e.clientX-rect.left,e.clientY-rect.top];}
function targetPong(x,y){const g=geometry(canvas,'pong',pongView);humanY=Math.round(pongTarget(pongView,(x-g.x)/g.scale,(y-g.y)/g.scale));keyY=0;}
canvas.onpointerdown=e=>{
  if(!playing())return;canvas.focus({preventScroll:true});const [x,y]=point(e);
  {canvas.setPointerCapture(e.pointerId);touch=[x,y];if(game==='pong')targetPong(x,y);}
};
canvas.onpointermove=e=>{
  const [x,y]=point(e);if(!playing())return;
  if(game==='pong'&&(touch||e.pointerType==='mouse'))targetPong(x,y);
};
canvas.onpointerup=e=>{
  if(touch&&game==='snake'){
    const [x,y]=point(e),dx=x-touch[0],dy=y-touch[1];
    if(Math.max(Math.abs(dx),Math.abs(dy))>10)control(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
  }
  touch=null;
};
canvas.onpointercancel=()=>{touch=null;keyY=0;};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(playing()||mode==='replay'))start();});
new ResizeObserver(()=>{if(match)paint();}).observe(canvas);
opponentMenu();restoreArcade('snake');requestAnimationFrame(frame);
if(['pong','cards','chess','rescue','kart','dance','runner'].includes(location.hash.slice(1)))document.querySelector('[data-game="'+location.hash.slice(1)+'"]').click();
if(location.protocol.startsWith('http')&&!staticDemo){
  fetch('/api/providers',{signal:AbortSignal.timeout(3500)}).then(r=>r.json()).then(v=>{
    if(!v.arena)return;cap={...v,rooms:true};loaded=true;updateStrategyProviders(cap);if(mode==='ready'){opponentMenu(true);refresh(true);}
  }).catch(()=>{});
}

window.addEventListener('glimmer-screen-pause',()=>{if(!$('arcade').hidden&&(playing()||mode==='replay')){mode=playing()?'paused':'replay-paused';keyY=0;pongQueue=[];cancelDecision();refresh(true);}});
initGameScreen();

soundSystem=initArenaAudio(()=>{const current=document.querySelector('.switcher [aria-pressed=true]')?.dataset.game||'snake';const states={cards:strategyMusicActive,chess:chessMusicActive,rescue:rescueMusicActive,kart:kartMusicActive,runner:runnerMusicActive};return {game:current,playing:states[current]?.()??(['snake','pong'].includes(current)&&(mode==='playing'||mode==='replay'))};},(context,bus)=>{audio=context;effectsBus=bus;});
