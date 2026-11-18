const inPreview=location.pathname.includes('/preview/strategy-depth/');
const original=inPreview?'../../versions/gameplay-2026-11-18/':'https://cherler.github.io/xiamimate-game-agent-lab/versions/gameplay-2026-11-18/';
const comparison=inPreview?'../../compare/':'https://cherler.github.io/xiamimate-game-agent-lab/compare/';
const banner=document.createElement('div');banner.className='gameplay-version';
banner.innerHTML='<b>玩法试验版</b><span>与原版分别保存进度</span><a data-original>原版试玩</a><a data-comparison>改动对照</a>';
document.querySelector('.site-head').after(banner);
const sync=()=>{banner.querySelector('[data-original]').href=original+(location.hash||'#cards');banner.querySelector('[data-comparison]').href=comparison;};
sync();window.addEventListener('hashchange',sync);document.addEventListener('click',e=>{if(e.target.closest('[data-game]'))queueMicrotask(sync);});
