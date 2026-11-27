import {localGameStorage as storage} from './storage.mjs';
import {loadMusic} from './music-assets.mjs';
import {MusicPlayer} from './music-player.mjs';
export const GAME_MUSIC={ink:{id:'raspberry',name:'Raspberry Jam',mood:'轻快涂地',gain:.62},snake:{id:'xiami',name:'虾米的奇妙日常',mood:'木琴 · 拨弦',gain:.66},pong:{id:'raspberry',name:'Raspberry Jam',mood:'轻快律动',gain:.65},cards:{id:'calm',name:'Calm Theme',mood:'安静思考',gain:.5},chess:{id:'street',name:'My Street',mood:'轻松布阵',gain:.55},rescue:{id:'siege',name:'破晓救援',mood:'MiniMax · 弦乐与电子节拍',gain:.9},kart:{id:'raceway',name:'Pure Raceway',mood:'竞速电子',gain:.75},runner:{id:'skyline',name:'Sky Blue Street',mood:'城市疾跑',gain:1}};
export function readAudioPreferences(){try{const p=JSON.parse(storage.getItem('arena-audio-v1'));if(p)return {enabled:p.enabled!==false,music:Number.isFinite(p.music)?Math.max(0,Math.min(1,p.music)):.55,effects:Number.isFinite(p.effects)?Math.max(0,Math.min(1,p.effects)):.8};}catch{}return {enabled:true,music:.55,effects:.8};}
export function initArenaAudio(scene,onContext){
 let prefs=readAudioPreferences(),context,player,effects,unlocked=false,lastError='',lastStatus='';
 const dialog=document.createElement('dialog');dialog.id='audio-settings';dialog.setAttribute('aria-label','音乐与音效');dialog.innerHTML=`<header><h2>音乐与音效</h2><button id="audio-close" aria-label="关闭音乐设置">×</button></header><p id="audio-track"></p><button id="audio-enabled" class="quiet"></button><label for="audio-music">背景音乐 <output id="audio-music-value"></output></label><input id="audio-music" type="range" min="0" max="100" step="5"><label for="audio-effects">操作音效 <output id="audio-effects-value"></output></label><input id="audio-effects" type="range" min="0" max="100" step="5"><button id="audio-retry" class="quiet" hidden>音乐未能加载，点这里重试</button><details><summary>音乐来源</summary><p>破晓救援：本次调用 MiniMax Music 3.0 新生成的无人声配乐。虾米的奇妙日常：复用你已有的 MiniMax 配乐。</p><p>开放曲目（CC0）：<a href="https://opengameart.org/content/my-street" target="_blank" rel="noopener">My Street</a>、<a href="https://opengameart.org/content/raspberry-jam" target="_blank" rel="noopener">Raspberry Jam</a> — congusbongus；<a href="https://opengameart.org/content/pure-raceway" target="_blank" rel="noopener">Pure Raceway</a>、<a href="https://opengameart.org/node/170985" target="_blank" rel="noopener">Sky Blue Street</a> — MintoDog；<a href="https://opengameart.org/content/calm-music-0" target="_blank" rel="noopener">Calm Theme</a> — pebonius。</p><p>舞台另有四首本地合成曲。音乐只在开始操作后播放。</p></details>`;document.body.append(dialog);
 const $=id=>dialog.querySelector('#audio-'+id);
 const announce=()=>{window.dispatchEvent(new CustomEvent('glimmer-sound',{detail:prefs.enabled}));window.dispatchEvent(new CustomEvent('glimmer-music-volume',{detail:prefs.music}));const button=document.getElementById('sound');button.setAttribute('aria-pressed',String(prefs.enabled));button.textContent=prefs.enabled?'声音开':'声音关';};
 function refresh(){const current=scene(),track=GAME_MUSIC[current.game],status=current.game==='dance'?'微光舞台 · 跟随所选歌曲':track?track.name+' · '+track.mood:'';if(status!==lastStatus){$('track').textContent=status;lastStatus=status;}$('enabled').textContent=prefs.enabled?'声音已开启':'声音已关闭';$('enabled').setAttribute('aria-pressed',String(prefs.enabled));for(const key of ['music','effects']){$(key).value=Math.round(prefs[key]*100);$(key+'-value').textContent=Math.round(prefs[key]*100)+'%';}if(lastError!==player?.error){lastError=player?.error;$('retry').hidden=!lastError;}}
 function sync(){const current=scene(),blocked=document.hidden||document.body.classList.contains('screen-settings-open')||document.getElementById('screen-games')?.hidden===false,track=GAME_MUSIC[current.game];if(player){player.volume(prefs.enabled?prefs.music*(track?.gain||.65):0);effects.gain.setTargetAtTime(prefs.enabled?prefs.effects:0,context.currentTime,.015);const id=unlocked&&prefs.enabled&&prefs.music>0&&!blocked&&current.playing?track?.id:null;void player.play(id||null);}if(dialog.open)refresh();
  const state=!prefs.enabled||prefs.music===0?'muted':player?.error&&player.id===track?.id?'error':!unlocked||context?.state!=='running'?'locked':!current.playing?'ready':player?.source?'playing':'loading';
  for(const b of document.querySelectorAll('[data-music-status]')){const label={muted:'♫ 开启音乐',error:'♫ 重试音乐',locked:'♫ 点按播放',ready:'♫ 音乐已就绪',playing:'♫ 音乐开',loading:'♫ 加载音乐…'}[state];if(b.textContent!==label)b.textContent=label;b.dataset.state=state;b.setAttribute('aria-pressed',String(state==='playing'));b.title=track?.name||'背景音乐';}
 }

 async function unlock(){if(!prefs.enabled)return;try{if(!context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;context=new Audio({latencyHint:'interactive'});player=new MusicPlayer(context,(ctx,id)=>loadMusic(ctx,id,{shared:false}));effects=context.createGain();effects.gain.value=prefs.effects;effects.connect(context.destination);onContext(context,effects);}await context.resume();unlocked=context.state==='running';
 const track=GAME_MUSIC[scene().game];if(track&&prefs.music>0&&!player.error)void player.prepare(track.id).catch(()=>{});sync();}catch{/* Another deliberate gesture can resume a browser-suspended context. */}}
 function update(values){prefs={...prefs,...values};try{storage.setItem('arena-audio-v1',JSON.stringify(prefs));}catch{}announce();sync();refresh();}
 function open(){dialog.showModal();refresh();}
 const button=document.createElement('button');button.id='audio-open';button.className='quiet';button.textContent='音乐';button.onclick=open;document.querySelector('.head-actions').append(button);
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-audio-settings]'))open();
  const b=e.target.closest('[data-music-status]');if(!b)return;
  if(!prefs.enabled||prefs.music===0)update({enabled:true,music:prefs.music||.55});
  else if(b.dataset.state==='playing')update({music:0});
  if(player?.error)player.stop();void unlock();
 });
 $('close').onclick=()=>dialog.close();$('enabled').onclick=()=>{update({enabled:!prefs.enabled});void unlock();};$('retry').onclick=()=>{player?.stop();void unlock();};
 for(const key of ['music','effects'])$(key).oninput=e=>{update({[key]:Number(e.target.value)/100});void unlock();};
 // Touch browsers may grant audio activation at release/click rather than pointerdown.
 for(const name of ['pointerdown','pointerup','touchend','click'])document.addEventListener(name,unlock,{capture:true,passive:true});document.addEventListener('keydown',e=>{if(!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey)void unlock();},{capture:true});
 // Follow controller state, including imported replays, without guessing from button captions.
 setInterval(sync,120);document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',()=>player?.stop());window.addEventListener('glimmer-enable-sound',unlock);
 dialog.addEventListener('keydown',e=>e.stopPropagation());announce();refresh();
 return {setEnabled(value){update({enabled:value});if(value)void unlock();},sync};
}
