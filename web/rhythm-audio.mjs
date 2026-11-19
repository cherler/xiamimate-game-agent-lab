import {DanceAudio} from './dance-audio.mjs';
import {rhythmArrangement} from '../src/rhythm-music.mjs';
export class RhythmAudio extends DanceAudio {
 async play(song,position=0){this.melody=rhythmArrangement(song.id);this.noteCursor=this.melody.findIndex(n=>n.at>=position);if(this.noteCursor<0)this.noteCursor=this.melody.length;return super.play(song,position);}
 schedule(){
  if(!this.running||!this.context)return;
  const step=60/this.song.bpm/2,limit=(this.song.phrases+1)*8,now=this.context.currentTime;
  while(this.next<limit&&this.startAt+this.next*step<now+.13){
   const n=this.next++,at=this.startAt+n*step;if(at<now-.01)continue;const beat=n%8,bar=Math.floor(n/8)-1;
   if(n<8){if(n%2===0)this.tone(beat===6?88:81,at,.06,.13,'sine');continue;}
   const root=this.song.key+[0,5,3,7][Math.floor(bar/2)%4];
   if(beat%4===0)this.tone(43,at,.17,.65,'sine',42);
   if(beat===2||beat===6){this.tone(68,at,.08,.12,'triangle');this.tone(105,at,.035,.065,'square');}
   this.tone(113+n%3,at,.025,beat%2?.02:.035,'square');
   if(beat%2===0)this.tone(root-12+(beat===4?7:0),at,step*1.55,.25,'triangle');
   if(!beat)for(const interval of [0,3,7])this.tone(root+12+interval,at,step*6,.035,'sine');
  }
  while(this.noteCursor<this.melody.length&&this.startAt+this.melody[this.noteCursor].at/1000<now+.13){
   const note=this.melody[this.noteCursor++],at=this.startAt+note.at/1000;if(at<now-.01)continue;
   this.tone(note.midi,at,note.duration?note.duration/1000:step*.7,.15,'triangle');
  }
 }
}
