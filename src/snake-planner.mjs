import { snakeMoves, nextCell, stepSnake } from './snake.mjs';
const dirs=['up','right','down','left'];
function reach(s,actor,goal) {
  const start=s.bodies[actor][0],blocked=new Set(s.bodies.flatMap(b=>b.slice(0,-1)));
  blocked.delete(start);
  const queue=[[start,0]],seen=new Set([start]);let distance=121;
  for(let i=0;i<queue.length;i++) {
    const [cell,d]=queue[i];if(cell===goal)distance=d;
    for(const dir of dirs){const n=nextCell(cell,dir);if(n>=0&&!blocked.has(n)&&!seen.has(n)){seen.add(n);queue.push([n,d+1]);}}
  }
  return {distance,area:seen.size};
}
export function routeOptions(s,actor,trail=[]) {
  // Simulated replacement food is never inspected. Only the current public target matters.
  const root={game:'snake',tick:0,score:[0,0],alive:[true,true],winner:null,reason:'',...s,seed:0};
  return snakeMoves(root,actor).map(id=>{
    const outcomes=snakeMoves(root,1-actor).map(rival=>{
      const t=stepSnake(root,actor===0?[id,rival]:[rival,id]);
      const ate=t.score[actor]>root.score[actor],route=reach(t,actor,root.food);
      return {alive:t.alive[actor],distance:ate?0:route.distance,area:route.area,ate};
    });
    const live=outcomes.filter(x=>x.alive),cell=nextCell(root.bodies[actor][0],id);
    return {id,cell,risk:1-live.length/outcomes.length,food:live.length?Math.max(...live.map(x=>x.distance)):121,
      area:live.length?Math.min(...live.map(x=>x.area)):0,eats:live.some(x=>x.ate),
      repeats:trail.slice(-12).filter(c=>c===cell).length};
  });
}
export function planSnake(s,actor,style='forage',trail=[]) {
  const weights=style==='cautious'?[8,1.4]:style==='pressure'?[16,.35]:[12,.8];
  const options=routeOptions(s,actor,trail);
  for(const o of options)o.value=-o.risk*10000+(o.eats?240:0)-o.food*weights[0]
    +Math.min(40,o.area)*weights[1]-(o.area<s.bodies[actor].length+2?160:0)-o.repeats*16
    +(o.id===s.dirs[actor] ? .1 : 0);
  return options.sort((a,b)=>b.value-a.value||dirs.indexOf(a.id)-dirs.indexOf(b.id))[0];
}
export function snakePlans(s,actor,trail=[]) {
  const plans=[['forage','争食'],['cautious','保留退路'],['pressure','抢占近路']].map(([id,label])=>{
    const choice=planSnake(s,actor,id,trail);return {...choice,id,label,move:choice.id};
  });
  return plans.filter((p,i)=>plans.findIndex(q=>q.move===p.move)===i);
}
export function snakePlanPacket(s,actor,trail=[]) {
  const plans=snakePlans(s,actor,trail);
  return {state:{foodEaten:s.score||[0,0],you:actor,stepsLeft:180-(s.tick||0)},questions:{move:{type:'choice',
    instructions:'Win snake: stay alive and collect food. Prefer a short reachable food route with enough escape space. Choose a plan.',
    criteria:Object.fromEntries(plans.map(p=>[p.id,`Move ${p.move}. Food route ${p.food} steps. Immediate collision risk ${p.risk.toFixed(2)}. Reachable cells ${p.area}. Revisited ${p.repeats} times.`]))}}};
}
