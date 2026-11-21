import {clamp,noise,fingerprint} from './common.mjs';
import {rhythmChart,rhythmDuration} from './rhythm-music.mjs';
export const RHYTHM_WINDOW=160;
export const RHYTHM_JUDGMENTS={perfect:{name:'Perfect',points:1000},great:{name:'Great',points:700},good:{name:'Good',points:400},miss:{name:'Miss',points:0}};
export const rhythmJudge=delta=>Math.abs(delta)<=50?'perfect':Math.abs(delta)<=100?'great':Math.abs(delta)<=RHYTHM_WINDOW?'good':'miss';
const player=()=>({score:0,combo:0,bestCombo:0,counts:{perfect:0,great:0,good:0,miss:0},last:null});
export function createRhythm({song='bay',difficulty='practice',seed=41003,offset=0,version=2}={}){
 if(![1,2].includes(version))throw Error('未知音符版本');const notes=rhythmChart(song,difficulty,version);
 return {version,song,difficulty,seed:seed>>>0,offset:clamp(Number(offset)||0,-150,150),notes,duration:rhythmDuration(song,version),time:0,phase:'playing',held:[false,false,false,false],holds:[null,null,null,null],judgments:notes.map(()=>null),aiJudged:notes.map(()=>false),players:[player(),player()],feedback:null};
}
function copy(s){return {...s,held:[...s.held],holds:s.holds.map(h=>h&&({...h})),judgments:[...s.judgments],aiJudged:[...s.aiJudged],players:s.players.map(p=>({...p,counts:{...p.counts}}))};}
function score(s,actor,n,kind,at,delta=null,reason=''){
 const p=s.players[actor];p.combo=kind==='miss'?0:p.combo+1;p.bestCombo=Math.max(p.bestCombo,p.combo);p.score+=Math.round(RHYTHM_JUDGMENTS[kind].points*(n.duration?1.5:1)*(1+Math.min(30,Math.max(0,p.combo-1))*.02));p.counts[kind]++;p.last={id:n.id,lane:n.lane,kind,at,delta,reason};
 if(actor)s.aiJudged[n.id]=true;else{s.judgments[n.id]=kind;s.holds[n.lane]=s.holds[n.lane]?.id===n.id?null:s.holds[n.lane];s.feedback={...p.last};}
}
export function advanceRhythm(state,time){
 if(state.phase==='finished')return state;
 const s=copy(state);s.time=clamp(Math.max(s.time,Number(time)||0),0,s.duration);const due=[];
 for(const n of s.notes){
  const h=s.holds[n.lane];
  if(!s.judgments[n.id]){
   if(h?.id===n.id&&s.time>=n.at+n.duration+s.offset)due.push({at:n.at+n.duration+s.offset,actor:0,n,kind:h.kind,delta:h.delta});
   else if(h?.id!==n.id&&s.time>n.at+s.offset+RHYTHM_WINDOW)due.push({at:n.at+s.offset+RHYTHM_WINDOW,actor:0,n,kind:'miss',reason:'漏拍'});
  }
  if(!s.aiJudged[n.id]&&s.time>=n.at+n.duration){const r=noise(s.seed,n.id,43),kind=r<(s.difficulty==='practice'?.2:.08)?'miss':r<.4?'good':r<.77?'great':'perfect';due.push({at:n.at+n.duration,actor:1,n,kind});}
 }
 for(const e of due.sort((a,b)=>a.at-b.at||a.actor-b.actor||a.n.id-b.n.id))score(s,e.actor,e.n,e.kind,e.at,e.delta??null,e.reason||'');
 if(s.time>=s.duration){s.phase='finished';s.held.fill(false);}
 return s;
}
export function pressRhythm(state,lane,time){
 const s=advanceRhythm(state,time);if(!Number.isInteger(lane)||lane<0||lane>3||s.phase==='finished'||s.held[lane])return s;s.held[lane]=true;
 const n=s.notes.filter(n=>n.lane===lane&&!s.judgments[n.id]&&s.holds[lane]?.id!==n.id&&Math.abs(s.time-s.offset-n.at)<=RHYTHM_WINDOW).sort((a,b)=>Math.abs(s.time-s.offset-a.at)-Math.abs(s.time-s.offset-b.at)||a.id-b.id)[0];
 if(!n){s.feedback={kind:'empty',lane,at:s.time,reason:'等音符到亮线'};return s;}
 const delta=Math.round(s.time-s.offset-n.at),kind=rhythmJudge(delta);
 if(n.duration){s.holds[lane]={id:n.id,kind,delta};s.feedback={kind:'hold',lane,at:s.time,reason:'按住'};}
 else score(s,0,n,kind,s.time,delta);
 return s;
}
export function releaseRhythm(state,lane,time){
 const s=advanceRhythm(state,time);if(!Number.isInteger(lane)||lane<0||lane>3||s.phase==='finished')return s;s.held[lane]=false;const h=s.holds[lane];
 if(h){const n=s.notes[h.id],complete=s.time>=n.at+n.duration+s.offset-80;score(s,0,n,complete?h.kind:'miss',s.time,h.delta,complete?'长按完成':'松手太早');}
 return s;
}
export const rhythmAccuracy=p=>{const count=Object.values(p.counts).reduce((a,b)=>a+b,0);return count?Math.round((p.counts.perfect+p.counts.great*.7+p.counts.good*.4)/count*100):100;};
export function sealRhythm(options,inputs,state){return {format:'rhythm-'+state.version,game:'dance',options,inputs,end:{time:state.time,hash:fingerprint(state)}};}
export function replayRhythm(record){
 if(!['rhythm-1','rhythm-2'].includes(record?.format)||record.game!=='dance'||!Array.isArray(record.inputs)||record.inputs.length>12000||!Number.isFinite(record.end?.time))throw Error('无效音符回放');
 let s=createRhythm({...record.options,version:record.format==='rhythm-1'?1:2}),last=0;if(record.end.time<0||record.end.time>s.duration)throw Error('无效音符时长');
 for(const e of record.inputs){if(!Number.isFinite(e.time)||e.time<last||e.time>record.end.time||!Number.isInteger(e.lane)||e.lane<0||e.lane>3||!['down','up'].includes(e.type))throw Error('无效音符操作');last=e.time;s=e.type==='down'?pressRhythm(s,e.lane,e.time):releaseRhythm(s,e.lane,e.time);}
 s=advanceRhythm(s,record.end.time);if(fingerprint(s)!==record.end.hash)throw Error('音符回放校验失败');return s;
}
