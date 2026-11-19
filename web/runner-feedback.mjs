// Presentation time never changes the recorded simulation or its collision result.
export const RUNNER_IMPACT_MS=880, RUNNER_HITSTOP_MS=65;
export function runnerImpact(impact,now,reduced=false){
 if(!impact)return null;
 const age=Math.max(0,now-impact.at),saved=impact.kind==='saved',duration=saved?460:RUNNER_IMPACT_MS,t=Math.min(1,age/duration);
 if(saved&&age>=duration)return null;
 const kick=Math.sin(Math.min(1,age/210)*Math.PI),fade=1-t,fall=impact.obstacle==='gap'&&!saved;
 return {...impact,age,t,saved,fall,fade,
  shake:reduced?0:Math.sin(age*.13)*Math.exp(-age/90)*(saved?3:6),
  recoil:reduced?0:kick,tilt:fall?t*.65:saved?kick*.08:-kick*.38-t*.12,
  drop:fall?t*t*135:kick*9,scale:fall?1-t*.65:1,
  flash:reduced?0:Math.max(0,1-age/130)*.15};
}
