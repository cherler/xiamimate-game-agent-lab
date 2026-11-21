import {SONGS as LEGACY,rhythmArrangement as legacyArrangement,rhythmChart as legacyChart,rhythmDuration as legacyDuration} from './rhythm-music-v1.mjs';
import recorded from './rhythm-recorded.json' with {type:'json'};
export const SONGS=Object.freeze({...LEGACY,bay:{...LEGACY.bay,description:'海港 · 轻快合成旋律'},metro:{...LEGACY.metro,description:'都市 · 合成器律动'},
 forest:{id:'forest',name:'林间铃语',bpm:108,key:60,phrases:20,description:'钟琴 · 轻快旋律'},
 neon:{id:'neon',name:'霓虹跃动',bpm:132,key:55,phrases:24,description:'电子 · 切分律动'},
 street:{id:'street',name:'晴日街角',bpm:144,description:'My Street · congusbongus',recorded:true,duration:recorded.street.clipDuration*1000},
 raspberry:{id:'raspberry',name:'果酱律动',bpm:112,description:'Raspberry Jam · congusbongus',recorded:true,duration:recorded.raspberry.clipDuration*1000}
});
const motifs=[[0,1,2,1,3,2,1,0],[0,2,1,3,2,0,3,1],[3,2,1,2,0,1,2,3],[1,0,2,3,1,2,0,3]];
export function rhythmArrangement(songId='bay',version=2){
 if(version===1)return legacyArrangement(songId);
 const song=SONGS[songId];if(!song)throw Error('未知歌曲');const beat=60000/song.bpm;
 if(song.recorded)return recorded[songId].notes.map((n,id)=>({...n,id,at:n.at+beat*4}));
 const notes=[],free=[-1000,-1000,-1000,-1000],major=['bay','forest'].includes(songId),scale=major?[0,4,7,12]:[0,3,7,10];
 for(let bar=0;bar<song.phrases;bar++)for(let slot=0;slot<8;slot++){
  const offbeat=slot%2===1;if(offbeat&&(bar<2||songId==='bay'&&bar%2===0||songId==='forest'&&bar%4!==3))continue;
  const lane=motifs[(Math.floor(bar/2)+(songId==='forest'?1:songId==='neon'?2:0))%4][(slot+(songId==='metro'?2:0))%8],at=(4+bar*4+slot/2)*beat;
  if(at<free[lane]+90)continue;
  const duration=bar%4===2&&slot===4?beat*1.5:bar%4===1&&slot===0?beat*1.5:0,root=song.key+[0,5,major?7:3,7][Math.floor(bar/2)%4];
  notes.push({at,lane,midi:root+12+scale[lane],duration,offbeat});free[lane]=at+duration;
  if(bar>=6&&bar%4===3&&slot===0){const other=(lane+2)%4;if(at>free[other]+90){notes.push({at,lane:other,midi:root+12+scale[other],duration:0,offbeat:false});free[other]=at;}}
 }
 return notes.sort((a,b)=>a.at-b.at||a.lane-b.lane).map((n,id)=>({...n,id}));
}
export function rhythmChart(song='bay',difficulty='practice',version=2){
 if(version===1)return legacyChart(song,difficulty);
 if(!['practice','standard'].includes(difficulty))throw Error('未知谱面难度');
 return rhythmArrangement(song).filter(n=>difficulty==='standard'||!n.offbeat||n.duration>0).map((n,id)=>({...n,id}));
}
export function rhythmDuration(song,version=2){if(version===1)return legacyDuration(song);const s=SONGS[song];if(!s)throw Error('未知歌曲');return s.recorded?4*60000/s.bpm+s.duration+500:(s.phrases+1)*4*60000/s.bpm+500;}
