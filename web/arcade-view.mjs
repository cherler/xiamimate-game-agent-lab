export const PONG_VIEWS=['left','top','right','bottom'];
export function pongAxis(view,dir){
 const keys={left:{up:-1,down:1},right:{up:1,down:-1},top:{left:1,right:-1},bottom:{left:-1,right:1}};
 return keys[view]?.[dir]||0;
}
export function pongPoint(view,x,y){
 return view==='top'?[600-y,x]:view==='right'?[1000-x,600-y]:view==='bottom'?[y,1000-x]:[x,y];
}
export function pongTarget(view,x,y){return Math.max(0,Math.min(600,view==='bottom'?x:view==='top'?600-x:view==='right'?600-y:y));}
export function foodEvents(before,after,at){
 if(before?.game!=='snake'||after.game!=='snake'||after.tick<=before.tick)return [];
 return after.score.flatMap((score,actor)=>score>before.score[actor]?[{actor,cell:before.food,at,points:score-before.score[actor]}]:[]);
}
