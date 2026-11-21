// Mobile play uses the same live controls; settings stay in their game root so
// rendering, disabled states, saved choices and replay handlers remain intact.
const names={snake:'双蛇争食',pong:'乒乓球',cards:'微光牌局',chess:'微光棋阵',rescue:'微光救援',kart:'微光漂移',dance:'微光舞台',runner:'微光疾行'};
const preferred={snake:'portrait',pong:'portrait',cards:'portrait',chess:'landscape',rescue:'landscape',kart:'landscape',dance:'landscape',runner:'portrait'};
const roots={snake:'arcade',pong:'arcade',cards:'strategy',chess:'strategy',rescue:'rescue',kart:'kart',dance:'dance',runner:'runner'};
const pauseIds={snake:'start',pong:'start',kart:'kart-pause',dance:'rhythm-pause',runner:'runner-pause',rescue:'rs-start',chess:'ac-phase-pause'};
const panelSelectors={snake:'.rail',pong:'.rail',kart:'.motion-options',dance:'.motion-options',runner:'.motion-options',rescue:'.rs-rail',cards:'.card-topbar',chess:'.ac-screen-settings'};
let current='snake',windowed=false,forced=false,menu=false,lobby=false,owner=false,requesting=false,rootObserver,buttonObserver,lastOrientation='',focusReturn=null;
const $=id=>document.getElementById(id),small=()=>matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1200px)').matches;
const fullscreen=()=>document.fullscreenElement||document.webkitFullscreenElement;
const gameRoot=()=>$(roots[current]);
function pauseGame(){window.dispatchEvent(new Event('glimmer-screen-pause'));if(current==='chess'){const b=$('ac-phase-pause');if(b&&!b.disabled&&b.getAttribute('aria-pressed')!=='true')b.click();}}
function panel(){return gameRoot()?.querySelector(panelSelectors[current]||'not-an-element');}
function closePanels(){menu=false;lobby=false;document.body.classList.remove('screen-settings-open');$('screen-games').hidden=true;$('screen-shade').hidden=true;$('screen-settings-head').hidden=true;document.querySelectorAll('[data-screen-settings]').forEach(n=>{n.removeAttribute('role');n.removeAttribute('aria-modal');});$('screen-menu').setAttribute('aria-expanded','false');$('screen-games-toggle').setAttribute('aria-expanded','false');if(focusReturn?.isConnected)focusReturn.focus({preventScroll:true});}
function settings(){
 if(menu){closePanels();return;}closePanels();pauseGame();focusReturn=$('screen-menu');
 menu=true;document.body.classList.add('screen-settings-open');$('screen-settings-head').hidden=false;$('screen-shade').hidden=false;$('screen-menu').setAttribute('aria-expanded','true');tagPanel();$('screen-settings-close').focus();
}
function games(){if(lobby){closePanels();return;}closePanels();pauseGame();focusReturn=$('screen-games-toggle');lobby=true;$('screen-games').hidden=false;$('screen-shade').hidden=false;$('screen-games-toggle').setAttribute('aria-expanded','true');$('screen-games-close').focus();}
function arrangePanels(){
 const p=panel(),root=gameRoot(),enabled=document.body.classList.contains('game-screen');if(!p||!root)return;
 if(current==='rescue'){const heading=root.querySelector('.rs-heading');if(heading){if(enabled&&!p.contains(heading))p.prepend(heading);else if(!enabled&&p.contains(heading))root.prepend(heading);}}
 const top=root.querySelector('.motion-top');if(top){const actions=top.children[1]||p.querySelector('.screen-motion-actions');if(actions){if(enabled&&!p.contains(actions)){actions.classList.add('screen-motion-actions');p.append(actions);}else if(!enabled&&p.contains(actions)){actions.classList.remove('screen-motion-actions');top.append(actions);}}}
}
function tagPanel(){
 if(current==='chess'&&!panel()){const section=document.createElement('section');section.className='ac-screen-settings';for(const [id,label] of [['ac-info-toggle','查看阵容与装备'],['ac-export','导出回放'],['ac-new','新对局']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{closePanels();$(id)?.click();};section.append(button);}gameRoot().append(section);}
 arrangePanels();const p=panel();if(p){p.dataset.screenSettings='';if(!p.querySelector('[data-audio-settings]')){const b=document.createElement('button');b.dataset.audioSettings='';b.className='quiet';b.textContent='音乐与音效';p.append(b);}if(menu){p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-label',names[current]+'设置');}}
 bindPause();
}
function bindPause(){
 buttonObserver?.disconnect();const original=$(pauseIds[current])||(current==='dance'?$('dance-pause'):null);
 const sync=()=>{const b=$('screen-pause');b.hidden=!original||original.disabled||original.hidden;const text=(original?.textContent||'')+' '+(original?.getAttribute('aria-label')||''),label=/暂停/.test(text)?'暂停':/开始|开局/.test(text)?'开始':'继续';if(b.textContent!==label)b.textContent=label;b.disabled=!original||original.disabled;};
 sync();if(original){buttonObserver=new MutationObserver(sync);buttonObserver.observe(original,{childList:true,attributes:true,attributeFilter:['disabled','aria-pressed','aria-label','hidden']});}
}
function orientationHint(){
 const horizontal=innerWidth>innerHeight,wanted=preferred[current],mismatch=(wanted==='landscape')!==horizontal;
 $('screen-orientation').hidden=!document.body.classList.contains('game-screen')||!small()||!mismatch;
 $('screen-orientation').textContent=wanted==='landscape'?'↻ 横屏更好玩':'↻ 竖屏更好玩';
 const now=horizontal?'landscape':'portrait';if(lastOrientation&&lastOrientation!==now&&document.body.classList.contains('game-screen'))pauseGame();lastOrientation=now;
}
function syncMode(){
 const enabled=(!windowed&&small())||forced||!!fullscreen();document.body.classList.toggle('game-screen',enabled);document.body.classList.toggle('touch-screen',small());$('screen-bar').hidden=!enabled;
 arrangePanels();
 const button=$('screen-fullscreen');button.textContent=fullscreen()?'退出全屏':'全屏';button.setAttribute('aria-pressed',String(!!fullscreen()));$('screen-enter').textContent=forced||fullscreen()?'退出游戏屏':'全屏玩';
 if(!enabled)closePanels();orientationHint();
}
async function lockOrientation(){try{if(fullscreen())await screen.orientation?.lock?.(preferred[current]);}catch{/* Manual rotation remains available. */}}
async function enter(){
 if(requesting)return;requesting=true;windowed=false;forced=true;syncMode();
 try{const request=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;if(request){await request.call(document.documentElement,{navigationUI:'hide'});owner=true;await lockOrientation();}else toast('已铺满页面，可旋转手机选择横竖屏');}
 catch{toast('已铺满页面，可旋转手机选择横竖屏');}
 finally{requesting=false;syncMode();}
}
async function leave(){pauseGame();closePanels();forced=false;try{screen.orientation?.unlock?.();const exit=document.exitFullscreen||document.webkitExitFullscreen;if(fullscreen()&&exit)await exit.call(document);}catch{}owner=false;syncMode();}
function toast(text){const n=$('screen-toast');n.textContent=text;n.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.hidden=true,3800);}
function updateGame(){
 const next=document.querySelector('.switcher [aria-pressed=true]')?.dataset.game||'snake';
 if(next!==current){closePanels();current=next;rootObserver?.disconnect();rootObserver=new MutationObserver(tagPanel);rootObserver.observe(gameRoot(),{childList:true});if(fullscreen())lockOrientation();}
 document.body.dataset.screenGame=current;$('screen-title').textContent=names[current];$('screen-settings-title').textContent=names[current]+'设置';document.querySelectorAll('[data-screen-game]').forEach(b=>b.setAttribute('aria-current',b.dataset.screenGame===current?'true':'false'));tagPanel();syncMode();
}
export function initGameScreen(){
 const enterButton=document.createElement('button');enterButton.id='screen-enter';enterButton.className='quiet';enterButton.textContent='全屏玩';document.querySelector('.head-actions').prepend(enterButton);
 const screen=document.createElement('div');screen.id='game-screen-ui';screen.innerHTML=`<div id="screen-bar" hidden><button id="screen-games-toggle" aria-expanded="false" aria-label="选择游戏">‹ 游戏</button><div id="screen-identity"><b id="screen-title"></b><button id="screen-orientation" hidden aria-label="横竖屏建议"></button></div><button id="screen-pause">暂停</button><button id="screen-fullscreen" aria-pressed="false">全屏</button><button id="screen-menu" aria-expanded="false" aria-label="游戏设置">设置</button></div><p id="screen-toast" role="status" hidden></p><div id="screen-shade" hidden></div><section id="screen-games" hidden role="dialog" aria-modal="true" aria-label="选择游戏"><header><b>虾米对练场</b><button id="screen-games-close">返回游戏</button></header><div>${Object.entries(names).map(([id,name])=>`<button data-screen-game="${id}"><b>${name}</b><small>${preferred[id]==='landscape'?'横屏':'竖屏'}</small></button>`).join('')}</div><button id="screen-windowed">返回网页布局</button></section><header id="screen-settings-head" hidden><b id="screen-settings-title"></b><button id="screen-sound">声音</button><button id="screen-import">载入回放</button><button id="screen-settings-close">完成</button></header>`;
 document.body.prepend(screen);
 $('screen-enter').onclick=()=>forced||fullscreen()?leave():enter();$('screen-fullscreen').onclick=()=>fullscreen()?leave():enter();$('screen-games-toggle').onclick=games;$('screen-menu').onclick=settings;$('screen-games-close').onclick=closePanels;$('screen-settings-close').onclick=closePanels;$('screen-shade').onclick=closePanels;
 $('screen-windowed').onclick=()=>{windowed=true;closePanels();leave();};
 $('screen-orientation').onclick=()=>{$('screen-orientation').hidden=true;};$('screen-pause').onclick=()=>($(pauseIds[current])||(current==='dance'?$('dance-pause'):null))?.click();
 const sound=()=>{$('screen-sound').textContent=$('sound').textContent;};sound();new MutationObserver(sound).observe($('sound'),{childList:true});$('screen-sound').onclick=()=>$('sound').click();$('screen-import').onclick=()=>{closePanels();$('import').click();};
 document.querySelectorAll('[data-screen-game]').forEach(b=>b.onclick=()=>{closePanels();document.querySelector('.switcher [data-game="'+b.dataset.screenGame+'"]').click();});
 new MutationObserver(updateGame).observe(document.querySelector('.switcher'),{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
 rootObserver=new MutationObserver(tagPanel);rootObserver.observe(gameRoot(),{childList:true});
 for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,()=>{if(owner&&!fullscreen()){owner=false;forced=false;pauseGame();}syncMode();});
 window.addEventListener('resize',orientationHint);matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1200px)').addEventListener('change',syncMode);
 window.addEventListener('keydown',e=>{if((!menu&&!lobby)||document.querySelector('dialog[open]'))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePanels();}else if(e.key==='Tab'){const selectors=lobby?'#screen-games button':'#screen-settings-head button,[data-screen-settings] button,[data-screen-settings] select,[data-screen-settings] input,[data-screen-settings] summary',nodes=[...document.querySelectorAll(selectors)].filter(n=>!n.disabled&&n.getClientRects().length);const index=nodes.indexOf(document.activeElement),next=e.shiftKey?(index-1+nodes.length)%nodes.length:(index+1)%nodes.length;e.preventDefault();nodes[next]?.focus();}else e.stopPropagation();},true);
 updateGame();
}
