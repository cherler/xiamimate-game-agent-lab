import {beginRescue,issueRescue,advanceRescue,sealRescue} from '../src/rescue.mjs';
export function rescueScenario({level=1,seed=41003,plan='escort',upgrades=level===1?[]:level===2?['fire']:['fire','mobility'],difficulty='normal'}={}){
 const match=beginRescue({level,seed,upgrades,difficulty}),ids=g=>match.state.soldiers.filter(u=>u.hp>0&&(g==='all'||u.group===g)).map(u=>u.id);
 const order=(g,x,y)=>issueRescue(match,{type:'move',ids:ids(g),x,y});
 if(plan==='escort'&&level===2)issueRescue(match,{type:'gate',door:'door2'});
 issueRescue(match,{type:'start'});
 if(plan==='defend'||(plan==='escort'&&level===1))order('all',19.5,level===1?8.5:12);
 else if(plan==='escort'){order(0,19,4.5);order(1,19.5,12);order(2,19,4.5);}
 let beforeEnd,retreated=false,hunting=false;
 while(match.state.winner===null){
  if(plan==='escort'&&!retreated&&match.state.civilians.every(c=>c.status==='following'||c.status==='saved')){order('all',3.5,12.5);retreated=true;}
  if(plan==='escort'&&level===3&&!hunting&&match.state.saved===20){order('all',12.5,4.5);hunting=true;}
  const previous=match.state;advanceRescue(match);if(match.state.winner!==null)beforeEnd=sealRescue({...match,state:previous});
 }
 return {state:match.state,record:sealRescue(match),beforeEnd};
}
