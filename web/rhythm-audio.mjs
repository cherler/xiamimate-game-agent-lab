import {DanceAudio} from './dance-audio.mjs';
import {rhythmArrangement,rhythmChart} from '../src/rhythm-music.mjs';
import {audibleTime} from './audio-clock.mjs';
import {loadMusic} from './music-assets.mjs';
export class RhythmAudio extends DanceAudio {
 constructor(){super();this.level=.7;this.version=2;this.lastElapsed=0;}
 async play(song,position=0,{version=2,difficulty='practice'}={}){
  this.stop();this.version=version;this.lastElapsed=position;
  this.melody=version===1?rhythmArrangement(song.id,1):rhythmChart(song.id,difficulty,2);
  this.noteCursor=this.melody.findIndex(n=>n.at+(n.duration||120)>position);if(this.noteCursor<0)this.noteCursor=this.melody.length;
  if(!song.recorded){const ready=await super.play(song,position);this.setVolume(this.level);return ready;}
  this.stop();const serial=this.serial;this.song=song;this.position=position;
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Audio)throw Error('此浏览器不支持音乐播放');
  this.context??=new Audio({latencyHint:'interactive'});await this.context.resume();
  const buffer=await loadMusic(this.context,song.id);if(serial!==this.serial)return false;
  if(!this.master){this.master=this.context.createGain();this.master.connect(this.context.destination);}
  this.setVolume(this.level);this.startAt=this.context.currentTime+.12-position/1000;this.running=true;this.lastElapsed=position;
  const intro=4*60/song.bpm,offset=Math.max(0,position/1000-intro),source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.master);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();};
  if(offset<buffer.duration)source.start(this.startAt+Math.max(position/1000,intro),offset);
  this.next=Math.ceil(position/1000/(60/song.bpm/2));this.schedule();this.timer=setInterval(()=>this.schedule(),25);return true;
 }
 elapsed(){if(!this.running)return this.position;const now=this.context?audibleTime(this.context):performance.now()/1000;return this.lastElapsed=Math.max(this.position,this.lastElapsed,(now-this.startAt)*1000);}
 setVolume(value){this.level=Math.max(0,Math.min(1,value));if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.level*(this.song?.recorded?.9:.7),this.context.currentTime,.015);}
 mute(value){this.muted=value;this.setVolume(this.level);}
 lead(note,at,duration){
  const ctx=this.context,o=ctx.createOscillator(),g=ctx.createGain();o.type=this.song.id==='forest'?'sine':'triangle';o.frequency.value=440*2**((note.midi-69)/12);const v=this.song.id==='forest'?.27:.21,end=at+duration;
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(v,at+.008);
  if(note.duration){g.gain.linearRampToValueAtTime(v*.78,at+.04);g.gain.setValueAtTime(v*.78,Math.max(at+.04,end-.045));g.gain.linearRampToValueAtTime(0,end);}
  else g.gain.exponentialRampToValueAtTime(.0001,end);
  o.connect(g);g.connect(this.master);this.sources.add(o);o.onended=()=>{this.sources.delete(o);o.disconnect();g.disconnect();};o.start(at);o.stop(end+.005);
 }
 schedule(){
  if(!this.running||!this.context)return;
  const step=60/this.song.bpm/2,limit=this.song.recorded?8:(this.song.phrases+1)*8,now=this.context.currentTime;
  while(this.next<limit&&this.startAt+this.next*step<now+.15){
   const n=this.next++,at=this.startAt+n*step;if(at<now-.01)continue;const beat=n%8,bar=Math.floor(n/8)-1;
   if(n<8){if(n%2===0)this.tone(beat===6?88:81,at,.06,.14,'sine');continue;}
   const major=['bay','forest'].includes(this.song.id),root=this.song.key+[0,5,major?7:3,7][Math.floor(bar/2)%4];
   if(beat%4===0)this.tone(43,at,.16,.38,'sine',42);
   if(beat===2||beat===6)this.tone(68,at,.065,.07,'triangle');
   if(beat%2===0)this.tone(root-12+(beat===4?7:0),at,step*1.4,.12,'triangle');
   if(!beat)for(const interval of [0,major?4:3,7])this.tone(root+12+interval,at,step*6,.022,'sine');
  }
  if(this.song.recorded)return;
  while(this.noteCursor<this.melody.length&&this.startAt+this.melody[this.noteCursor].at/1000<now+.15){
   const note=this.melody[this.noteCursor++],original=this.startAt+note.at/1000,duration=note.duration?note.duration/1000:step*.55,at=Math.max(original,now+.002),remaining=original+duration-at;if(remaining<.05)continue;
   if(this.version===1)this.tone(note.midi,at,remaining,.15,'triangle');else this.lead(note,at,remaining);
  }
 }
}
