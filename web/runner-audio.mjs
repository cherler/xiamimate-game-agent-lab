// Short, locally synthesised effects share the arena's explicit sound switch.
export function createRunnerAudio(ctx){
 const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),samples=noise.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
 let wind=null;
 function hiss(duration,volume,frequency){
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),at=ctx.currentTime;
  source.buffer=noise;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start(at);source.stop(at+duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }
 function tone(start,end,duration,volume,type='sine'){
  const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime;osc.type=type;osc.frequency.setValueAtTime(start,at);osc.frequency.exponentialRampToValueAtTime(end,at+duration);gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 function stop(){if(!wind)return;const old=wind;wind=null;old.gain.gain.setTargetAtTime(0,ctx.currentTime,.02);old.source.stop(ctx.currentTime+.12);old.source.onended=()=>{old.source.disconnect();old.filter.disconnect();old.gain.disconnect();};}
 return {stop,
  update({speed=0,rolling=false}){
   if(speed<=0){stop();return;}
   if(!wind){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=noise;source.loop=true;filter.type='bandpass';filter.Q.value=.55;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();wind={source,filter,gain};}
   wind.filter.frequency.setTargetAtTime(rolling?450:650+speed*13,ctx.currentTime,.1);wind.gain.gain.setTargetAtTime(Math.min(.035,speed*.0006),ctx.currentTime,.12);
  },
  cue(kind){
   if(kind==='runner-crash'){stop();hiss(.22,.19,900);tone(150,42,.32,.2,'triangle');}
   else if(kind==='runner-saved'){hiss(.26,.11,3600);tone(760,160,.24,.08,'triangle');}
   else if(kind==='runner-jump'){hiss(.13,.045,2300);tone(220,410,.13,.035);}
   else if(kind==='runner-roll'){hiss(.2,.065,650);}
   else if(kind==='runner-go'){tone(420,740,.19,.05);}
  }
 };
}
