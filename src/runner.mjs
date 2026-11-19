import {clamp,fingerprint} from './common.mjs';
import * as legacy from './runner-v1.mjs';
import {routeRow,routeScene,runnerRowZ} from './runner-routes.mjs';
export {runnerRoute,RUNNER_ZONES} from './runner-routes.mjs';
export const RUNNER_DT=1/60,ROW_SPACE=40;
export const RUNNER_ACTIONS=['left','right','jump','roll','board'];
export const runnerRow=(seed,index,rules=2)=>rules===1?legacy.runnerRow(seed,index):routeRow(seed,index);
export const runnerScene=(state,ahead=260)=>state.version===1?legacy.runnerScene(state,ahead):routeScene(state,ahead);
export function createRunner({seed=41003,difficulty='practice',rules=2}={}){
 if(rules===1)return legacy.createRunner({seed,difficulty});if(rules!==2)throw Error('未知跑酷版本');
 if(!['practice','standard'].includes(difficulty))throw Error('未知跑酷难度');
 return {version:2,seed:seed>>>0,difficulty,tick:0,time:0,countdown:3,phase:'countdown',z:0,speed:0,lane:1,x:1,jump:-1,roll:0,board:0,boards:1,magnet:0,invincible:0,coins:0,score:0,cleared:[],events:[],reason:null};
}
export const jumpHeight=s=>s.jump<0?0:Math.sin(Math.PI*clamp(s.jump/.96,0,1))*2.3;
export function stepRunner(state,actions=[]){
 if(state.version===1)return legacy.stepRunner(state,actions);
 if(state.phase==='finished')return state;
 const s={...state,tick:state.tick+1,events:[],cleared:[...state.cleared]};
 if(s.countdown>0){s.countdown=Math.max(0,3-s.tick*RUNNER_DT);if(!s.countdown){s.phase='running';s.events.push({kind:'go'});}return s;}
 s.time=state.time+RUNNER_DT;
 for(const action of [...new Set(actions)]){
  if(action==='left')s.lane=Math.max(0,s.lane-1);else if(action==='right')s.lane=Math.min(2,s.lane+1);
  else if(action==='jump'&&s.jump<0){s.jump=0;s.roll=0;s.events.push({kind:'jump'});}
  else if(action==='roll'){s.roll=.72;s.jump=-1;s.events.push({kind:'roll'});}
  else if(action==='board'&&s.boards>0&&s.board<=0){s.boards--;s.board=10;s.events.push({kind:'board'});}
 }
 s.x+=clamp(s.lane-s.x,-RUNNER_DT*7,RUNNER_DT*7);
 if(s.jump>=0){s.jump+=RUNNER_DT;if(s.jump>=.96)s.jump=-1;}
 for(const key of ['roll','board','magnet','invincible'])s[key]=Math.max(0,s[key]-RUNNER_DT);
 s.speed=Math.min(s.difficulty==='practice'?27:34,(s.difficulty==='practice'?16:20)+s.time*.095);s.z=state.z+s.speed*RUNNER_DT;
 const rows=runnerScene(s,30);
 for(const row of rows){
  for(const coin of row.coins)if(state.z<coin.z&&s.z>=coin.z&&((Math.abs(s.x-coin.lane)<.42&&(coin.bonus&&coin.height>0?jumpHeight(s)>.45:Math.abs(jumpHeight(s)-coin.height)<.85))||s.magnet>0)){s.coins+=coin.value;s.events.push({kind:'coin',lane:coin.lane,value:coin.value});}
  const item=row.item;if(item&&state.z<item.z&&s.z>=item.z&&Math.abs(s.x-item.lane)<.42){if(item.kind==='magnet')s.magnet=10;else s.boards=Math.min(3,s.boards+1);s.events.push({kind:item.kind==='magnet'?'magnet':'pickup-board'});}
  for(const o of row.obstacles){
   const before=o.kind==='train'?2:1.6,after=o.kind==='train'?12:1.6;
   if(s.z<o.z-before||s.z>o.z+after||Math.abs(s.x-o.lane)>.43||s.cleared.includes(o.id))continue;
   const safe=o.kind==='barrier'?jumpHeight(s)>.9:o.kind==='arch'?s.roll>0:o.kind==='gap'?jumpHeight(s)>.65:false;
   if(safe||s.invincible>0)continue;
   if(s.board>0){s.board=0;s.invincible=1.1;s.cleared.push(o.id);s.events.push({kind:'saved',obstacle:o.kind,lane:o.lane});}
   else{s.phase='finished';s.reason={kind:o.kind,lane:o.lane};s.events.push({kind:'crash',obstacle:o.kind,lane:o.lane});break;}
  }
  if(s.phase==='finished')break;
 }
 s.cleared=s.cleared.filter(id=>runnerRowZ(Number(id.split('-')[0]))>s.z-16);s.score=Math.floor(s.z)+s.coins*15;return s;
}
export function sealRunner(options,inputs,state){if(state.version===1)return legacy.sealRunner(options,inputs,state);return {format:'runner-2',game:'runner',options:{...options,rules:2},inputs,end:{tick:state.tick,hash:fingerprint(state)}};}
export function replayRunner(record){
 if(record?.format==='runner-1')return legacy.replayRunner(record);
 if(record?.format!=='runner-2'||record.game!=='runner'||record.options?.rules!==2||!Array.isArray(record.inputs)||record.inputs.length>40000||!Number.isInteger(record.end?.tick)||record.end.tick<0||record.end.tick>108000)throw Error('无效跑酷回放');
 let s=createRunner(record.options),cursor=0,last=-1;
 for(const row of record.inputs){if(!Number.isInteger(row.tick)||row.tick<=last||row.tick>=record.end.tick||!Array.isArray(row.actions)||row.actions.length>5||row.actions.some(a=>!RUNNER_ACTIONS.includes(a)))throw Error('无效跑酷操作');last=row.tick;}
 while(s.tick<record.end.tick){const actions=record.inputs[cursor]?.tick===s.tick?record.inputs[cursor++].actions:[],next=stepRunner(s,actions);if(next===s)throw Error('跑酷结束后的操作');s=next;}
 if(fingerprint(s)!==record.end.hash)throw Error('跑酷回放校验失败');return s;
}
