import {rescuePoint} from './rescue-board.mjs';

// Keep gestures local to this canvas; a cancelled drag must never issue an order.
export function bindRescueInput(canvas,{state,selected,select,move,place,placing,boxMode,boxDone,visual,cancelPlacement}){
 const wrap=canvas.parentElement;let gesture=null;
 const troopAt=p=>{const radius=Math.max(.36,Math.min(.75,14*24/canvas.getBoundingClientRect().width));return state().soldiers.filter(u=>u.hp>0).map(u=>({u,d:Math.hypot(u.x-p.x,u.y-p.y)})).filter(t=>t.d<=radius).sort((a,b)=>a.d-b.d)[0]?.u;};
 function finish(){const g=gesture;gesture=null;visual(null);if(g&&canvas.hasPointerCapture(g.id))canvas.releasePointerCapture(g.id);}
 canvas.oncontextmenu=e=>e.preventDefault();
 canvas.onpointerdown=e=>{
  if(gesture||e.isPrimary===false||![0,1,2].includes(e.button))return;
  e.preventDefault();canvas.focus({preventScroll:true});const p=rescuePoint(canvas,e),troop=troopAt(p),zoom=wrap.classList.contains('rs-zoomed');
  const pan=zoom&&(e.button===1||e.altKey||e.pointerType==='touch'&&!troop&&!boxMode()&&!placing());
  if(e.button===1&&!pan)return;
  if(!pan&&!state().interactive)return;
  if(e.button===2&&placing()){cancelPlacement();return;}
  const kind=pan?'pan':placing()?'place':e.button===2?'order':boxMode()?'box':troop?'unit':'box';
  gesture={id:e.pointerId,kind,p,x:e.clientX,y:e.clientY,left:wrap.scrollLeft,top:wrap.scrollTop,troop,add:e.shiftKey,prior:selected(),moved:false,touch:e.pointerType==='touch'};canvas.setPointerCapture(e.pointerId);
 };
 canvas.onpointermove=e=>{
  const p=rescuePoint(canvas,e);if(!gesture){visual({hover:p});return;}if(e.pointerId!==gesture.id)return;
  const g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)>7)g.moved=true;
  if(g.kind==='pan'){if(g.moved){wrap.scrollLeft=g.left-dx;wrap.scrollTop=g.top-dy;}return;}
  if(!g.moved){visual({hover:p});return;}
  e.preventDefault();
  if(g.kind==='unit'){
   if(!selected().includes(g.troop.id))select(g.add?[...new Set([...g.prior,g.troop.id])]:[g.troop.id]);
   visual({hover:p,move:p});
  }else if(g.kind==='box')visual({hover:p,box:{x:g.p.x,y:g.p.y,x2:p.x,y2:p.y}});
 };
 canvas.onpointerup=e=>{
  if(!gesture||e.pointerId!==gesture.id)return;const g=gesture,p=rescuePoint(canvas,e);finish();
  if(p.x<0||p.x>=24||p.y<0||p.y>=16||!state().interactive)return;
  if(g.kind==='pan'){if(!g.moved&&g.touch)move(p);return;}
  if(g.kind==='place'){if(!g.moved)place(p);return;}
  if(g.kind==='order'){move(p);return;}
  if(g.kind==='unit'){
   if(g.moved)move(p);
   else select(g.add?(g.prior.includes(g.troop.id)?g.prior.filter(id=>id!==g.troop.id):[...g.prior,g.troop.id]):[g.troop.id]);
  }else if(g.moved){
   const ids=state().soldiers.filter(u=>u.hp>0&&u.x>=Math.min(g.p.x,p.x)&&u.x<=Math.max(g.p.x,p.x)&&u.y>=Math.min(g.p.y,p.y)&&u.y<=Math.max(g.p.y,p.y)).map(u=>u.id);
   if(ids.length)select(g.add?[...new Set([...g.prior,...ids])]:ids);boxDone();
  }else if(!boxMode())move(p);
 };
 canvas.onpointercancel=e=>{if(gesture?.id===e.pointerId)finish();};
 canvas.onlostpointercapture=e=>{if(gesture?.id===e.pointerId)finish();};
 canvas.onpointerleave=()=>{if(!gesture)visual(null);};
 canvas.ondblclick=e=>{if(e.pointerType==='touch'||!state().interactive||placing())return;const troop=troopAt(rescuePoint(canvas,e));if(troop)select(state().soldiers.filter(u=>u.hp>0&&u.group===troop.group).map(u=>u.id));};
 return finish;
}
