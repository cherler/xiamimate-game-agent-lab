import {beginRescue,issueRescue,advanceRescue,sealRescue,rescueMap} from '../src/rescue.mjs';

// A deliberately low-input player: whole-team destinations, optional nearby
// barricade, no squad selections, healing, lures, or manual extraction call.
export function simpleRescueScenario({level=1,seed=41003,plan='escort',version=6,difficulty='normal',gate=true,upgrades=level===1?[]:level===2?['fire']:['fire','mobility']}={}){
 const match=beginRescue({level,seed,version,upgrades,difficulty}),ids=()=>match.state.soldiers.filter(u=>u.hp>0).map(u=>u.id);
 const order=(x,y)=>issueRescue(match,{type:'move',ids:ids(),x,y});
 const firstGroup=match.state.civilians.filter(c=>level===2?c.y<8:c.y>8).map(c=>c.id);
 issueRescue(match,{type:'start'});if(plan==='escort')order(19.5,level===2?4.5:level===1?8.5:12);
 let stage=0,beforeEnd;
 while(match.state.winner===null){
  const s=match.state;
  if(plan==='escort'){
   if(level>1&&stage===0&&s.civilians.filter(c=>firstGroup.includes(c.id)).every(c=>c.status!=='waiting')){order(19.5,level===2?12:4.5);stage=1;}
   if(stage<2&&s.civilians.every(c=>c.status!=='waiting')){order(3.5,12.5);stage=2;}
   if(gate&&stage===2&&s.civilians.some(c=>c.status==='boarding')){
    const door=level===1?'door2':level===2?'door2':'door4',d=rescueMap(level,version).doors.find(d=>d.id===door);
    if(!s.gates.some(g=>g.id===door)&&s.gateCharges&&s.soldiers.some(u=>u.hp>0&&Math.hypot(u.x-d.x,u.y-d.y)<3))issueRescue(match,{type:'gate',door});
   }
   if(level===3&&stage===2&&s.saved===20){order(12.5,5.5);stage=3;}
  }
  const previous=match.state;advanceRescue(match);if(match.state.winner!==null)beforeEnd=sealRescue({...match,state:previous});
 }
 return {state:match.state,record:sealRescue(match),beforeEnd};
}
