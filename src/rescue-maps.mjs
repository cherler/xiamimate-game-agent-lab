export const RESCUE_HZ = 30;
export const UPGRADES = {
 fire: {name:'强化火力',icon:'fire',text:'全队伤害 +20%',color:'#efb95e'},
 mobility: {name:'轻装行军',icon:'move',text:'军队与护送平民速度 +18%',color:'#75c3e5'},
 gate: {name:'加固门障',icon:'gate',text:'门障 +1，耐久 +60%',color:'#8bd8b7'}
};
function map(id,name,mode,seconds,total,quota,vertical,horizontal,doors,groups,entrances,waves){
 const w=24,h=16,tiles=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>x===0||y===0||x===w-1||y===h-1?'#':'.'));
 for(const x of vertical)for(let y=1;y<h-1;y++)tiles[y][x]='#';
 for(const y of horizontal)for(let x=1;x<w-1;x++)tiles[y][x]='#';
 for(const [x,y] of doors)tiles[y][x]='.';
 return {id,name,mode,seconds,total,quota,w,h,tiles:tiles.map(row=>row.join('')),doors:doors.map(([x,y],i)=>({id:'door'+i,x:x+.5,y:y+.5,cell:y*w+x,vertical:vertical.includes(x)})),groups,entrances,waves,
   exit:{x:1.5,y:10.5,w:4.4,h:3.5},spawn:[{x:4.3,y:11.5,group:0},{x:5.1,y:11.5,group:0},{x:4.3,y:12.3,group:1},{x:5.1,y:12.3,group:1},{x:5.4,y:10.7,group:2}],
   labels:id===1?[{x:4,y:3,text:'接应站'},{x:12,y:12,text:'中央走廊'},{x:20,y:3,text:'候救区'}]:id===2?[{x:5,y:3,text:'旧仓库'},{x:18,y:3,text:'东侧庭院'},{x:18,y:12,text:'候救大厅'}]:[{x:4,y:3,text:'北仓'},{x:12,y:3,text:'连廊'},{x:20,y:3,text:'东馆'},{x:12,y:12,text:'南仓'},{x:20,y:12,text:'居民区'}]};
}
export const RESCUE_MAPS = [
 map(1,'走廊接应','hold',60,10,8,[8,16],[],[[8,8],[16,8]],
  [{x:19,y:7,n:10}], [{x:12.5,y:1.5,name:'北口'}],
  [{at:9,entry:0,count:6,fast:0},{at:23,entry:0,count:6,fast:0},{at:40,entry:0,count:6,fast:0}]),
 map(2,'双门夹击','hold',90,15,12,[12],[8],[[12,4],[12,11],[5,8],[19,8]],
  [{x:18,y:11,n:9},{x:17,y:4,n:6}], [{x:5.5,y:1.5,name:'西北口'},{x:21.5,y:1.5,name:'东北口'}],
  [{at:10,entry:0,count:8,fast:0},{at:29,entry:1,count:8,fast:1},{at:48,entry:0,count:8,fast:1},{at:67,entry:1,count:8,fast:2}]),
 map(3,'分区清剿','clear',120,20,16,[8,16],[8],[[8,4],[8,12],[16,4],[16,12],[4,8],[12,8],[20,8]],
  [{x:19,y:11,n:10},{x:19,y:4,n:10}], [{x:3.5,y:1.5,name:'北仓入口'},{x:12.5,y:1.5,name:'连廊入口'},{x:21.5,y:1.5,name:'东馆入口'}],
  [{at:12,entry:0,count:8,fast:0},{at:30,entry:1,count:9,fast:1},{at:50,entry:2,count:9,fast:2},{at:71,entry:0,count:10,fast:2},{at:92,entry:2,count:12,fast:3}])
];
export function rescueMap(id,version=2){
 const map=RESCUE_MAPS.find(m=>m.id===id);if(!map)throw Error('关卡不存在');
 if(id===2&&version>=2)return {...map,waves:[{at:5,entry:1,count:6,fast:1},{at:15,entry:0,count:8,fast:1},{at:33,entry:1,count:8,fast:1},{at:50,entry:0,count:10,fast:2}]};
 return map;
}
export const insideExit=(m,u)=>u.x>=m.exit.x&&u.x<=m.exit.x+m.exit.w&&u.y>=m.exit.y&&u.y<=m.exit.y+m.exit.h;
