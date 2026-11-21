// One looping recording at a time; pending decodes cannot restart an abandoned scene.
export class MusicPlayer {
 constructor(context,load){this.context=context;this.load=load;this.bus=context.createGain();this.bus.connect(context.destination);this.bus.gain.value=0;this.id=null;this.source=null;this.serial=0;this.positions=new Map();this.buffers=new Map();this.error='';}
 volume(value){this.bus.gain.setTargetAtTime(value,this.context.currentTime,.025);}
 async play(id){
  if(this.id===id)return;this.stop();if(!id)return;this.id=id;this.error='';const token=this.serial;
  try{
   let buffer=this.buffers.get(id);
   if(!buffer){const original=await this.load(this.context,id);buffer=this.context.createBuffer(original.numberOfChannels,original.length,original.sampleRate);
    // Tiny equal-length fades remove sample discontinuities without shifting the beat grid.
    const fade=Math.min(Math.floor(original.sampleRate*.012),Math.floor(original.length/2));
    for(let c=0;c<original.numberOfChannels;c++){const samples=buffer.getChannelData(c);samples.set(original.getChannelData(c));for(let i=0;i<fade;i++){samples[i]*=i/fade;samples[samples.length-1-i]*=i/fade;}}
    this.buffers.set(id,buffer);while(this.buffers.size>2)this.buffers.delete(this.buffers.keys().next().value);
   }
   if(token!==this.serial||id!==this.id)return;
   const source=this.context.createBufferSource(),gain=this.context.createGain(),at=this.context.currentTime,offset=(this.positions.get(id)||0)%buffer.duration;
   source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(this.bus);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(1,at+.12);
   source.start(at,offset);this.source={source,gain,at,offset,duration:buffer.duration,id};
  }catch{if(token===this.serial)this.error='音乐未能加载，点这里重试';}
 }
 stop(){this.serial++;this.id=null;const current=this.source;this.source=null;if(!current)return;const {source,gain,at,offset,duration,id}=current,now=this.context.currentTime;this.positions.set(id,(offset+Math.max(0,now-at))%duration);gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(gain.gain.value,now);gain.gain.linearRampToValueAtTime(0,now+.06);source.stop(now+.065);source.onended=()=>{source.disconnect();gain.disconnect();};}
}
