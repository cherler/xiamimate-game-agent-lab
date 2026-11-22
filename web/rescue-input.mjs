import {rescuePoint} from './rescue-board.mjs';
import {screenDelta,rotatedScreen} from './screen-coordinates.mjs';

// Every tap orders the whole team. Drags only pan a zoomed map; cancelled
// gestures never become an order, even when they started on a soldier.
export function bindRescueInput(canvas,{state,move,place,placing,visual,cancelPlacement}){
 const wrap=canvas.parentElement;let gesture=null;
 function finish(){const g=gesture;gesture=null;visual(null);if(g&&canvas.hasPointerCapture(g.id))canvas.releasePointerCapture(g.id);}
 canvas.oncontextmenu=e=>e.preventDefault();
 canvas.onpointerdown=e=>{
  if(gesture||e.isPrimary===false||![0,2].includes(e.button))return;
  e.preventDefault();canvas.focus({preventScroll:true});if(!state().interactive)return;
  if(e.button===2&&placing()){cancelPlacement();return;}
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,left:wrap.scrollLeft,top:wrap.scrollTop,zoom:wrap.classList.contains('rs-zoomed'),place:placing(),moved:false};canvas.setPointerCapture(e.pointerId);
 };
 canvas.onpointermove=e=>{
  const p=rescuePoint(canvas,e);if(!gesture){visual({hover:p});return;}if(e.pointerId!==gesture.id)return;
  const g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)>8)g.moved=true;
  if(g.moved){if(g.zoom){const delta=screenDelta(dx,dy,rotatedScreen(canvas));wrap.scrollLeft=g.left-delta.x;wrap.scrollTop=g.top-delta.y;}visual(null);}else visual({hover:p});
 };
 canvas.onpointerup=e=>{
  if(!gesture||e.pointerId!==gesture.id)return;const g=gesture,p=rescuePoint(canvas,e);finish();
  if(g.moved||Math.hypot(e.clientX-g.x,e.clientY-g.y)>8||p.x<0||p.x>=24||p.y<0||p.y>=16||!state().interactive)return;
  if(g.place)place(p);else move(p);
 };
 canvas.onpointercancel=e=>{if(gesture?.id===e.pointerId)finish();};
 canvas.onlostpointercapture=e=>{if(gesture?.id===e.pointerId)finish();};
 canvas.onpointerleave=()=>{if(!gesture)visual(null);};
 return finish;
}
