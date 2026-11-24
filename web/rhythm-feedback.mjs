export class RhythmFeedback {
 constructor(){this.lanes=Array(4).fill(null);this.samples=[];this.earlyRelease=0;this.missed=0;}
 capture(before,after){
  const completed=[];
  for(const n of after.notes){
   const kind=after.judgments[n.id];if(!kind||before.judgments[n.id])continue;
   const last=after.players[0].last,held=before.holds[n.lane];
   const f=last?.id===n.id?last:{id:n.id,lane:n.lane,kind,at:after.time,delta:held?.id===n.id?held.delta:null,reason:kind==='miss'?'漏拍':'长按完成'};
   this.lanes[n.lane]=f;completed.push(f);
   if(kind!=='miss'&&Number.isFinite(f.delta))this.samples.push(f.delta);
   if(f.reason==='松手太早')this.earlyRelease++;else if(kind==='miss')this.missed++;
  }
  if(after.feedback!==before.feedback&&['hold','empty'].includes(after.feedback?.kind))this.lanes[after.feedback.lane]=after.feedback;
  return completed;
 }
 summary(offset=0){
  const sorted=[...this.samples].sort((a,b)=>a-b),median=values=>values.length?values[Math.floor(values.length/2)]:0;
  const center=median(sorted),spread=median(sorted.map(v=>Math.abs(v-center)).sort((a,b)=>a-b));
  return {early:sorted.filter(v=>v< -25).length,onTime:sorted.filter(v=>Math.abs(v)<=25).length,late:sorted.filter(v=>v>25).length,
   earlyRelease:this.earlyRelease,missed:this.missed,
   // A noisy handful of taps is not evidence of a device timing offset.
   suggested:sorted.length>=12&&spread<=30&&Math.abs(center)>=20?Math.max(-150,Math.min(150,Math.round((offset+center)/10)*10)):null};
 }
}
