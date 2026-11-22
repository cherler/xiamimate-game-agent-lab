import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {storageKey} from '../web/storage.mjs';
import {beginRescue,sealRescue,playbackRescue,replayRescue} from '../src/rescue.mjs';
import {fingerprint} from '../src/common.mjs';
import {siegeScenario} from './rescue-siege-scenarios.mjs';
const base=(process.env.ARENA_URL||'http://127.0.0.1:4846/site').replace(/\/$/,''),out=path.join(project,'.runtime/rescue-siege/browser');await fs.mkdir(out,{recursive:true});
const records=[1,2,3,4,5,6].map(level=>siegeScenario({level}).record),errors=[],checks=[];
const browser=await chromium.launch({headless:true});
const mark=text=>{checks.push(text);console.log(text);};
async function make(w=1366,h=850){const p=await browser.newPage({viewport:{width:w,height:h},hasTouch:w<1000,isMobile:w<1000,reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(keys=>{const pending=sessionStorage.getItem('siege-pending');if(pending){localStorage.setItem(keys.save,pending);sessionStorage.removeItem('siege-pending');}}, {save:storageKey('glimmer-rescue-save')});await p.goto(base+'/#rescue');return p;}
async function restore(p,record){await p.evaluate(r=>sessionStorage.setItem('siege-pending',JSON.stringify(r)),record);await p.reload();await p.locator('#rescue-board').waitFor();}
async function menu(p){if(!await p.locator('#screen-settings-head').isVisible())await p.locator(await p.locator('#screen-bar').isVisible()?'#screen-menu':'#play-settings').click();}
async function closeMenu(p){if(await p.locator('#screen-settings-head').isVisible())await p.locator('#screen-settings-close').click();}
async function exportRecord(p,name){await menu(p);const pending=p.waitForEvent('download');await p.locator('#rs-export').click();const file=path.join(out,name+'.json');await(await pending).saveAs(file);return JSON.parse(await fs.readFile(file,'utf8'));}
try{
 const p=await make();assert.equal(await p.locator('[data-mission]').count(),6);assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'8');
 await p.evaluate(key=>localStorage.setItem(key,JSON.stringify({unlocked:3,choices:['fire','mobility'],medals:{1:{allSaved:true},2:{allSaved:true},3:{allSaved:true}}})),storageKey('glimmer-rescue-campaign'));await p.reload();await menu(p);assert.equal(await p.locator('[data-mission="4"]').isEnabled(),true);assert.equal(await p.locator('[data-mission="5"]').isEnabled(),false);await p.locator('[data-mission="4"]').click();await closeMenu(p);assert.equal(await p.locator('#rescue-board').getAttribute('data-level'),'4');assert.ok((await p.locator('#rs-field-goals').textContent()).includes('供电'));mark('已通关第三关的旧进度自动解锁第四关，升级保留');
 // Restore genuine checkpoints just before each win; UI advances the campaign.
 for(let i=0;i<records.length;i++){
  let previous;for(const s of playbackRescue(records[i])){if(s.phase==='ended')break;previous=s;}
  const checkpoint={...records[i],commands:records[i].commands.filter(c=>c.tick<=previous.tick),end:{tick:previous.tick,hash:fingerprint(previous),winner:null}};
  await restore(p,checkpoint);await p.locator('#rs-start').click();await p.locator('#rs-result h2').filter({hasText:'救援成功'}).waitFor();assert.equal(await p.locator('#rs-saved').textContent(),String(replayRescue(records[i]).saved));
  if(i<5){const upgrade=p.locator('[data-upgrade=fire]');if(await upgrade.count())await upgrade.click();else await p.locator('#rs-next').click();assert.equal(await p.locator('#rescue-board').getAttribute('data-level'),String(i+2));}
 }
 assert.ok((await p.locator('#rs-next').textContent()).includes('六关完成'));mark('六关真实结算、五次升级和解锁流程可完成');
 for(const level of [4,5,6]){await restore(p,sealRescue(beginRescue({level})));await p.screenshot({path:path.join(out,'level-'+level+'.png')});assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'8');}
 const old=JSON.parse(await fs.readFile(path.join(project,'test/fixtures/rescue-6.json'),'utf8'));await restore(p,old);assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'6');await menu(p);await p.locator('#rs-modern').click();await closeMenu(p);assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'8');const backup=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey('glimmer-rescue-save-previous'));assert.equal(backup.format,'rescue-6');mark('旧六版行动沿用旧规则，重新部署切换新版并保留备份');
 // Browser executes the same genuine command recordings, including >120 seconds.
 const parity=await p.evaluate(async records=>{const {replayRescue}=await import('/src/rescue.mjs');const {fingerprint}=await import('/src/common.mjs');return records.map(r=>({hash:fingerprint(replayRescue(r)),expected:r.end.hash}));},records);assert.ok(parity.every(p=>p.hash===p.expected));mark('六关新录像在 Node 与 Chromium 的结果逐一一致');
 // Actual touch interactions, including a complete whole-team command and export.
 const phone=await make(844,390);await restore(phone,sealRescue(beginRescue({level:5})));await phone.locator('#screen-pause').tap();await phone.locator('#screen-pause').tap();const rect=await phone.locator('#rescue-board').boundingBox();await phone.touchscreen.tap(rect.x+11.5/24*rect.width,rect.y+4.5/16*rect.height);assert.equal(await phone.locator('#rescue-board').getAttribute('data-order'),'accepted');await phone.locator('#screen-menu').tap();const r=await exportRecord(phone,'touch-command');assert.equal(r.commands.at(-1).command.ids.length,5);assert.equal(replayRescue(r).version,8);await phone.locator('#screen-settings-close').tap();await phone.screenshot({path:path.join(out,'touch-nests.png')});
 for(const [w,h]of [[320,568],[390,844],[667,375],[844,390]]){await phone.setViewportSize({width:w,height:h});for(const level of [4,5,6]){await restore(phone,sealRescue(beginRescue({level})));const bounds=await phone.evaluate(()=>{const r=document.querySelector('#rescue-board').getBoundingClientRect();return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});assert.ok(bounds.sw<=w+1&&bounds.sh<=h+1&&bounds.right<=w+1&&bounds.bottom<=h+1,JSON.stringify({level,...bounds}));const labels=await phone.locator('#rs-field-goals').evaluate(n=>{const r=n.closest('.rs-live-bar').getBoundingClientRect();return [...n.children].every(c=>{const b=c.getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom;});});assert.ok(labels,'objective labels stay inside their panel');}}
 mark('三张新地图在四种手机尺寸内完整显示，触屏点击仍指挥全队');
 // Find a real crowded battle frame; assess render and simulation, not a static mock.
 let crowd;for(const s of playbackRescue(records[5]))if(!crowd||s.zombies.length>crowd.zombies.length)crowd=s;
 const performance=await p.evaluate(async state=>{const {drawRescue}=await import('/web/rescue-board.mjs');const {stepRescue}=await import('/src/rescue.mjs');const canvas=document.querySelector('#rescue-board');const a=performance.now();for(let i=0;i<60;i++)drawRescue(canvas,state,{reduced:true});const renderMs=(performance.now()-a)/60,b=performance.now();for(let i=0;i<60;i++)state=stepRescue(state);return {renderMs,stepMs:(performance.now()-b)/60,enemies:state.zombies.length};},crowd);assert.ok(performance.stepMs<33,JSON.stringify(performance));const crowdRecord={...records[5],commands:records[5].commands.filter(c=>c.tick<=crowd.tick),end:{tick:crowd.tick,hash:fingerprint(crowd),winner:crowd.winner}};await restore(p,crowdRecord);await p.screenshot({path:path.join(out,'siege-battle.png')});mark('密集尸潮性能：'+JSON.stringify({peak:crowd.zombies.length,...performance}));
 const file=path.join(out,'latest-replay.json');await fs.writeFile(file,JSON.stringify(records[0]));await p.locator('#upload').setInputFiles(file);await menu(p);await p.locator('#rs-replay-controls').waitFor();assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'8');assert.equal(await p.locator('#rs-retreat').isDisabled(),true);await closeMenu(p);await p.locator('#rs-start').click();mark('新版录像导入路由和只读回放生效');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({base,checks,errors,performance,browser:browser.version()},null,2));
}finally{await browser.close();}
