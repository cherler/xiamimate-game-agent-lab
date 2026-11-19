// Presentation time stays outside the deterministic game record.
export class ChessPhaseClock {
 constructor(now=()=>performance.now()){this.now=now;this.clear();}
 clear(){this.key=null;this.duration=0;this.remaining=0;this.paused=false;this.suspended=false;this.claimed=false;this.updated=this.now();}
 update(){const time=this.now();if(!this.paused&&!this.suspended)this.remaining=Math.max(0,this.remaining-Math.max(0,time-this.updated));this.updated=time;}
 enter(key,duration,checkpoint){
  if(this.key===key)return false;
  this.clear();this.key=key;this.duration=duration;this.remaining=duration;
  if(checkpoint?.key===key&&checkpoint.duration===duration&&Number.isFinite(checkpoint.remaining)&&checkpoint.remaining>=0&&checkpoint.remaining<=duration){this.remaining=checkpoint.remaining;this.paused=checkpoint.paused===true;}
  return true;
 }
 pause(value){this.update();this.paused=!!value;}
 suspend(value){this.update();this.suspended=!!value;}
 snapshot(){this.update();return {key:this.key,duration:this.duration,remaining:this.remaining,paused:this.paused};}
 consumeExpiry(){this.update();if(!this.key||!this.duration||this.remaining>0||this.paused||this.suspended||this.claimed)return false;this.claimed=true;return true;}
}

export function chessPresentationPhase(state,{review=null,watch=false}={}){
 if(watch)return {kind:'replay',duration:0,label:'回放'};
 if(state.phase==='ended')return {kind:'ended',duration:0,label:'本局结束'};
 if(state.players[0].loot)return {kind:'loot',duration:0,label:'选择装备'};
 if(review)return {kind:'settle',duration:5000,label:'下一轮'};
 if(state.phase==='battle')return {kind:'battle',duration:0,label:'战斗'};
 return {kind:'prep',duration:state.round===1?45000:30000,label:'准备'};
}
