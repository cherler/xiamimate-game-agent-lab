// A burst of gestures keeps its order across frames, including repeated lane changes.
export function queueRunnerInput(queue,action,tick){
 const fresh=queue.filter(v=>v.until>=tick);
 if(fresh.length>=6||!['left','right'].includes(action)&&fresh.some(v=>v.action===action))return fresh;
 return [...fresh,{action,until:tick+9}];
}
export function takeRunnerInput(queue,state){
 const fresh=queue.filter(v=>v.until>=state.tick);
 const index=fresh.findIndex(v=>v.action!=='jump'||state.jump<0||state.jump<.63);
 if(index<0)return {queue:fresh,actions:[]};
 const [{action}]=fresh.splice(index,1);
 return {queue:fresh,actions:[action]};
}
