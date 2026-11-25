export const RESCUE_HZ = 30;
export const UPGRADES = {
 fire: {name:'强化火力',icon:'fire',text:'全队伤害 +20%',color:'#efb95e'},
 mobility: {name:'轻装行军',icon:'move',text:'军队与护送平民速度 +18%',color:'#75c3e5'},
 gate: {name:'加固门障',icon:'gate',text:'门障 +1，耐久 +60%',color:'#8bd8b7'}
};
function roomMap(id,name,mode,seconds,total,quota,vertical,horizontal,doors,groups,entrances,waves){
 const w=24,h=16,tiles=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>x===0||y===0||x===w-1||y===h-1?'#':'.'));
 for(const x of vertical)for(let y=1;y<h-1;y++)tiles[y][x]='#';
 for(const y of horizontal)for(let x=1;x<w-1;x++)tiles[y][x]='#';
 for(const [x,y] of doors)tiles[y][x]='.';
 return {id,name,mode,seconds,total,quota,w,h,tiles:tiles.map(row=>row.join('')),doors:doors.map(([x,y],i)=>({id:'door'+i,x:x+.5,y:y+.5,cell:y*w+x,vertical:vertical.includes(x)})),groups,entrances,waves,
   exit:{x:1.5,y:10.5,w:4.4,h:3.5},spawn:[{x:4.3,y:11.5,group:0},{x:5.1,y:11.5,group:0},{x:4.3,y:12.3,group:1},{x:5.1,y:12.3,group:1},{x:5.4,y:10.7,group:2}],
   labels:id===1?[{x:4,y:3,text:'接应站'},{x:12,y:12,text:'中央走廊'},{x:20,y:3,text:'候救区'}]:id===2?[{x:5,y:3,text:'旧仓库'},{x:18,y:3,text:'东侧庭院'},{x:18,y:12,text:'候救大厅'}]:[{x:4,y:3,text:'北仓'},{x:12,y:3,text:'连廊'},{x:20,y:3,text:'东馆'},{x:12,y:12,text:'南仓'},{x:20,y:12,text:'居民区'}]};
}
export const RESCUE_MAPS = [
 roomMap(1,'走廊接应','hold',60,10,8,[8,16],[],[[8,8],[16,8]],
  [{x:19,y:7,n:10}], [{x:12.5,y:1.5,name:'北口'}],
  [{at:9,entry:0,count:6,fast:0},{at:23,entry:0,count:6,fast:0},{at:40,entry:0,count:6,fast:0}]),
 roomMap(2,'双门夹击','hold',90,15,12,[12],[8],[[12,4],[12,11],[5,8],[19,8]],
  [{x:18,y:11,n:9},{x:17,y:4,n:6}], [{x:5.5,y:1.5,name:'西北口'},{x:21.5,y:1.5,name:'东北口'}],
  [{at:10,entry:0,count:8,fast:0},{at:29,entry:1,count:8,fast:1},{at:48,entry:0,count:8,fast:1},{at:67,entry:1,count:8,fast:2}]),
 roomMap(3,'分区清剿','clear',120,20,16,[8,16],[8],[[8,4],[8,12],[16,4],[16,12],[4,8],[12,8],[20,8]],
  [{x:19,y:11,n:10},{x:19,y:4,n:10}], [{x:3.5,y:1.5,name:'北仓入口'},{x:12.5,y:1.5,name:'连廊入口'},{x:21.5,y:1.5,name:'东馆入口'}],
  [{at:12,entry:0,count:8,fast:0},{at:30,entry:1,count:9,fast:1},{at:50,entry:2,count:9,fast:2},{at:71,entry:0,count:10,fast:2},{at:92,entry:2,count:12,fast:3}])
];
const latestMaps=new Map();
export function rescueMap(id,version=9){
 const key=version+':'+id;if(version>=3&&latestMaps.has(key))return latestMaps.get(key);
 if(version>=9){const result=escalationMap(id);latestMaps.set(key,result);return result;}
 if(version>=8){const result=structuredClone(rescueMap(id,7));if(id>1){const [x,y]=({2:[9.5,2.5],3:[10.5,2.5],4:[2.5,3.5],5:[11.5,1.5],6:[14.5,7.5]})[id];result.supplies.push({id:'overdrive-cache',x,y,reward:'overdrive',seconds:25,warning:4});}latestMaps.set(key,result);return result;}
 if(version>=7){const result=siegeMap(id,id<=3?rescueMap(id,6):null);latestMaps.set(key,result);return result;}
 let map=RESCUE_MAPS.find(m=>m.id===id);if(!map)throw Error('关卡不存在');
 if(id===2&&version>=2)map={...map,waves:[{at:5,entry:1,count:6,fast:1},{at:15,entry:0,count:8,fast:1},{at:33,entry:1,count:8,fast:1},{at:50,entry:0,count:10,fast:2}]};
 if(version>=3){
  if(id===1){
   const tiles=map.tiles.map(row=>row.split(''));for(let x=1;x<8;x++)tiles[9][x]='#';tiles[9][4]='.';
   map={...map,tiles:tiles.map(row=>row.join('')),doors:[...map.doors,{id:'door2',x:4.5,y:9.5,cell:9*map.w+4,vertical:false}]};
  }
  const entrances=id===1?[...map.entrances,{x:3.5,y:1.5,name:'接应区北口',evacOnly:true}]:map.entrances;
  const result={...map,entrances,extraction:{seconds:[16,18,20][id-1],warning:3,count:[6,10,8][id-1],fast:[1,2,2][id-1],entry:id===1?1:0}};
  if(version>=4)result.supplies=[{id:'supply0',x:id===2?10.5:12.5,y:id===2?5.5:11.5}];
  if(version>=5){
   result.waves=map.waves.map(w=>({...w,count:Math.ceil(w.count*1.75)}));
   result.extraction={...result.extraction,count:[12,18,16][id-1]};
  }
  latestMaps.set(key,result);return result;
 }
 return map;
}
export const insideExit=(m,u)=>u.x>=m.exit.x&&u.x<=m.exit.x+m.exit.w&&u.y>=m.exit.y&&u.y<=m.exit.y+m.exit.h;

