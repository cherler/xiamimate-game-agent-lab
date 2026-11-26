// Shared by simulation and rendering: silhouettes and attacks differ, not just HP.
export const RESCUE_MUTANTS={
 runner:{name:'疾行者',hp:58,r:.19,speed:3.1,color:'#df8246',armor:1,melee:18,gate:12},
 breaker:{name:'破门重甲',hp:320,r:.34,speed:1.3,color:'#825477',armor:.55,melee:30,gate:65}
};
// Historical rescue-10 recordings retain their original enemy attacks.
export const LEGACY_RESCUE_MUTANTS={
 ...RESCUE_MUTANTS,
 gunner:{name:'持枪感染者',hp:96,r:.23,speed:1.55,color:'#8e5b45',armor:1,melee:14,gate:15,range:6.3,windup:27,reload:72},
 bomber:{name:'掷弹感染者',hp:125,r:.25,speed:1.4,color:'#708342',armor:1,melee:16,gate:20,range:6.5,windup:33,reload:135}
};
export const rescueMutants=version=>version===10?LEGACY_RESCUE_MUTANTS:RESCUE_MUTANTS;
export function rescueMutation(level,wave,index,fast=false,brute=false,version=11){
 if(brute)return 'breaker';
 // Armed enemies arrive behind the first rush; early waves still show each role.
 if(version===10&&index%23===8&&level>=2)return 'bomber';
 if(version===10&&index%19===6&&(level>=2||wave>=1))return 'gunner';
 if(fast)return 'runner';
 return null;
}
