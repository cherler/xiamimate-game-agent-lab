import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {reclamationScenario} from './rescue-reclamation-scenarios.mjs';
import {escalationScenario} from './rescue-escalation-scenarios.mjs';
import {rescueMap,replayRescue,sealRescue} from '../src/rescue.mjs';
const out='.runtime/rescue-reclamation';await fs.mkdir(out,{recursive:true});const rows=[];
for(let level=1;level<=9;level++){
 const baseline=escalationScenario({level,version:9});let peakState,peakRecord;const types=new Map(),damage={};let eventId=-1;
 const r=reclamationScenario({level,plan:'tactical',onStep(s,record){
  for(const z of s.zombies)types.set(z.id,z.mutation||'ordinary');
  for(const e of s.events)if(e.id>eventId&&e.kind==='hurt'){const kind=types.get(e.source)||'other';damage[kind]=(damage[kind]||0)+e.amount;}eventId=s.eventId-1;
  if(!peakState||s.zombies.length>peakState.zombies.length){peakState=structuredClone(s);peakRecord=sealRescue({state:s,record});}
 }}),s=r.state;
 const row={level,name:rescueMap(level).name,old:{winner:baseline.state.winner,seconds:baseline.state.tick/30,kills:baseline.state.kills,saved:baseline.state.saved},current:{winner:s.winner,reason:s.reason,seconds:s.tick/30,kills:s.kills,saved:s.saved,lost:s.lost,alive:s.soldiers.filter(u=>u.hp>0).length,peak:r.peak,artillery:s.artillery.used,achievements:s.achievements,milestones:r.milestones,mutantsSeen:Object.fromEntries(['ordinary','runner','breaker','gunner','bomber'].map(k=>[k,[...types.values()].filter(v=>v===k).length])),damage}};
 rows.push(row);await fs.writeFile(out+'/balance.json',JSON.stringify({note:'固定种子 41003。旧版用原接应路线，新版用整队接应、据点、门障、炮击路线；不是同策略胜率或真人胜率。伤害统计包含士兵、平民、避难点、据点。',rows},null,2));await fs.writeFile(out+'/final-'+level+'.json',JSON.stringify(r.record));await fs.writeFile(out+'/crowd-'+level+'.json',JSON.stringify(peakRecord));await fs.writeFile(out+'/state-'+level+'.json',JSON.stringify(peakState));assert.equal(replayRescue(r.record).winner,s.winner);console.log(JSON.stringify(row));
}
for(const plan of ['idle','no-support']){const r=reclamationScenario({level:2,plan});console.log(JSON.stringify({level:2,plan,winner:r.state.winner,saved:r.state.saved,kills:r.state.kills,seconds:r.state.tick/30}));}
