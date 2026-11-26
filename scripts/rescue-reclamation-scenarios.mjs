import {beginRescue,issueRescue,advanceRescue,sealRescue,rescueMap,pathTo,lineOfSight} from '../src/rescue.mjs';
import {CAMPAIGN_UPGRADES} from './rescue-escalation-scenarios.mjs';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),live=u=>u.hp>0;
export function reclamationScenario({level=1,seed=41003,difficulty='normal',plan='active',upgrades=CAMPAIGN_UPGRADES.slice(0,level-1),onStep=()=>{}}={}){
 const match=beginRescue({level,seed,difficulty,upgrades,version:10}),m=rescueMap(level,10);let destination=null,lastMove=-999,peak=0,selectedRefuge=null;const milestones=[];
 const order=p=>{const s=match.state;try{issueRescue(match,{type:'move',ids:s.soldiers.filter(live).map(u=>u.id),x:p.x,y:p.y});destination={...p};lastMove=s.tick;}catch{}};
 issueRescue(match,{type:'start'});
 while(match.state.winner===null){let s=match.state;
  if(plan!=='idle'&&s.tick%15===0){
   const troops=s.soldiers.filter(live),leader=troops.find(u=>u.role==='shield')||troops[0];if(!leader)break;
   const remaining=s.refuges.filter(r=>!r.released),people=s.civilians.filter(c=>['waiting','following','boarding'].includes(c.status));
   if(plan!=='no-support'&&s.artillery.charges&&s.tick>=s.artillery.readyAt){
    const ranked=s.zombies.filter(live).map(z=>({z,score:s.zombies.reduce((n,t)=>n+(dist(t,z)<2.5?(t.mutation==='breaker'?3:['gunner','bomber'].includes(t.mutation)?4:1):0),0)})).sort((a,b)=>b.score-a.score);
    const target=ranked.find(r=>r.score>=10&&troops.some(u=>dist(u,r.z)<7)||r.score>=18&&s.refuges.some(h=>!h.released&&dist(h,r.z)<4));if(target){issueRescue(match,{type:'artillery',x:target.z.x,y:target.z.y});s=match.state;}
   }
   if(plan==='tactical'&&s.gateCharges&&s.tick%30===0){const gate=m.doors.find(d=>!s.gates.some(g=>g.id===d.id&&g.hp>0)&&troops.some(u=>dist(u,d)<3)&&s.zombies.filter(z=>dist(z,d)<3).length>=4);if(gate){issueRescue(match,{type:'gate',door:gate.id});s=match.state;}}
   // Leave a forecast blast or a locked firing line, rather than stand still in it.
   const danger=s.enemyBombs.find(b=>b.expires>s.tick&&troops.some(u=>dist(u,b)<b.radius+.3));
   if(danger&&s.tick-lastMove>=15){const escape=[{x:leader.x-2,y:leader.y},{x:leader.x+2,y:leader.y},{x:leader.x,y:leader.y-2},{x:leader.x,y:leader.y+2}].filter(p=>dist(p,danger)>danger.radius+1&&pathTo(s,leader,p).length);if(escape[0])order(escape[0]);}
   else if(s.tick-lastMove>=30){
    let goal;
    const landmark=s.objectives.filter(o=>['turret','seal'].includes(o.type)&&!o.done).sort((a,b)=>dist(a,leader)-dist(b,leader))[0];
    const power=s.objectives.find(o=>o.type==='power'&&!o.done),radio=s.objectives.find(o=>o.type==='radio'&&!o.done);
    if(power||radio)goal=power||radio;
    else if(plan==='tactical'&&landmark&&(dist(landmark,leader)<7||!remaining.length))goal=landmark;
    else if(remaining.length){selectedRefuge=remaining.find(r=>r.id===selectedRefuge?.id)||remaining.sort((a,b)=>level===2&&plan==='tactical'?a.group-b.group:pathTo(s,leader,a).length-pathTo(s,leader,b).length)[0];goal=selectedRefuge;}
    else if(people.some(c=>c.status==='waiting'))goal=people.find(c=>c.status==='waiting');
    else if(people.length&&s.achievements.evacuated===null)goal={x:3.5,y:12.5};
    else{
     const o=s.objectives.find(o=>!o.done&&!o.optional);
     if(o?.type==='convoy'){
      if(!o.started||dist(leader,o)>2.8)goal=o;
      else{const end=o.waypoints[o.checkpoint],d=dist(end,o)||1;goal={x:o.x+(end.x-o.x)/d*Math.min(1.6,d),y:o.y+(end.y-o.y)/d*Math.min(1.6,d)};}
     }else if(o)goal=o;
     else if(s.zombies.length){const z=[...s.zombies].sort((a,b)=>dist(a,leader)-dist(b,leader))[0];if(dist(leader,z)>4||!lineOfSight(s,leader,z))goal=z;}
    }
    if(goal&&(!destination||dist(goal,destination)>.55||s.tick-lastMove>150))order(goal);
   }
  }
  advanceRescue(match);s=match.state;peak=Math.max(peak,s.zombies.length);onStep(s,match.record);
  for(const key of ['evacuated','reclaimed'])if(s.achievements[key]===s.tick)milestones.push({key,tick:s.tick,kills:s.kills,enemies:s.zombies.length,pending:s.schedule.length-s.spawned});
 }
 return {state:match.state,record:sealRescue(match),peak,milestones};
}
