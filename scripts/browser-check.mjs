import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {results,project} from './paths.mjs';
import {checkReplay} from '../src/arena.mjs';
import {replayStrategy} from '../src/strategy.mjs';
import {chromium} from './playwright.mjs';
const url=process.env.ARENA_URL||'http://127.0.0.1:4843';
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage();const errors=[],checks=[];
const track=p=>p.on('pageerror',e=>errors.push(e.message));track(page);
async function download(p,button,file){const wait=p.waitForEvent('download');await button.click();const d=await wait;await d.saveAs(path.join(results,file));const rec=JSON.parse(await fs.readFile(path.join(results,file),'utf8'));['glimmer-1','glimmer-2','glimmer-3'].includes(rec.format)?replayStrategy(rec):checkReplay(rec);return rec;}
try{
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/providers')),page.goto(url)]);
 assert.equal(await page.locator('[data-game=boxes]').count(),0);assert.equal(await page.locator('[data-game]').count(),5);
 await page.locator('#opponent').selectOption('planner');await page.locator('#start').click();await page.waitForTimeout(650);await page.locator('#start').click();const rec=await download(page,page.locator('#export'),'browser-snake-v2.json');assert.ok(rec.frames.length>0);checks.push('主动争食、暂停、导出和重演');
 await page.locator('[data-game=pong]').click();await page.locator('#difficulty').selectOption('easy');await page.locator('#start').click();await page.keyboard.down('ArrowLeft');await page.waitForTimeout(250);await page.keyboard.up('ArrowLeft');await page.waitForTimeout(1300);await page.locator('#start').click();await download(page,page.locator('#export'),'browser-pong-v2.json');checks.push('乒乓难度、键盘、发球与回放');
 await page.locator('[data-game=cards]').click();await page.locator('#card-keep').click();
 let moves=0;while(moves<12){
  await page.waitForFunction(()=>document.querySelector('.table-result')||document.querySelector('#card-end')&&!document.querySelector('#card-end').disabled);
  if(await page.locator('.table-result').count())break;
  let did=false;const hand=await page.locator('[data-hand]').count();
  for(let i=0;i<hand;i++){
   await page.locator('[data-hand]').nth(i).click();
   if(await page.locator('#card-play').count()&&await page.locator('#card-play').isEnabled()){await page.locator('#card-play').click();did=true;break;}
   if(await page.locator('.targetable:enabled').count()){await page.locator('.targetable:enabled').first().click();did=true;break;}
  }
  if(!did){const units=page.locator('.own-row .can-attack');if(await units.count()){await units.first().click();if(await page.locator('.targetable:enabled').count()){await page.locator('.targetable:enabled').first().click();did=true;}}}
  if(!did)await page.locator('#card-end').click();moves++;
 }
 assert.ok(moves>=8);await page.locator('#card-settings').click();await download(page,page.locator('#card-export'),'browser-cards.json');await page.locator('#settings-close').click();await page.screenshot({path:path.join(results,'微光牌局桌面.png'),fullPage:true});checks.push('牌局换起手、出牌选目标、单位攻击、AI 回合及回放');
 await page.locator('#card-settings').click();await page.locator('#deck-edit').click();assert.ok(await page.locator('#deck-dialog').isVisible());await page.locator('#deck-default').click();await page.locator('#deck-save').click();checks.push('构筑恢复预组并保存开局');
 await page.locator('[data-game=chess]').click();await page.waitForTimeout(400);
 for(let n=0;n<3;n++){const offers=page.locator('[data-buy]:enabled');if(await offers.count())await offers.first().click();}
 assert.ok(await page.locator('.ac-bench [data-uid]').count()>0);await page.locator('#ac-arrange').click();assert.ok(await page.locator('.ac-piece-layer .home-piece').count()>0);
 await page.screenshot({path:path.join(results,'微光棋阵桌面.png'),fullPage:true});await page.locator('#ac-ready').click();await page.locator('#ac-skip').waitFor();await page.waitForTimeout(400);await page.locator('#ac-skip').click();await page.locator('#ac-next').click();assert.match(await page.locator('.ac-round').innerText(),/第 2 轮/);await download(page,page.locator('#ac-export'),'browser-chess.json');checks.push('棋阵购买、布阵、战斗、跳过、经济结算和回放');
 await page.locator('#upload').setInputFiles(path.join(results,'browser-chess.json'));await page.waitForFunction(()=>document.querySelector('#ac-skip'));
 const firstFrame=await page.locator('.ac-piece-layer').innerHTML();await page.waitForFunction(before=>document.querySelector('.ac-piece-layer')?.innerHTML!==before,firstFrame,{timeout:5000});checks.push('棋阵载入动作回放后继续播放战斗帧');
 for(const game of ['cards','chess']){await page.setViewportSize({width:390,height:844});await page.locator('[data-game='+game+']').click();await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(results,game+'-mobile.png'),fullPage:true});}
 checks.push('390 像素下两款新游戏无横向溢出');await page.setViewportSize({width:1280,height:1000});
 // Two independent browser contexts use the actual authenticated room service.
 const context2=await browser.newContext({viewport:{width:1280,height:1000}}),peer=await context2.newPage();track(peer);await peer.goto(url);
 for(const game of ['cards']){
  await page.locator('[data-game='+game+']').click();if(game==='cards')await page.locator('#card-settings').click();await page.locator('#room-create').click();await page.locator('.waiting-room strong').waitFor();const code=await page.locator('.waiting-room strong').innerText();
  await peer.locator('[data-game='+game+']').click();if(game==='cards')await peer.locator('#card-settings').click();await peer.locator('#room-code').fill(code);await peer.locator('#room-join').click();await page.waitForTimeout(1100);
  await peer.reload();await peer.locator('[data-game='+game+']').click();await peer.locator('#room-clock').waitFor();
  await peer.waitForFunction(()=>/剩余 \d+ 秒/.test(document.querySelector('#room-clock')?.textContent));assert.match(await peer.locator('.room-controls').innerText(),new RegExp(code));
  if(game==='cards'){
   await page.locator('#card-keep').click();await peer.waitForTimeout(800);await peer.locator('#card-keep').click();
   await Promise.any([page,peer].map(p=>p.waitForFunction(()=>document.querySelector('#card-end')&&!document.querySelector('#card-end').disabled)));
   const mover=await page.locator('#card-end').isEnabled()?page:peer,other=mover===page?peer:page;
   await mover.locator('#card-end').click();await other.waitForFunction(()=>!document.querySelector('#card-end')?.disabled);assert.equal(await other.locator('#card-end').isEnabled(),true);
  }else{
   for(const p of [page,peer]){await p.locator('[data-buy]:enabled').first().click();await p.locator('#ac-arrange').click();await p.locator('#ac-ready').click();}
   await page.waitForTimeout(1000);assert.match(await page.locator('.table-status').innerText(),/战斗|购买|获胜/);
  }
  checks.push(game+' 独立客户端创建、加入、刷新恢复座位、倒计时与状态同步');
 }
 await context2.close();
 if(process.env.ARENA_CHECK_MODEL==='1'){
  const modelContext=await browser.newContext(),modelPage=await modelContext.newPage();track(modelPage);
  await Promise.all([modelPage.waitForResponse(r=>r.url().endsWith('/api/providers')),modelPage.goto(url)]);
  await modelPage.locator('[data-game=cards]').click();await modelPage.locator('#card-settings').click();await modelPage.locator('#card-opponent').selectOption('laya');await modelPage.locator('#card-keep').click();
  for(let i=0;i<5;i++){await modelPage.locator('#card-end').waitFor({state:'visible'});await modelPage.waitForFunction(()=>!document.querySelector('#card-end').disabled);await modelPage.locator('#card-end').click();await modelPage.waitForTimeout(1600);}
  await modelPage.waitForFunction(()=>!document.querySelector('#card-end').disabled);await modelPage.locator('#card-settings').click();const modeled=await download(modelPage,modelPage.locator('#card-export'),'browser-model-cards.json');await modelPage.locator('#settings-close').click();assert.ok(modeled.decisions.some(d=>d.source==='Laya'));
  checks.push('牌局实际 Laya 选择');await modelContext.close();
 }
 const offline=await context.newPage();track(offline);await offline.goto(pathToFileURL(path.join(project,'dist/index.html')).href);
 await offline.locator('[data-game=cards]').click();await offline.locator('#card-keep').click();await offline.locator('#card-settings').click();assert.equal(await offline.locator('#room-create').isDisabled(),true);await offline.locator('#settings-close').click();await offline.locator('[data-game=chess]').click();await offline.waitForTimeout(350);assert.equal(await offline.locator('[data-buy]').count(),5);checks.push('离线牌局、棋阵与明确禁用好友房');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(results,'browser-check-v3.json'),JSON.stringify({date:'2026-11-17',url,checks,errors,browser:browser.version()},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
