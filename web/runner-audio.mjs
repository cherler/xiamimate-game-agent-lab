// Short, locally synthesised effects share the arena's explicit sound switch.
export function createRunnerAudio(ctx,destination=ctx.destination){
 const noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),samples=noise.getChannelData(0);
 for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;

 function hiss(duration,volume,frequency){
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),at=ctx.currentTime;
  source.buffer=noise;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter);filter.connect(gain);gain.connect(destination);source.start(at);source.stop(at+duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }
 function tone(start,end,duration,volume,type='sine'){
  const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime;osc.type=type;osc.frequency.setValueAtTime(start,at);osc.frequency.exponentialRampToValueAtTime(end,at+duration);gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(gain);gain.connect(destination);osc.start(at);osc.stop(at+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 function stop(){}
 return {stop,update(){},
  cue(kind){
   if(kind==='runner-crash'){stop();hiss(.22,.19,900);tone(150,42,.32,.2,'triangle');}
   else if(kind==='runner-saved'){hiss(.26,.11,3600);tone(760,160,.24,.08,'triangle');}
   else if(kind==='runner-jump'){hiss(.13,.045,2300);tone(220,410,.13,.035);}
   else if(kind==='runner-roll'){hiss(.2,.065,650);}
   else if(kind==='runner-step'){hiss(.04,.035,700);tone(110,65,.055,.026);}
   else if(kind==='runner-land'){hiss(.09,.07,850);tone(145,60,.12,.05,'triangle');}
   else if(kind==='runner-go'){tone(420,740,.19,.05);}
  }
 };
}
