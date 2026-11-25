import fs from 'node:fs/promises';
import {escalationScenario} from './rescue-escalation-scenarios.mjs';
import {rescueMap,playbackRescue} from '../src/rescue.mjs';
import {fingerprint} from '../src/common.mjs';
const out='.runtime/rescue-escalation',only=Number(process.env.RESCUE_LEVEL)||null;await fs.mkdir(out,{recursive:true});const rows=only?JSON.parse(await fs.readFile(`${out}/balance.json`,'utf8')).rows.filter(r=>r.level!==only):[];
const checkpoint=(record,state)=>({...record,commands:record.commands.filter(c=>c.tick<=state.tick),end:{tick:state.tick,hash:fingerprint(state),winner:state.winner}});
for(const seed of [41003,41017])for(let level=1;level<=9;level++)for(const version of (level<=6?[8,9]:[9])){
 if(only&&level!==only)continue;
 const r=escalationScenario({seed,level,version}),s=r.state,row={version,seed,level,name:rescueMap(level,version).name,win:s.winner,seconds:Math.round(s.tick/3)/10,peak:r.peak,kills:s.kills,saved:s.saved,lost:s.lost,troops:s.soldiers.filter(u=>u.hp>0).length,hp:s.soldiers.reduce((n,u)=>n+u.hp,0)};rows.push(row);console.log(JSON.stringify(row));
 if(seed===41003){await fs.writeFile(`${out}/v${version}-level${level}.json`,JSON.stringify(r.record));
  if(version===9){let previous,crowd,air;for(const state of playbackRescue(r.record)){if(state.phase!=='ended')previous=state;if(!crowd||state.zombies.length>crowd.zombies.length)crowd=state;if(!air&&state.airstrikes.length)air=state;}
   if(s.winner)await fs.writeFile(`${out}/win-${level}.json`,JSON.stringify(checkpoint(r.record,previous)));
   if([6,7,8,9].includes(level)){await fs.writeFile(`${out}/crowd-${level}.json`,JSON.stringify(checkpoint(r.record,crowd)));await fs.writeFile(`${out}/state-${level}.json`,JSON.stringify(crowd));}
   if(air)await fs.writeFile(`${out}/air-${level}.json`,JSON.stringify(checkpoint(r.record,air)));
  }
 }
}
for(const level of [1,3,6,7,8,9]){if(only&&level!==only)continue;const r=escalationScenario({level,difficulty:'challenge'}),s=r.state;const row={version:9,level,difficulty:'challenge',win:s.winner,seconds:Math.round(s.tick/3)/10,peak:r.peak,kills:s.kills,saved:s.saved,lost:s.lost,troops:s.soldiers.filter(u=>u.hp>0).length};rows.push(row);console.log(JSON.stringify(row));}
await fs.writeFile(`${out}/balance.json`,JSON.stringify({date:'2026-11-25',note:'固定路线每秒决策一次，不代表真人胜率；第六关新版先撤离再护送车辆，其他前五关为同路线比较。',rows},null,2));
