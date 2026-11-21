import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {rescueScenario} from './rescue-scenarios.mjs';
import {playbackRescue,replayRescue,issueRescue,advanceRescue,sealRescue} from '../src/rescue.mjs';
import {fingerprint} from '../src/common.mjs';

const url=(process.env.ARENA_URL||'http://127.0.0.1:4841').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/rescue-extraction');
await fs.mkdir(out,{recursive:true});
// Checkpoints come from real orders and the game simulation, without editing units or rules.
const full=rescueScenario().record,states={};
for(const s of playbackRescue(full)){
 const key=s.evac.phase==='loading'&&s.civilians.every(c=>c.status==='boarding')?'loading':s.evac.phase==='contested'?'contested':null;
 if(key&&!states[key])states[key]={...full,commands:full.commands.filter(c=>c.tick<=s.tick),end:{tick:s.tick,hash:fingerprint(s),winner:s.winner}};
}
const branch={state:replayRescue(states.loading),record:{...structuredClone(states.loading),end:null}};
issueRescue(branch,{type:'move',ids:branch.state.soldiers.map(u=>u.id),x:19.5,y:8.5});
while(branch.state.winner===null&&branch.state.evac.phase!=='unguarded')advanceRescue(branch);
assert.equal(branch.state.evac.phase,'unguarded');states.unguarded=sealRescue(branch);
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
async function context(options={}){
 const ctx=await browser.newContext({reducedMotion:'reduce',...options});
 await ctx.addInitScript(()=>{const r=sessionStorage.getItem('rescue-extraction-test');if(r){localStorage.setItem('gameplay-v1:glimmer-rescue-save',r);sessionStorage.removeItem('rescue-extraction-test');}});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/#rescue');await page.locator('#rescue-board').waitFor();return page;
}
async function restore(page,record){
 replayRescue(record);await page.evaluate(r=>sessionStorage.setItem('rescue-extraction-test',JSON.stringify(r)),record);await page.reload();await page.locator('#rescue-board').waitFor();
}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function exported(page,name){
 const download=page.waitForEvent('download');await page.locator('#rs-export').click();const file=path.join(out,name+'.json');await(await download).saveAs(file);const r=JSON.parse(await fs.readFile(file,'utf8'));return {record:r,state:replayRescue(r)};
}
try{
 const p=await context({viewport:{width:1440,height:1000}});
 await restore(p,states.loading);assert.equal(await p.locator('#rs-saved').innerText(),'0');assert.equal(await p.locator('#rs-boarding').innerText(),'10');assert.equal(await p.locator('#rs-result').isVisible(),false);assert.match(await p.locator('#rs-evac').innerText(),/正在接驳.*守住阵地/s);assert.match(await p.locator('.rs-rage-label').innerText(),/秒后突入/);
 await shot(p,'evac-warning');const before=await exported(p,'evac-before');await p.locator('#rs-start').click();await p.waitForFunction(t=>Number(document.querySelector('#rescue-board').dataset.tick)>t,before.state.evac.alertTick);await p.locator('#rs-start').click();const after=await exported(p,'evac-after');assert.ok(after.state.evac.progress>before.state.evac.progress);assert.equal(after.state.saved,0);assert.match(await p.locator('.rs-rage-label').innerText(),/尸潮狂暴/);await shot(p,'evac-rage');
 await p.reload();const restored=await exported(p,'evac-restored');assert.deepEqual(restored.record.end,after.record.end);checks.push('平民集结不立即结算；撤离读秒、3 秒尸潮预警、狂暴标记与刷新续接一致');

 await restore(p,states.unguarded);assert.match(await p.locator('#rs-evac').innerText(),/缺少护卫.*读秒暂停/s);const noGuardBefore=await exported(p,'evac-unguarded-before');await p.locator('#rs-start').click();await p.waitForFunction(t=>Number(document.querySelector('#rescue-board').dataset.tick)>t+15,noGuardBefore.state.tick);await p.locator('#rs-start').click();const noGuardAfter=await exported(p,'evac-unguarded-after');assert.equal(noGuardAfter.state.evac.progress,noGuardBefore.state.evac.progress);await shot(p,'evac-unguarded');checks.push('全部队员离开时，游戏继续运行但接驳进度停止，界面说明缺少护卫');

 await restore(p,states.contested);assert.match(await p.locator('#rs-evac').innerText(),/敌人逼近.*读秒暂停/s);assert.equal(await p.locator('#rescue-board').getAttribute('data-evac'),'contested');assert.equal(await p.locator('#rescue-board').getAttribute('data-raging'),'true');await shot(p,'evac-contested');checks.push('实际尸潮突破时撤离区与状态栏提示威胁，读秒暂停原因可见');

 const old=JSON.parse(await fs.readFile(path.join(project,'test/fixtures/rescue-v2-level1.json'),'utf8'));await restore(p,old);assert.equal(await p.locator('#rs-evac').isVisible(),false);await p.locator('#rs-modern').click();const modern=await exported(p,'evac-new-rules');assert.equal(modern.record.format,'rescue-6');assert.equal(modern.state.phase,'deploy');assert.equal(await p.locator('#rs-evac').isVisible(),true);checks.push('旧版存档仍可恢复，可从历史行动按钮开启新版，不静默改变旧规则');

 const phone=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await restore(phone,states.contested);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(phone,'evac-mobile-contested');await phone.locator('#rs-evac').scrollIntoViewIfNeeded();const bar=await phone.locator('#rs-evac').boundingBox();assert.ok(bar.x>=0&&bar.x+bar.width<=390);await phone.locator('#rs-start').tap();await phone.waitForTimeout(250);await phone.locator('#rs-start').tap();assert.equal(await phone.locator('#rescue-board').getAttribute('data-phase'),'paused');await exported(phone,'evac-mobile-pause');checks.push('手机完整显示撤离进度和威胁原因，没有横向溢出，触控暂停与回放可用');
 assert.deepEqual(errors,[]);const result={checks,errors,browser:browser.version()};await fs.writeFile(path.join(out,'extraction-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
