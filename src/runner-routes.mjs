import {noise} from './common.mjs';

export const ROUTE_LENGTH=400,ROUTE_ROWS=8;
export const RUNNER_ZONES=Object.freeze([
 {id:'station',name:'晨光车站',color:'#458f9d',sky:'#d5edf1',ground:'#a9c8b2',road:'#879da5',edge:'#edf0d9',vehicle:'#5796aa'},
 {id:'market',name:'桥下市集',color:'#b77d51',sky:'#e8e7d6',ground:'#b6c7a3',road:'#bdaf8f',edge:'#f3e7bf',vehicle:'#d29a64'},
 {id:'river',name:'滨河栈桥',color:'#528eaf',sky:'#d7edf3',ground:'#8fcbd0',road:'#b8b797',edge:'#e4d8ad',vehicle:'#719db6'}
]);
// Each phrase has a clear lane; optional stars sit on a jump or roll line.
// Slot 3 and slot 7 give the player a break, with a longer gap between districts.
const routes=[
 [
  {lanes:['train',null,null],safe:1},
  {lanes:[null,'barrier','train'],safe:0,bonus:1},
  {lanes:['train','arch',null],safe:2,bonus:1},
  {lanes:[null,null,null],safe:1},
  {lanes:['train',null,'barrier'],safe:1,bonus:2},
  {lanes:[null,'train','train'],safe:0},
  {lanes:['arch',null,'train'],safe:1,bonus:0},
  {lanes:[null,null,null],safe:1}
 ],[
  {lanes:[null,'train','barrier'],safe:0,bonus:2},
  {lanes:['arch',null,'train'],safe:1,bonus:0},
  {lanes:['train','barrier',null],safe:2,bonus:1},
  {lanes:[null,null,null],safe:1},
  {lanes:['barrier','train',null],safe:2,bonus:0},
  {lanes:[null,'arch','train'],safe:0,bonus:1},
  {lanes:['train',null,'barrier'],safe:1,bonus:2},
  {lanes:[null,null,null],safe:1}
 ],[
  {lanes:['gap',null,'train'],safe:1,bonus:0},
  {lanes:['train','gap',null],safe:2,bonus:1},
  {lanes:[null,'train','gap'],safe:0,bonus:2},
  {lanes:[null,null,null],safe:1},
  {lanes:['arch',null,'train'],safe:1,bonus:0},
  {lanes:[null,'gap','train'],safe:0,bonus:1},
  {lanes:['train',null,'gap'],safe:1,bonus:2},
  {lanes:[null,null,null],safe:1}
 ]
];
export const runnerRowZ=index=>Math.floor(index/ROUTE_ROWS)*ROUTE_LENGTH+80+(index%ROUTE_ROWS)*40;
export function runnerRoute(z){
 const index=Math.floor(Math.max(0,z)/ROUTE_LENGTH),zone=RUNNER_ZONES[index%RUNNER_ZONES.length];
 return {index,zone,progress:(z-index*ROUTE_LENGTH)/ROUTE_LENGTH,remaining:Math.ceil((index+1)*ROUTE_LENGTH-z),next:RUNNER_ZONES[(index+1)%RUNNER_ZONES.length]};
}
export function routeRow(seed,index){
 const chapter=Math.floor(index/ROUTE_ROWS),slot=index%ROUTE_ROWS,zone=RUNNER_ZONES[chapter%3];
 const variants=[[0,1,2,3,4,5,6,7],[4,5,6,3,0,1,2,7],[1,2,0,3,5,6,4,7]],order=variants[chapter<3?0:Math.floor(noise(seed,chapter,43)*variants.length)],template=routes[chapter%3][order[slot]];
 const mirror=chapter>0&&noise(seed,chapter,41)>.5,map=lane=>mirror?2-lane:lane,z=runnerRowZ(index),safe=map(template.safe);
 const obstacles=template.lanes.flatMap((kind,lane)=>kind?[{id:index+'-'+map(lane),z,lane:map(lane),kind,zone:zone.id}]:[]);
 const coins=[-12,-6,0,6,12].map((offset,i)=>({id:index+'-c'+i,z:z+offset,lane:safe,height:0,value:1,bonus:false}));
 if(template.bonus!==undefined){const kind=template.lanes[template.bonus];for(const [i,offset]of [-5,0,5].entries())coins.push({id:index+'-b'+i,z:z+offset,lane:map(template.bonus),height:kind==='arch'?0:i===1?1.8:1.1,value:2,bonus:true});}
 const item=slot===7?{kind:chapter%2?'board':'magnet',lane:safe,z:z+18}:null;
 return {index,z,safe,zone:zone.id,rest:obstacles.length===0,obstacles,coins,item};
}
export function routeScene(state,ahead=260){
 const start=Math.max(0,Math.floor((state.z-40)/ROUTE_LENGTH)*ROUTE_ROWS),end=Math.floor((state.z+ahead+20)/ROUTE_LENGTH)*ROUTE_ROWS+7;
 return Array.from({length:end-start+1},(_,i)=>routeRow(state.seed,start+i)).filter(r=>r.z+22>=state.z-4&&r.z-12<=state.z+ahead);
}
