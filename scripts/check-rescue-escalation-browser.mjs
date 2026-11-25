import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from './playwright.mjs';
import {beginRescue,sealRescue} from '../src/rescue.mjs';
import {storageKey} from '../web/storage.mjs';
const base=(process.env.ARENA_URL||'http://127.0.0.1:4848/site').replace(/\/$/,''),out='.runtime/rescue-escalation/browser';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],checks=[],metrics=[];
const read=name=>fs.readFile('.runtime/rescue-escalation/'+name+'.json','utf8').then(JSON.parse);
const mark=text=>{checks.push(text);console.log(text);};
async function make(width=1366,height=900){const p=await browser.newPage({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,reducedMotion:'reduce'});p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(key=>{const r=sessionStorage.getItem('escalation-pending');if(r){localStorage.setItem(key,r);sessionStorage.removeItem('escalation-pending');}},storageKey('glimmer-rescue-save'));await p.clock.install();await p.clock.pauseAt(Date.now()+1000);await p.goto(base+'/#rescue');return p;}
async function restore(p,r){await p.evaluate(r=>sessionStorage.setItem('escalation-pending',JSON.stringify(r)),r);await p.reload();await p.locator('#rescue-board').waitFor();await p.clock.runFor(60);}
async function menu(p){if(!await p.locator('#screen-settings-head').isVisible())await p.locator(await p.locator('#screen-menu').isVisible()?'#screen-menu':'#play-settings').click();}
async function close(p){if(await p.locator('#screen-settings-head').isVisible())await p.locator('#screen-settings-close').click();}
async function toggle(p){await p.locator(await p.locator('#screen-pause').isVisible()?'#screen-pause':'#rs-start').click();}
const shot=(p,name)=>p.screenshot({path:out+'/'+name+'.png'});
try{
 const p=await make();assert.equal(await p.locator('[data-mission]').count(),9);assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'9');
 await p.evaluate(key=>localStorage.setItem(key,JSON.stringify({unlocked:6,choices:['fire','mobility','fire','gate','mobility'],medals:Object.fromEntries([1,2,3,4,5,6].map(i=>[i,{allSaved:true}]))})),storageKey('glimmer-rescue-campaign'));
 await restore(p,await read('v8-level6'));assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'8');await menu(p);assert.ok(await p.locator('[data-mission="7"]').isEnabled());assert.equal(await p.locator('[data-mission="8"]').isEnabled(),false);await close(p);
 await p.locator('[data-upgrade="fire"]').click();assert.equal(await p.locator('#rescue-board').getAttribute('data-level'),'7');assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'9');mark('旧六关通关进度保留，补选升级后继续第七关');
 for(const level of [7,8,9]){await restore(p,await read('win-'+level));await toggle(p);await p.clock.runFor(120);assert.equal(await p.locator('#rs-result h2').textContent(),'救援成功');if(level<9){await p.locator('[data-upgrade="fire"]').click();assert.equal(await p.locator('#rescue-board').getAttribute('data-level'),String(level+1));}}
 assert.ok((await p.locator('#rs-next').textContent()).includes('九关完成'));mark('第七至九关结算、升级、解锁和最终完成流程正常');
 await restore(p,JSON.parse(await fs.readFile('test/fixtures/rescue-8.json','utf8')));await menu(p);await p.locator('#rs-modern').click();await close(p);assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'9');assert.equal(await p.evaluate(key=>JSON.parse(localStorage.getItem(key)).format,storageKey('glimmer-rescue-save-previous')),'rescue-8');mark('旧录像沿用八版规则，切换尸潮版保留原记录');
 for(const level of [7,8,9]){await restore(p,await read('v9-level'+level));const r=await read('v9-level'+level);const parity=await p.evaluate(async r=>{const {replayRescue}=await import('/src/rescue.mjs');const {fingerprint}=await import('/src/common.mjs');return fingerprint(replayRescue(r));},r);assert.equal(parity,r.end.hash);}
 mark('封锁、炮台、空援录像在浏览器与模拟中的结果一致');
 const phone=await make(844,390);
 for(const [w,h]of [[390,844],[844,390],[320,568],[667,375]]){await phone.setViewportSize({width:w,height:h});for(const level of [7,8,9]){await restore(phone,sealRescue(beginRescue({level})));const b=await phone.locator('#rescue-board').boundingBox();const scroll=await phone.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}));assert.ok(scroll.w<=w+1&&scroll.h<=h+1,JSON.stringify({w,h,scroll}));assert.ok(b.y>=0&&b.x>=-1&&b.x+b.width<=w+1&&b.y+b.height<=h+1,JSON.stringify({w,h,b}));metrics.push({w,h,level,board:b});await shot(phone,'level-'+level+'-'+w);}}
 mark('三张新地图在四种手机尺寸内完整显示，画面没有被文字撑高');
 await phone.setViewportSize({width:844,height:390});await restore(phone,sealRescue(beginRescue({level:8})));await toggle(phone);const rect=await phone.locator('#rescue-board').boundingBox();await phone.touchscreen.tap(rect.x+11.5/24*rect.width,rect.y+5.5/16*rect.height);assert.equal(await phone.locator('#rescue-board').getAttribute('data-order'),'accepted');await phone.clock.runFor(12000);
 const objectives=JSON.parse(await phone.locator('#rescue-board').getAttribute('data-objectives'));assert.ok(objectives.find(o=>o.id==='turret-north').done);await shot(phone,'touch-turret-captured');mark('触屏一次下令，整队抵达据点并自动占领炮台');
 for(const level of [6,7,8,9]){await restore(p,await read('crowd-'+level));await shot(p,'crowd-'+level);}
 await restore(phone,await read('air-9'));await shot(phone,'air-targets-landscape');await phone.setViewportSize({width:390,height:844});await phone.clock.runFor(60);await shot(phone,'air-targets-portrait');
 await restore(p,await read('crowd-6'));const state=await read('state-6');await p.clock.resume();const perf=await p.evaluate(async state=>{const {drawRescue}=await import('/web/rescue-board.mjs');const {stepRescue}=await import('/src/rescue.mjs');const canvas=document.querySelector('#rescue-board');let now=performance.now();for(let i=0;i<60;i++)drawRescue(canvas,state,{reduced:true});const renderMs=(performance.now()-now)/60;now=performance.now();for(let i=0;i<60;i++)state=stepRescue(state);return {renderMs,stepMs:(performance.now()-now)/60,enemies:state.zombies.length};},state);assert.ok(perf.stepMs>0&&perf.stepMs<33,JSON.stringify(perf));mark('密集尸群性能 '+JSON.stringify(perf));
 // Imports use the same entry point as the player's replay-upload button.
 await p.locator('#upload').setInputFiles('.runtime/rescue-escalation/v9-level9.json');await menu(p);assert.ok(await p.locator('#rs-replay-controls').isVisible());assert.ok(await p.locator('#rs-retreat').isDisabled());await close(p);assert.equal(await p.locator('#rescue-board').getAttribute('data-version'),'9');mark('九版录像可导入，回放时不能改变局面');
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify({base,checks,metrics,perf,errors},null,2));
}finally{await browser.close();}
