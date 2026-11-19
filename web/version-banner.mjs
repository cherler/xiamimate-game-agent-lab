// Historical preview builds retain their own label; the production entry needs no banner.
if(location.pathname.includes('/preview/strategy-depth/')){
 const banner=document.createElement('div');banner.className='gameplay-version';
 banner.innerHTML='<b>玩法对照版</b><span>新版已成为默认玩法</span><a data-original>原版试玩</a><a href="../../compare/">改动对照</a>';
 document.querySelector('.site-head').after(banner);
 const sync=()=>{banner.querySelector('[data-original]').href='../../versions/gameplay-2026-11-18/'+(location.hash||'#cards');};
 sync();window.addEventListener('hashchange',sync);document.addEventListener('click',e=>{if(e.target.closest('[data-game]'))queueMicrotask(sync);});
}
