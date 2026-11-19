import {clamp,noise,fingerprint} from './common.mjs';

export const SONGS=Object.freeze({bay:{id:'bay',name:'晚风起舞',bpm:96,key:57,phrases:20,description:'轻快合成流行'},metro:{id:'metro',name:'末班电车',bpm:120,key:50,phrases:24,description:'律动电子舞曲'}});
export const DIRECTIONS=['left','up','down','right'];
export const JUDGMENTS={perfect:{name:'Perfect',points:1000},great:{name:'Great',points:700},good:{name:'Good',points:400},miss:{name:'Miss',points:0}};
export function danceChart(songId='bay',level='practice',seed=41003){
 const song=SONGS[songId];if(!song||!['practice','standard'].includes(level))throw Error('未知歌曲或难度');
 const beat=60000/song.bpm,bar=beat*4;
 return Array.from({length:song.phrases},(_,i)=>({index:i,start:bar+i*bar,target:bar+i*bar+beat*3,end:bar+(i+1)*bar,keys:Array.from({length:(level==='practice'?3:4)+Math.min(level==='practice'?2:3,Math.floor(i/6))},(_,n)=>DIRECTIONS[Math.floor(noise(seed,i,n)*4)])}));
}
const dancer=()=>({score:0,combo:0,bestCombo:0,counts:{perfect:0,great:0,good:0,miss:0},last:null});
export function createDance({song='bay',difficulty='practice',seed=41003,offset=0}={}){
 const chart=danceChart(song,difficulty,seed);return {version:1,song,difficulty,seed:seed>>>0,offset:clamp(Number(offset)||0,-150,150),chart,time:0,phase:'playing',index:-1,entered:0,wrongAt:-1000,judged:[],aiJudged:[],players:[dancer(),dancer()]};
}
export function danceJudge(delta){const n=Math.abs(delta);return n<=55?'perfect':n<=110?'great':n<=180?'good':'miss';}
function score(s,actor,index,kind,delta,at=s.time){const p=s.players[actor];p.combo=kind==='miss'?0:p.combo+1;p.bestCombo=Math.max(p.bestCombo,p.combo);p.score+=Math.round(JUDGMENTS[kind].points*(1+Math.min(20,p.combo-1)*.04));p.counts[kind]++;p.last={index,kind,delta,at};(actor?s.aiJudged:s.judged).push(index);}
function copy(state){return {...state,judged:[...state.judged],aiJudged:[...state.aiJudged],players:state.players.map(p=>({...p,counts:{...p.counts}}))};}
function advance(s,time){
 s.time=Math.max(s.time,Math.max(0,Number(time)||0));
 for(const row of s.chart){
  if(!s.judged.includes(row.index)&&s.time>row.target+180+s.offset)score(s,0,row.index,'miss',null,row.target+180+s.offset);
  if(!s.aiJudged.includes(row.index)&&s.time>=row.target){const roll=noise(s.seed,row.index,27),kind=roll<(s.difficulty==='practice'?.24:.1)?'miss':roll<.5?'good':roll<.82?'great':'perfect';score(s,1,row.index,kind,null,row.target);}
 }
 const row=s.chart.find(row=>s.time>=row.start&&s.time<row.end),index=row?.index??-1;
 if(index!==s.index){s.index=index;s.entered=0;}
 if(s.time>=s.chart.at(-1).end){s.phase='finished';s.time=s.chart.at(-1).end;}
 return s;
}
export function advanceDance(state,time){if(state.phase==='finished')return state;return advance(copy(state),time);}
export function inputDance(state,key,time){
 const s=advanceDance(state,time);if(s===state||s.phase==='finished'||s.index<0||s.judged.includes(s.index)||!DIRECTIONS.includes(key))return s;
 const row=s.chart[s.index];if(s.entered>=row.keys.length)return s;
 if(key===row.keys[s.entered])s.entered++;else{s.entered=0;s.wrongAt=s.time;}return s;
}
export function confirmDance(state,time){
 const s=advanceDance(state,time);if(s===state||s.phase==='finished'||s.index<0||s.judged.includes(s.index))return s;
 const row=s.chart[s.index],delta=s.time-s.offset-row.target;
 score(s,0,s.index,s.entered===row.keys.length?danceJudge(delta):'miss',Math.round(delta));return s;
}
export function danceAccuracy(player,total){return total?Math.round((player.counts.perfect+player.counts.great*.7+player.counts.good*.4)/total*100):0;}
export function sealDance(options,inputs,state){return {format:'dance-1',game:'dance',options,inputs,end:{time:state.time,hash:fingerprint(state)}};}
export function replayDance(record){
 if(record?.format!=='dance-1'||record.game!=='dance'||!Array.isArray(record.inputs)||record.inputs.length>5000||!Number.isFinite(record.end?.time))throw Error('无效舞台回放');
 let s=createDance(record.options),last=0;if(record.end.time<0||record.end.time>s.chart.at(-1).end)throw Error('无效舞台时长');
 for(const input of record.inputs){if(!Number.isFinite(input.time)||input.time<last||input.time>record.end.time||!['confirm',...DIRECTIONS].includes(input.key))throw Error('无效舞台操作');last=input.time;s=input.key==='confirm'?confirmDance(s,input.time):inputDance(s,input.key,input.time);}
 s=advanceDance(s,record.end.time);if(fingerprint(s)!==record.end.hash)throw Error('舞台回放校验失败');return s;
}
