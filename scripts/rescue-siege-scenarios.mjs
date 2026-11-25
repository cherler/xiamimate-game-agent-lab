import {beginRescue,issueRescue,advanceRescue,sealRescue,rescueMap} from '../src/rescue.mjs';
// Only commands available to a player: click a destination for the whole team,
// wait by the objective, and retreat. No direct state changes or extra powers.
export function siegeScenario({level=1,seed=41003,version=8,difficulty='normal',plan='escort',decisionEvery=1,upgrades=level===1?[]:['fire','mobility','fire','gate','mobility'].slice(0,level-1)}={}){
 const escort=['escort','supply'].includes(plan);
 const match=beginRescue({level,seed,upgrades,version,difficulty}),ids=()=>match.state.soldiers.filter(u=>u.hp>0).map(u=>u.id);
 let stage=0,peak=0,lastMove=-999,moves=0;const milestones=[];
 const order=(x,y)=>{issueRescue(match,{type:'move',ids:ids(),x,y});lastMove=match.state.tick;moves++;};
 const next=(x,y)=>{stage++;milestones.push({stage,t:match.state.tick/30,saved:match.state.saved,kills:match.state.kills});if(x!==undefined)order(x,y);};
 const waiting=(s,test=()=>true)=>s.civilians.some(c=>test(c)&&c.status==='waiting');
 issueRescue(match,{type:'start'});
 const startRoute=()=>{if(level===4)order(12.5,5.5);else if(level===5)order(11.5,4.5);else order(19.5,level===1?8.5:level===2||level===6?4.5:12);};
 if(escort){const crate=plan==='supply'&&match.state.crates.find(c=>c.reward==='overdrive');if(crate){stage=-1;order(crate.x,crate.y);}else startRoute();}
 while(match.state.winner===null){
  const s=match.state;
  if(escort&&s.tick%decisionEvery===0){
   if(stage===-1){if(s.crates.some(c=>c.reward==='overdrive'&&c.claimed)){stage=0;startRoute();}else{advanceRescue(match);peak=Math.max(peak,match.state.zombies.length);continue;}}
   if(level<=3){
    if(level>1&&stage===0&&!waiting(s,c=>level===2?c.y<8:c.y>8))next(19.5,level===2?12:4.5);
    if(stage<2&&!waiting(s)){stage=1;next(3.5,12.5);}
    if(level===3&&stage===2&&s.saved===20)next(12.5,5.5);
   }else if(level===4){
    if(stage===0&&s.objectives[0].done)next(19.5,4.5);
    if(stage===1&&!waiting(s,c=>Number(c.id.slice(1))>=9))next(19.5,11.5);
    if(stage===2&&!waiting(s))next(3.5,12.5);
   }else if(level===5){
    if(stage===0&&s.objectives[0].done&&!waiting(s,c=>Number(c.id.slice(1))>=12))next(19.5,4.5);
    if(stage===1&&s.objectives[1].done)next(19.5,10.5);
    if(stage===2&&!waiting(s))next(3.5,12.5);
   }else{
    const car=s.objectives[0];
    if(stage===0&&!waiting(s,c=>Number(c.id.slice(1))<9))next(19.5,11.5);
    if(stage===1&&!waiting(s))next(car.x,car.y);
    if(stage===2&&s.soldiers.some(u=>u.hp>0&&Math.hypot(u.x-car.x,u.y-car.y)<3))next();
    if(stage===3&&!car.done&&s.tick-lastMove>75){const target=car.waypoints[car.checkpoint],d=Math.hypot(target.x-car.x,target.y-car.y)||1;order(car.x+(target.x-car.x)/d*Math.min(2,d),car.y+(target.y-car.y)/d*Math.min(2,d));}
    if(stage===3&&car.done)next(3.5,12.5);
   }
  }
  advanceRescue(match);peak=Math.max(peak,match.state.zombies.length);
 }
 return {state:match.state,record:sealRescue(match),peak,moves,milestones};
}
