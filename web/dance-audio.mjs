// Original synthesized arrangements. The audio clock drives judgments and animation alike.
export class DanceAudio {
 constructor(){this.context=null;this.master=null;this.startAt=0;this.position=0;this.running=false;this.timer=null;this.sources=new Set();this.muted=true;this.next=0;this.song=null;this.serial=0;}
 async play(song,position=0){
  this.stop();const serial=this.serial;this.song=song;this.position=position;
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(Audio){this.context??=new Audio();await this.context.resume();if(serial!==this.serial)return false;if(!this.master){this.master=this.context.createGain();this.master.connect(this.context.destination);}this.master.gain.value=this.muted?0:.36;this.startAt=this.context.currentTime+.08-position/1000;}
  else this.startAt=performance.now()/1000-position/1000;
  this.running=true;const step=60/song.bpm/2;this.next=Math.ceil(position/1000/step);this.schedule();this.timer=setInterval(()=>this.schedule(),25);return true;
 }
 elapsed(){return this.running?Math.max(this.position,((this.context?.currentTime??performance.now()/1000)-this.startAt)*1000):this.position;}
 mute(value){this.muted=value;if(this.master)this.master.gain.setTargetAtTime(value?0:.36,this.context.currentTime,.015);}
 stop(){this.serial++;if(this.running)this.position=this.elapsed();this.running=false;clearInterval(this.timer);this.timer=null;for(const s of this.sources){try{s.stop();}catch{}}this.sources.clear();}
 tone(midi,at,duration,volume=.15,type='triangle',slide=0){
  if(!this.context)return;const o=this.context.createOscillator(),g=this.context.createGain(),freq=440*2**((midi-69)/12);o.type=type;o.frequency.setValueAtTime(freq,at);if(slide)o.frequency.exponentialRampToValueAtTime(slide,at+duration);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(this.master);this.sources.add(o);o.onended=()=>{this.sources.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(at+duration+.015);
 }
 schedule(){
  if(!this.running||!this.context)return;const step=60/this.song.bpm/2,limit=(this.song.phrases+1)*8;
  while(this.next<limit&&this.startAt+this.next*step<this.context.currentTime+.13){
   const n=this.next++,at=this.startAt+n*step;if(at<this.context.currentTime-.01)continue;
   const beat=n%8,bar=Math.floor(n/8)-1,key=this.song.key;
   if(n<8){if(n%2===0)this.tone(beat===6?88:81,at,.06,.13,'sine');continue;}
   const chord=[0,5,3,7][Math.floor(bar/2)%4],root=key+chord;
   if(beat%4===0)this.tone(43,at,.17,.7,'sine',42);
   if(beat===2||beat===6){this.tone(68,at,.08,.12,'triangle');this.tone(105,at,.035,.09,'square');}
   this.tone(113+(n%3),at,.025,beat%2?.025:.04,'square');
   if(beat%2===0)this.tone(root-12+(beat===4?7:0),at,step*1.55,.3,'triangle');
   if(beat===0)for(const interval of [0,3,7])this.tone(root+12+interval,at,step*6,.035,'sine');
   const melody=this.song.id==='bay'?[0,7,12,10,7,3,5,7]:[12,7,10,3,0,7,5,10];
   if(this.song.id==='metro'||beat%2===0)this.tone(root+12+melody[(beat+Math.floor(bar/4))%8],at,step*.7,.095,'triangle');
   // A light bell marks each phrase's fourth beat, matching the visible confirmation target.
   if(beat===6)this.tone(root+24,at,.13,.11,'sine');
  }
 }
}