export const RESCUE_LEVELS=[1,2,3,4,5,6,7,8,9];
function siegeMap(id,legacy){
 let m;
 if(legacy){
  m=structuredClone(legacy);m.seconds=[90,130,160][id-1];
  if(id===1)m.entrances.push({x:21.5,y:1.5,name:'东侧破口'});
  if(id===2)m.entrances.push({x:21.5,y:14.5,name:'南巷破口'});
  m.waves=m.waves.map((w,i)=>({...w,at:Math.max(id===2?22:14,w.at+6)+i*2,count:Math.ceil(w.count*2.2),fast:Math.max(w.fast,Math.floor(w.count*.22))}));
  m.extraction={...m.extraction,count:Math.ceil(m.extraction.count*3),entries:m.entrances.map((_,i)=>i),seconds:[28,30,32][id-1]};
 }else if(id===4){
  m=roomMap(4,'断电街区','hold',180,18,15,[8,16],[8],[[8,4],[8,12],[16,4],[16,12],[4,8],[12,8],[20,8]],
   [{x:19,y:10,n:9},{x:19,y:3,n:9}],[{x:12.5,y:1.5,name:'北街'},{x:21.5,y:1.5,name:'东街'},{x:3.5,y:1.5,name:'西街'}],
   [{at:9,entry:0,count:32,fast:6},{at:30,entry:1,count:40,fast:8},{at:66,entry:2,count:44,fast:8},{at:92,entry:1,count:48,fast:10},{at:124,entry:0,count:52,fast:12}]);
  m.objectives=[{id:'power',type:'power',x:12.5,y:5.5,name:'恢复供电',seconds:6}];m.labels=[{x:4,y:3,text:'停电街区'},{x:12,y:3,text:'配电站'},{x:20,y:12,text:'临时安置点'}];m.theme={floor:'#d1dce4',wall:'#2c4058'};
 }else if(id===5){
  m=roomMap(5,'双巷净化','hold',190,18,15,[7,15],[7],[[7,3],[7,11],[15,3],[15,11],[4,7],[11,7],[20,7]],
   [{x:19,y:9,n:12},{x:10,y:3,n:6}],[{x:3.5,y:1.5,name:'西巷'},{x:21.5,y:1.5,name:'东巷'},{x:21.5,y:14.5,name:'南巷'}],
   [{at:8,entry:0,count:32,fast:6},{at:28,entry:2,count:40,fast:7},{at:77,entry:1,count:46,fast:9},{at:110,entry:2,count:50,fast:10}]);
  m.objectives=[{id:'nest0',type:'nest',x:11.5,y:4.8,name:'西感染巢',hp:260},{id:'nest1',type:'nest',x:20.5,y:3.5,name:'东感染巢',hp:300}];m.labels=[{x:3,y:3,text:'旧市集'},{x:11,y:11,text:'搜救通道'},{x:20,y:12,text:'居民避难所'}];m.theme={floor:'#dce2ce',wall:'#435444'};
 }else if(id===6){
  m=roomMap(6,'车队突围','hold',210,21,17,[8,16],[9],[[8,4],[8,12],[16,4],[16,12],[4,9],[12,9],[20,9]],
   [{x:19,y:3,n:9},{x:19,y:10,n:12}],[{x:12.5,y:1.5,name:'北站'},{x:21.5,y:1.5,name:'东站'},{x:21.5,y:14.5,name:'南站'}],
   [{at:10,entry:1,count:38,fast:7},{at:22,entry:0,count:44,fast:9},{at:70,entry:2,count:50,fast:10},{at:98,entry:1,count:56,fast:12},{at:130,entry:0,count:60,fast:12},{at:164,entry:2,count:64,fast:14}]);
  m.objectives=[{id:'convoy',type:'convoy',x:11.5,y:4.5,name:'护送救援车',hp:600,waypoints:[{x:4.5,y:4.5},{x:4.5,y:12.5}]}];m.labels=[{x:4,y:3,text:'旧车站'},{x:12,y:12,text:'撤离长街'},{x:20,y:12,text:'候救大厅'}];m.theme={floor:'#e3d8d0',wall:'#594956'};
 }else throw Error('关卡不存在');
 m.objectives??=[];m.extraction??={seconds:26,warning:4,count:64,fast:12,entry:0,entries:[0,1,2]};
 m.supplies=[...(m.supplies||[]),{id:'siege-supply',x:id===5?10.5:13.5,y:11.5}];
 m.brief=id<=3?'接应平民，抵挡多路尸潮':id===4?'靠近配电站守住 6 秒，再护送撤离':id===5?'自动射击摧毁两座感染巢，阻断增援': '靠近救援车护送回接应区，同时营救平民';
 return m;
}

