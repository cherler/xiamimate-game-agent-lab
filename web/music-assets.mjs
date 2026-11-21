import street from '../assets/music/street.mp3';
import raspberry from '../assets/music/raspberry.mp3';
import raceway from '../assets/music/raceway.mp3';
import skyline from '../assets/music/skyline.mp3';
import calm from '../assets/music/calm.mp3';
import tension from '../assets/music/tension.mp3';
import xiami from '../assets/music/xiami.mp3';
export const MUSIC_URLS={street,raspberry,raceway,skyline,calm,tension,xiami};
const buffers=new WeakMap();
export async function loadMusic(context,id){
 let cache=buffers.get(context);if(!cache){cache=new Map();buffers.set(context,cache);}
 if(!MUSIC_URLS[id])throw Error('未知配乐');
 if(!cache.has(id)){const task=fetch(MUSIC_URLS[id]).then(r=>{if(!r.ok)throw Error('音乐读取失败');return r.arrayBuffer();}).then(data=>context.decodeAudioData(data));cache.set(id,task);while(cache.size>2)cache.delete(cache.keys().next().value);task.catch(()=>{if(cache.get(id)===task)cache.delete(id);});}
 return cache.get(id);
}
