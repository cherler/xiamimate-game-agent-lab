import {SONGS} from './dance.mjs';

export {SONGS};
const motifs=[[0,1,2,1,3,2,1,0],[0,2,1,3,2,0,3,1],[3,2,1,2,0,1,2,3],[1,0,2,3,1,2,0,3]];
// The audible lead and the playable chart are two views of this same arrangement.
export function rhythmArrangement(songId='bay'){
 const song=SONGS[songId];if(!song)throw Error('未知歌曲');
 const beat=60000/song.bpm,notes=[],free=[0,0,0,0];
 for(let bar=0;bar<song.phrases;bar++)for(let slot=0;slot<8;slot++){
  const at=(4+bar*4+slot/2)*beat,lane=motifs[Math.floor(bar/2)%4][(slot+(songId==='metro'?2:0))%8],offbeat=slot%2===1;
  if(offbeat&&(songId==='bay'&&bar%2===0||bar<2))continue;
  if(at<free[lane]+60)continue;
  const duration=bar%4===2&&slot===4?beat*1.5:0,root=song.key+[0,5,3,7][Math.floor(bar/2)%4];
  notes.push({id:notes.length,at,lane,midi:root+12+[0,3,7,12][lane],duration,offbeat});free[lane]=at+duration;
  if(bar>=6&&bar%4===3&&slot===0){const other=(lane+2)%4;if(at>=free[other]+60){notes.push({id:notes.length,at,lane:other,midi:root+12+[0,3,7,12][other],duration:0,offbeat:false});free[other]=at;}}
 }
 return notes.sort((a,b)=>a.at-b.at||a.lane-b.lane).map((n,id)=>({...n,id}));
}
export function rhythmChart(song='bay',difficulty='practice'){
 if(!['practice','standard'].includes(difficulty))throw Error('未知谱面难度');
 return rhythmArrangement(song).filter(n=>difficulty==='standard'||!n.offbeat).map((n,id)=>({...n,id}));
}
export const rhythmDuration=song=>(SONGS[song].phrases+1)*4*60000/SONGS[song].bpm+500;
