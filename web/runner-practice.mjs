export function runnerMistake(state,lastJump=-Infinity,lastRoll=-Infinity){
 const kind=state.reason?.kind;
 if(['barrier','gap'].includes(kind)){
  if(state.roll>0)return '这里要跳跃 ↑';
  if(state.jump>=0)return state.jump<.39?'跳晚了 · 提前一点 ↑':'跳早了 · 靠近再跳 ↑';
  if(state.time-lastJump<1.25)return '跳早了 · 落地后才撞上';
  return '跳跃 ↑ 或换道 ↔';
 }
 if(kind==='arch')return state.time-lastRoll<1?'翻滚早了 · 靠近再滑 ↓':'横梁下翻滚 ↓';
 if(kind==='train')return '大障碍需要换道 ↔';
 return '';
}
export class RunnerPractice {
 constructor(){this.frames=[];this.lastJump=-Infinity;this.lastRoll=-Infinity;}
 capture(state){
  if(state.events.some(e=>e.kind==='jump'))this.lastJump=state.time;
  if(state.events.some(e=>e.kind==='roll'))this.lastRoll=state.time;
  if(state.phase!=='running'||state.tick%15)return;
  this.frames.push({state:structuredClone(state),lastJump:this.lastJump,lastRoll:this.lastRoll});
  this.frames=this.frames.filter(f=>state.tick-f.state.tick<=240);
 }
 checkpoint(tick){return this.frames.findLast(f=>f.state.tick<=tick-180)||this.frames[0]||null;}
}
