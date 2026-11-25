import {beginRescue,issueRescue,advanceRescue,sealRescue,rescueMap} from '../src/rescue.mjs';
import {siegeScenario} from './rescue-siege-scenarios.mjs';
export const CAMPAIGN_UPGRADES=['fire','mobility','fire','gate','mobility','fire','gate','fire'];
// One decision per second. Only clicks, retreat and the existing door button.
export function escalationScenario({level=1,seed=41003,difficulty='normal',plan='escort',upgrades=CAMPAIGN_UPGRADES.slice(0,level-1),decisionEvery=30,version=9}={}){
 if(level<=5||version<9)return siegeScenario({level,seed,difficulty,plan,upgrades,decisionEvery,version});
 const match=beginRescue({level,seed,difficulty,upgrades,version});let stage=0,peak=0,moves=0,lastMove=-999;const milestones=[];
 const ids=()=>match.state.soldiers.filter(u=>u.hp>0).map(u=>u.id),order=(x,y)=>{issueRescue(match,{type:'move',ids:ids(),x,y});moves++;lastMove=match.state.tick;};
 const next=(x,y)=>{stage++;milestones.push({stage,t:match.state.tick/30,saved:match.state.saved,kills:match.state.kills});if(x!==undefined)order(x,y);};
 const waiting=(s,p=()=>true)=>s.civilians.some(c=>c.status==='waiting'&&p(c));
 issueRescue(match,{type:'start'});
 if(plan==='escort')order(level===6?19.5:level===8?11.5:12.5,level===6?4.5:5.5);
 while(match.state.winner===null){const s=match.state;
  if(plan==='escort'&&s.tick%decisionEvery===0){
   if(level===6){
    const car=s.objectives[0];
    if(stage===0&&!waiting(s,c=>Number(c.id.slice(1))<9))next(19.5,11.5);
    if(stage===1&&!waiting(s))next(3.5,12.5);
    if(stage===2&&s.saved>=rescueMap(level).quota)next(car.x,car.y);
    if(stage===3&&s.soldiers.some(u=>u.hp>0&&Math.hypot(u.x-car.x,u.y-car.y)<3))next();
    if(stage===4&&!car.done&&s.tick-lastMove>75){const target=car.waypoints[car.checkpoint],d=Math.hypot(target.x-car.x,target.y-car.y)||1;order(car.x+(target.x-car.x)/d*Math.min(2,d),car.y+(target.y-car.y)/d*Math.min(2,d));}
   }else if(level===7){
    if(stage===0&&s.objectives[0].done)next(19.5,5.5);
    if(stage===1&&s.objectives[1].done&&!waiting(s,c=>Number(c.id.slice(1))<9))next(19.5,11.5);
    if(stage===2&&!waiting(s))next(3.5,12.5);
   }else if(level===8){
    if(stage===0&&s.objectives[0].done&&!waiting(s,c=>Number(c.id.slice(1))<9))next(19.5,4.5);
    if(stage===1&&s.objectives[2].done)next(19.5,10.5);
    if(stage===2&&!waiting(s))next(11.5,10.5);
    if(stage===3&&s.objectives[1].done)next(3.5,12.5);
   }else if(level===9){
    if(stage===0&&s.objectives[0].done)next(19.5,4.5);
    if(stage===1&&!waiting(s,c=>Number(c.id.slice(1))<12))next(19.5,11.5);
    if(stage===2&&!waiting(s))next(4.5,11.5);
   }
  }
  advanceRescue(match);peak=Math.max(peak,match.state.zombies.length);
 }
 return {state:match.state,record:sealRescue(match),peak,moves,milestones};
}
