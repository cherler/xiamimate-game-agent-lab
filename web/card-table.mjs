const paths={
 sword:'<path d="M15 3h6v6l-9 9-6-6z"/><path d="m3 14 7 7m-4-4-4 4"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 gem:'<path d="m12 2 8 10-8 10-8-10Z"/><path d="M4 12h16M12 2v20"/>',
 shield:'<path d="M12 2 21 6v7c0 5-9 9-9 9S3 18 3 13V6Z"/>',
 spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
 arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
 up:'<path d="M12 21V3m-7 7 7-7 7 7"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 swap:'<path d="M4 8a8 8 0 0 1 14-3l3 3M21 2v6h-6M20 16a8 8 0 0 1-14 3l-3-3M3 22v-6h6"/>',
 snow:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4M20 10l-4-1 1-4"/>',
 moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
 cross:'<path d="m5 5 14 14M19 5 5 19"/>',
 cards:'<rect x="7" y="5" width="13" height="17" rx="2"/><path d="M4 17H3V2h13v1m-3 6v9m-3-6h6"/>',
 gear:'<path d="m9 2 6 0 1 4 4 1 2 5-3 3 0 4-5 3-3-3-4 0-3-5 3-3 0-4Z"/><circle cx="12" cy="12" r="3"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 chain:'<path d="m10 14 4-4m-6 6-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-2 2" transform="translate(2 -1) scale(.85)"/>',
 skull:'<path d="M6 17v4h12v-4a9 9 0 1 0-12 0Z"/><circle cx="8" cy="11" r="1.5"/><circle cx="16" cy="11" r="1.5"/><path d="M10 21v-3m4 3v-3"/>'
};
export function glyph(name,cls=''){return `<svg class="table-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.spark}</svg>`;}
export function combatPreview(attacker,defender,hero=false){
 const hit=(unit,amount)=>({loss:unit.shield&&amount>0?0:Math.min(unit.hp,amount),blocked:!!unit.shield&&amount>0,dead:!unit.shield&&amount>=unit.hp});
 return {target:hit(defender,attacker.attack),source:hero?null:hit(attacker,defender.attack)};
}
const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};
const nodeFor=(root,id)=>[...root.querySelectorAll('[data-piece]')].find(el=>el.dataset.piece===id);
export function captureTable(root){return new Map([...root.querySelectorAll('[data-piece]')].map(el=>[el.dataset.piece,{...rect(el),clone:el.cloneNode(true)}]));}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function transient(node,frames,options){document.body.append(node);const anim=node.animate(frames,{duration:480,easing:'cubic-bezier(.2,.75,.3,1)',fill:'forwards',...options});anim.finished.catch(()=>{}).finally(()=>node.remove());return anim;}
function ghost(snapshot){const el=snapshot.clone.cloneNode(true);el.classList.add('card-motion-ghost');el.removeAttribute('id');el.style.cssText=`position:fixed;left:${snapshot.x}px;top:${snapshot.y}px;width:${snapshot.width}px;height:${snapshot.height}px;margin:0;pointer-events:none;z-index:9999;`;return el;}
export async function animateTable(root,before,after,positions,action){
 if(!before||!after||reduced()||root.querySelector('dialog[open]'))return;
 const playerRows=s=>s.players.flatMap((p,i)=>[{uid:'h'+i,hp:p.hp},...p.board]);
 const old=playerRows(before),next=playerRows(after),fresh=next.filter(u=>!old.some(v=>v.uid===u.uid));
 const source=positions.get(action?.uid||'power'),target=positions.get(action?.target);
 if(action?.type==='attack'&&source&&target){const el=ghost(source);transient(el,[{transform:'translate(0,0) scale(1)'},{transform:`translate(${(target.cx-source.cx)*.65}px,${(target.cy-source.cy)*.65}px) scale(1.1)`,offset:.45},{transform:'translate(0,0) scale(1)',opacity:0}],{duration:420});}
 for(const u of old){
  const n=next.find(v=>v.uid===u.uid),pos=positions.get(u.uid);if(!pos)continue;
  const delta=(n?.hp??0)-u.hp;
  if(delta){const label=document.createElement('div');label.className='table-hit '+(delta>0?'healing':'damage');label.textContent=(delta>0?'+':'−')+Math.abs(delta);label.style.cssText=`left:${pos.cx}px;top:${pos.cy}px`;transient(label,[{transform:'translate(-50%,-30%) scale(.6)',opacity:0},{transform:'translate(-50%,-65%) scale(1.15)',opacity:1,offset:.25},{transform:'translate(-50%,-160%) scale(1)',opacity:0}],{duration:850});const el=nodeFor(root,u.uid);if(el)el.animate([{filter:'brightness(1)'},{filter:delta<0?'brightness(1.8) sepia(.6)':'brightness(1.5)',offset:.3},{filter:'brightness(1)'}],{duration:500});}
  if(!n&&!u.uid.startsWith('h')){const el=ghost(pos);transient(el,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(25px) scale(.5) rotate(8deg)'}],{duration:480});}
  if(u.shield&&!n?.shield){const ring=document.createElement('div');ring.className='shield-burst';ring.style.cssText=`left:${pos.cx}px;top:${pos.cy}px;width:${pos.width}px;height:${pos.height}px`;transient(ring,[{opacity:1,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.5)'}],{duration:450});}
 }
 for(const u of fresh){const el=nodeFor(root,u.uid);if(!el)continue;const end=rect(el);if(source&&action?.type==='play'){el.animate([{transform:`translate(${source.cx-end.cx}px,${source.cy-end.cy}px) scale(.7)`,opacity:.4},{transform:'translate(0,0) scale(1)',opacity:1}],{duration:420,easing:'cubic-bezier(.15,.8,.3,1)'});}else el.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1.12)',opacity:1,offset:.7},{transform:'scale(1)'}],{duration:420});}
 for(let i=0;i<2;i++)for(const c of after.players[i].hand){if(!c?.uid||before.players[i].hand.some(v=>v.uid===c.uid))continue;const el=nodeFor(root,c.uid);if(el)el.animate([{transform:'translate(60px,-75px) rotate(15deg)',opacity:0},{transform:'translate(0,0) rotate(0)',opacity:1}],{duration:400});}
 await new Promise(r=>setTimeout(r,430));
}

let drag=null,ignoreClickUntil=0;
export function cancelCardDrag(){if(!drag)return;drag.ghost?.remove();drag.arrow?.remove();drag.root?.classList.remove('dragging-card');drag=null;}
export function bindTableGestures(root,{select,actions,act,onInspect}){
 const aim=root.querySelector('.table-aim'),path=aim?.querySelector('path'),head=aim?.querySelector('circle');
 function clearForecast(){root.querySelectorAll('.hit-forecast').forEach(el=>el.remove());}
 function aimAt(el){
  const source=root.querySelector('[data-source].chosen'),table=root.querySelector('.card-table');if(!source||!table||!path||!el)return;
  const a=rect(source),b=rect(el),r=rect(table),x=a.cx-r.x,y=a.cy-r.y,tx=b.cx-r.x,ty=b.cy-r.y;aim.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);path.setAttribute('d',`M${x},${y} Q${x+(tx-x)*.1},${ty} ${tx},${ty}`);head.setAttribute('cx',tx);head.setAttribute('cy',ty);aim.classList.add('visible');
  clearForecast();const move=actions().find(a=>a.target===(el.dataset.unit||el.dataset.target));if(move?.type!=='attack')return;
  const from={attack:Number(source.dataset.attack),hp:Number(source.dataset.hp),shield:source.dataset.shield==='true'},to={attack:Number(el.dataset.attack||0),hp:Number(el.dataset.hp),shield:el.dataset.shield==='true'},forecast=combatPreview(from,to,el.dataset.target?.startsWith('h'));
  for(const [node,result] of [[el,forecast.target],[source,forecast.source]]){if(!result)continue;const label=document.createElement('span');label.className='hit-forecast'+(result.dead?' lethal':'');label.innerHTML=result.blocked?glyph('shield'):result.dead?glyph('skull')+' −'+result.loss:'−'+result.loss;node.append(label);}
 }
 root.querySelectorAll('.targetable,[data-drop].drop-ready').forEach(el=>{el.onpointerenter=()=>aimAt(el);el.onfocus=()=>aimAt(el);el.onpointerleave=()=>{clearForecast();aim?.classList.remove('visible');};el.onblur=()=>{clearForecast();aim?.classList.remove('visible');};});
 root.querySelectorAll('[data-source]').forEach(el=>el.onpointerdown=e=>{
  if(e.button!==0||!el.classList.contains('playable')&&!el.classList.contains('can-attack')&&!el.classList.contains('power-ready'))return;
  if(drag)cancelCardDrag();drag={root,source:el.dataset.source,startX:e.clientX,startY:e.clientY,pointer:e.pointerId,pointerType:e.pointerType,preview:{...rect(el),clone:el.cloneNode(true)},select,actions,act,onInspect,started:false};
 });
}
if(typeof window!=='undefined'){
 window.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  if(!drag.started){const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(Math.hypot(dx,dy)<9||drag.pointerType==='touch'&&Math.abs(dy)<Math.abs(dx))return;drag.started=true;drag.select(drag.source);drag.root.classList.add('dragging-card');drag.ghost=ghost(drag.preview);drag.ghost.classList.add('drag-card-ghost');document.body.append(drag.ghost);drag.arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');drag.arrow.classList.add('drag-arrow');drag.arrow.innerHTML='<path fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="8 7"/><circle r="9" fill="none" stroke="currentColor" stroke-width="3"/>';document.body.append(drag.arrow);}
  e.preventDefault();const d=drag;d.ghost.style.transform=`translate(${e.clientX-d.startX}px,${e.clientY-d.startY}px) rotate(-4deg)`;d.arrow.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);d.arrow.querySelector('path').setAttribute('d',`M${d.preview.cx} ${d.preview.cy} Q${d.preview.cx} ${e.clientY} ${e.clientX} ${e.clientY}`);d.arrow.querySelector('circle').setAttribute('cx',e.clientX);d.arrow.querySelector('circle').setAttribute('cy',e.clientY);
  const hovered=document.elementFromPoint(e.clientX,e.clientY)?.closest('.targetable,.drop-ready');d.root.querySelectorAll('.drop-hover').forEach(n=>n.classList.remove('drop-hover'));hovered?.classList.add('drop-hover');
 },{passive:false});
 window.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;const d=drag;if(d.started){ignoreClickUntil=performance.now()+350;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-unit],[data-target],[data-drop]');const moves=d.actions(),id=target?.dataset.unit||target?.dataset.target,action=id?moves.find(a=>a.target===id):target?.dataset.drop!==undefined?moves.find(a=>a.target===null&&!a.choice):null;cancelCardDrag();d.root.querySelectorAll('.drop-hover').forEach(n=>n.classList.remove('drop-hover'));if(action)d.act(action);}else cancelCardDrag();});
 window.addEventListener('pointercancel',cancelCardDrag);window.addEventListener('blur',cancelCardDrag);
 window.addEventListener('click',e=>{if(performance.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
}
