import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {chessPlan} from '../src/chess.mjs';
import {storageKey} from '../web/storage.mjs';

const base=(process.env.ARENA_URL||'http://127.0.0.1:4843').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/chess-phase-flow-2026-11-19/browser');
await fs.mkdir(out,{recursive:true});
const middle=beginStrategy('chess',921);
while(middle.state.round<8){for(const actor of [1,2,3,4,5,6,7,0])if(middle.state.players[actor].hp>0)for(const a of chessPlan(middle.state,actor))advanceStrategy(middle,actor,a);advanceStrategy(middle,-1,{type:'advance'});}
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const phase=p=>p.locator('#ac-phase').getAttribute('data-phase');
const seconds=async p=>Number(await p.locator('#ac-countdown').innerText());
async function newPage(record,width=1366,height=768){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:width<651,hasTouch:width<651,reducedMotion:'reduce'});
 await ctx.addInitScript(({record,key})=>{if(!sessionStorage.getItem('phase-fixture')){localStorage.setItem(key,JSON.stringify(record));sessionStorage.setItem('phase-fixture','1');}},{record,key:storageKey('glimmer-chess-save')});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-11-19T00:00:00Z')});await p.goto(base+'/#chess');await p.locator('#ac-phase').waitFor();await p.clock.pauseAt(await p.evaluate(()=>Date.now()+1000));return p;
}
async function exported(p,name){const wait=p.waitForEvent('download');await p.locator('#ac-export').click();const file=path.join(out,name+'.json');await(await wait).saveAs(file);const record=JSON.parse(await fs.readFile(file,'utf8'));return {record,state:replayStrategy(record)};}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
async function fit(p){assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth));}
try{
 const first=await newPage(sealStrategy(beginStrategy('chess',41003)));
 assert.ok(await first.locator('#ac-shop-panel').isVisible());assert.equal(await seconds(first),45);await first.clock.fastForward(60000);assert.equal(await phase(first),'prep');assert.equal(await seconds(first),45);
 await first.locator('[data-buy]:enabled').first().click();await first.locator('#ac-arrange').click();await first.clock.fastForward(2000);assert.equal(await seconds(first),43);await first.locator('#ac-shop-toggle').click();await shot(first,'first-preparation');await first.locator('#ac-ready').click();assert.equal(await phase(first),'battle');assert.ok(!(await first.locator('#ac-shop-panel').isVisible()));
 await first.locator('#ac-skip').click();assert.equal(await phase(first),'loot');await first.clock.fastForward(60000);assert.equal(await phase(first),'loot');assert.equal(await first.locator('#ac-next').isDisabled(),true);
 await first.locator('[data-loot="1"]').click();assert.equal(await phase(first),'settle');await first.clock.fastForward(4100);assert.equal(await phase(first),'settle');await first.clock.fastForward(1100);assert.equal(await phase(first),'prep');assert.ok(await first.locator('#ac-shop-panel').isVisible());assert.match(await first.locator('.ac-round').innerText(),/第 2 轮/);
 console.log('Checkpoint',checks.length+1);checks.push('首次上阵才启动准备时间；手动开战收起招募；战利品等待选择，选完后自动进入下一轮并展开招募');

 const p=await newPage(sealStrategy(middle));await p.locator('#ac-speed').selectOption('4');const start=await seconds(p);await p.clock.fastForward(5000);assert.equal(await seconds(p),start-5);
 await p.locator('#ac-roll').click();await p.locator('[data-buy]:enabled').first().click();assert.equal(await seconds(p),start-5);await p.locator('#ac-lock').click();await p.locator('#ac-shop-close').click();await p.keyboard.press('Space');const before=(await exported(p,'before-auto')).state;await p.clock.fastForward(4000);assert.equal(await seconds(p),start-9);
 await p.locator('[data-preview]').first().click();await p.clock.fastForward(200);const held=await seconds(p);await p.clock.fastForward(60000);assert.equal(await seconds(p),held);assert.equal(await phase(p),'prep');await p.locator('.ac-preview-close').click();
 await p.locator('#ac-phase-pause').click();const paused=await seconds(p);await p.clock.fastForward(45000);assert.equal(await seconds(p),paused);assert.equal(await p.locator('#ac-phase-pause').getAttribute('aria-pressed'),'true');
 await p.reload();assert.ok(Math.abs(await seconds(p)-paused)<=1);assert.equal(await p.locator('#ac-phase-pause').getAttribute('aria-pressed'),'true');await p.locator('#ac-phase-pause').click();await p.clock.fastForward(1000);
 await p.locator('[data-game="cards"]').click();await p.clock.fastForward(45000);await p.locator('[data-game="chess"]').click();assert.equal(await phase(p),'prep');assert.ok(await seconds(p)>=paused-2);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await seconds(p);await p.clock.fastForward(45000);await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await seconds(p),hidden);
 console.log('Checkpoint',checks.length+1);checks.push('准备倒计时独立于战斗倍速；购买操作和招募开合不重置；预览技能、手动暂停、刷新、离开游戏与后台切换均保留剩余时间');

 await p.locator('#ac-shop-close').click();await p.clock.fastForward(Math.max(0,(await seconds(p)-3)*1000));await shot(p,'countdown-warning');assert.ok(await p.locator('#ac-phase.is-urgent').count());await p.clock.fastForward(3100);assert.equal(await phase(p),'battle');assert.ok(!(await p.locator('#ac-shop-panel').isVisible()));assert.equal(await p.locator('#ac-shop-toggle').isDisabled(),true);
 let result=await exported(p,'automatic-battle');assert.equal(result.record.actions.filter(r=>r.actor===0&&r.action.type==='ready').length,middle.record.actions.filter(r=>r.actor===0&&r.action.type==='ready').length+1);await p.locator('[data-observe="1"]').click();await p.clock.fastForward(result.state.battle.ticks*100/Number(await p.locator("#ac-speed").inputValue())+100);assert.equal(await phase(p),'settle');await p.clock.fastForward(5200);assert.equal(await phase(p),'prep');assert.ok(await p.locator('#ac-shop-panel').isVisible());result=await exported(p,'automatic-next-round');assert.equal(result.state.round,9);assert.deepEqual(result.state.players[0].shop,before.players[0].shop);await fit(p);await shot(p,'next-round-shop');
 console.log('Checkpoint',checks.length+1);checks.push('倒计时只自动开战一次；战斗中切看其他棋手也能正常结算；无奖励选择时自动进入新一轮，锁店保留且招募自动展开');

 const phone=await newPage(sealStrategy(middle),390,844);await phone.locator('#ac-shop-close').tap();await phone.locator('#ac-phase-pause').tap();const phoneSeconds=await seconds(phone);await phone.clock.fastForward(40000);assert.equal(await seconds(phone),phoneSeconds);await phone.locator('#ac-phase-pause').tap();await phone.clock.fastForward((await seconds(phone))*1000+100);assert.equal(await phase(phone),'battle');await phone.locator('#ac-skip').tap();assert.equal(await phase(phone),'settle');await phone.clock.fastForward(5200);assert.equal(await phase(phone),'prep');await fit(phone);await shot(phone,'mobile-next-round');
 console.log('Checkpoint',checks.length+1);checks.push('手机可暂停与继续，时间到自动收起招募并开战，下一轮自动展开且页面保持一屏');
 const narrow=await newPage(sealStrategy(middle),320,568);await fit(narrow);await shot(narrow,'narrow-timer');
 assert.deepEqual(errors,[]);const report={url:base,checks,errors,browser:browser.version()};await fs.writeFile(path.join(out,'chess-phase-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