// New rules own their maps; historical recordings retain the exact earlier waves.
function escalationMap(id){
 let m;
 if(id<=6){
  m=structuredClone(rescueMap(id,8));
  if([1,3,4].includes(id))m.entrances.push({x:12.5,y:14.5,name:'南侧破口',evacOnly:true});
  if(id===1){const tiles=m.tiles.map(row=>row.split(''));tiles[12][8]='.';m.tiles=tiles.map(row=>row.join(''));m.doors.push({id:'door3',x:8.5,y:12.5,cell:12*m.w+8,vertical:true});}
  m.waves=m.waves.map((w,i)=>{const count=Math.ceil(w.count*(id===1?1.9:2.2));return {...w,at:Math.max(id===2?12:8,Math.round(w.at*.72))+i,count,fast:Math.floor(count*(id===1?.24:.3))};});
  m.extraction={...m.extraction,count:Math.ceil(m.extraction.count*2.5),fast:Math.ceil(m.extraction.count*.85),entries:m.entrances.map((_,i)=>i)};
 }else{
  const entrances=[{x:3.5,y:1.5,name:'西侧破口'},{x:12.5,y:1.5,name:'北侧破口'},{x:21.5,y:1.5,name:'东侧破口'},{x:21.5,y:14.5,name:'南侧破口'}];
  const waves=(times,counts,entries)=>times.map((at,i)=>({at,entry:entries[i%entries.length],count:counts[i],fast:Math.floor(counts[i]*.32)}));
  if(id===7){
   m=roomMap(7,'北堤封控','hold',210,21,17,[8,16],[8],[[8,4],[8,12],[16,4],[16,12],[4,8],[12,8],[20,8]],
    [{x:19,y:3,n:9},{x:19,y:10,n:12}],entrances,
    waves([8,22,40,60,82,108,140],[58,64,70,76,82,90,96],[0,1,2,3]));
   m.objectives=[{id:'seal-north',type:'seal',x:12.5,y:5.5,name:'北闸',seconds:5,entry:1},{id:'seal-east',type:'seal',x:19.5,y:5.5,name:'东闸',seconds:5,entry:2}];
   m.reinforcements={at:30,every:14,count:12,entries:[1,2]};
   m.labels=[{x:4,y:3,text:'西堤'},{x:12,y:3,text:'北闸控制室'},{x:20,y:12,text:'临时营地'}];m.theme={floor:'#d2e1dd',wall:'#33585b'};
   m.brief='靠近两处闸控，封住增援，再护送撤离';
  }else if(id===8){
   m=roomMap(8,'火力据点','hold',220,21,17,[7,15],[7],[[7,3],[7,11],[15,3],[15,11],[4,7],[11,7],[20,7]],
    [{x:10,y:3,n:9},{x:19,y:9,n:12}],entrances,
    waves([8,23,42,62,86,112,145],[62,72,82,92,100,108,116],[0,3,2,1]));
   m.objectives=[{id:'turret-north',type:'turret',x:11.5,y:5.5,name:'北炮台',seconds:4,hp:360,optional:true},{id:'turret-south',type:'turret',x:11.5,y:10.5,name:'南炮台',seconds:4,hp:360,optional:true},{id:'nest-east',type:'nest',x:20.5,y:3.5,name:'感染源',hp:650}];
   m.labels=[{x:3,y:3,text:'西工坊'},{x:11,y:12,text:'交叉火力区'},{x:20,y:12,text:'地下避难所'}];m.theme={floor:'#e3ddca',wall:'#555547'};
   m.brief='靠近炮台自动启用，摧毁感染源并营救平民';
  }else if(id===9){
   m=roomMap(9,'终夜空援','hold',240,24,20,[8,16],[8],[[8,4],[8,12],[16,4],[16,12],[4,8],[12,8],[20,8]],
    [{x:19,y:3,n:12},{x:19,y:10,n:12}],entrances,
    waves([8,22,37,53,72,94,120,148,180],[70,82,94,106,118,130,140,150,160],[0,2,3,1]));
   m.objectives=[{id:'radio',type:'radio',x:12.5,y:5.5,name:'空援电台',seconds:6},{id:'turret-exit',type:'turret',x:4.5,y:10.5,name:'接应炮台',seconds:4,hp:420,optional:true}];
   m.labels=[{x:4,y:3,text:'废弃码头'},{x:12,y:3,text:'空援电台'},{x:20,y:12,text:'最后安置点'}];m.theme={floor:'#c8d4df',wall:'#303e59'};
   m.brief='守住电台呼叫自动空援，迎击尸潮并护送撤离';
  }else throw Error('关卡不存在');
  m.waves=m.waves.map(w=>({...w,count:Math.ceil(w.count*1.6),fast:Math.ceil(w.fast*1.6)}));
  m.extraction={seconds:38,warning:4,count:190+(id-7)*30,fast:64+(id-7)*10,entry:0,entries:[0,1,2,3]};
  if(id===9)m.extraction={...m.extraction,seconds:68,count:360,fast:120};
  m.supplies=[{id:'siege-supply',x:13.5,y:11.5},{id:'north-supply',x:13.5,y:4.5},{id:'overdrive-cache',x:18.5,y:6.5,reward:'overdrive',seconds:25,warning:4}];
 }
 return m;
}
