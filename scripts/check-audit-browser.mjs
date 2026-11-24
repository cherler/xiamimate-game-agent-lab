import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from './playwright.mjs';
import {createRhythm} from '../src/rhythm.mjs';
import {replayStrategy} from '../src/strategy.mjs';
const out='.runtime/audit-implementation-20261124',errors=[],checks=[];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
async function page(game,width=390,height=844){
 const p=await browser.newPage({viewport:{width,height},hasTouch:width<1000,isMobile:width<1000,reducedMotion:'reduce'});
 p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(game+': '+e.message));
 await p.clock.install();await p.clock.pauseAt(Date.now()+1000);
 if(game==='dance')await p.addInitScript(()=>{AudioContext.prototype.getOutputTimestamp=function(){return {contextTime:this.currentTime,performanceTime:performance.now()};};const base=BaseAudioContext.prototype,read=Object.getOwnPropertyDescriptor(base,'currentTime').get,anchors=new WeakMap();Object.defineProperty(base,'currentTime',{configurable:true,get(){if(!anchors.has(this))anchors.set(this,{audio:read.call(this),now:performance.now()});const a=anchors.get(this);return a.audio+(performance.now()-a.now)/1000;}});});
 await p.goto('http://127.0.0.1:4841/#'+game);return p;
}
const shot=(p,name)=>p.screenshot({path:out+'/'+name+'.png'});
const menu=p=>p.locator('#screen-menu').click();
const closeMenu=p=>p.locator('#screen-settings-close').click();
try{
 for(const [width,height] of [[390,844],[844,390],[932,430],[320,568]]){
  const p=await page('chess',width,height);await p.locator('#ac-shop-close').click();
  const boxes=await p.evaluate(()=>{const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {w:b.width,h:b.height,x:b.x,y:b.y,bottom:b.bottom};};return {board:rect('.ac-board'),bench:rect('.ac-bench'),slot:rect('.ac-bench-slot'),table:rect('.ac-table'),scroll:document.documentElement.scrollHeight>innerHeight};});
  assert.ok(boxes.slot.w>=44&&boxes.slot.h>=44,JSON.stringify(boxes));assert.ok(boxes.bench.bottom<=height);assert.equal(boxes.scroll,false);
  await shot(p,'chess-'+width);
  await p.locator('#ac-shop-toggle').click();const buy=p.locator('[data-buy]:not([disabled])').first(),slot=await buy.getAttribute('data-buy');await p.locator('[data-preview="'+slot+'"]').click();await p.locator('#ac-preview-buy').click();await p.locator('#ac-shop-close').click();
  const from=await p.locator('.ac-bench [data-uid]').first().boundingBox(),to=await p.locator('[data-cell="35"]').boundingBox(),cdp=await p.context().newCDPSession(p);
  const x=from.x+from.width/2,y=from.y+from.height/2,tx=to.x+to.width/2,ty=to.y+to.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x+(tx-x)*i/8,y:y+(ty-y)*i/8}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  const saved=JSON.parse(await p.evaluate(()=>localStorage.getItem('gameplay-v1:glimmer-chess-save')));assert.equal(replayStrategy(saved).players[0].units[0].cell,35);
  await shot(p,'chess-deployed-'+width);await p.locator('#ac-ready').click();assert.equal(await p.locator('.ac-board-viewport.focus-home').count(),0);
  await p.locator('#ac-skip').click();if(await p.locator('[data-loot]').count())await p.locator('[data-loot]').first().click();
  await p.locator('#ac-next').click();await p.locator('#ac-last-round').click();assert.ok(await p.locator('#ac-preview[open]').isVisible());await shot(p,'chess-recap-'+width);
  checks.push({game:'chess',width,...boxes});await p.close();
 }
 for(const [width,height] of [[390,844],[844,390],[932,430],[320,568]]){
  const p=await page('cards',width,height);await p.locator('.mulligan-mark small').first().waitFor();await shot(p,'cards-mulligan-'+width);await p.locator('#card-keep').click();await p.clock.runFor(3000);
  const card=p.locator('.hand-card[data-cost="3"],.hand-card[data-cost="4"],.hand-card[data-cost="5"],.hand-card[data-cost="6"]').first();if(await card.count()){await card.click();assert.match(await p.locator('.card-guidance').innerText(),/差/);}
  for(const node of await p.locator('.deck-stack').all()){const box=await node.boundingBox();assert.ok(box&&box.width>=20&&box.height>10);assert.ok(box.x>=0&&box.x+box.width<=width);}
  await shot(p,'cards-guidance-'+width);checks.push({game:'cards',width,deckBadges:await p.locator('.deck-stack:visible').count()});await p.close();
 }
 const snake=await page('snake');assert.ok(await snake.locator('#snake-rule').isVisible());await menu(snake);await snake.locator('#snake-pace').selectOption('650');await closeMenu(snake);await snake.locator('#start').click();await snake.clock.runFor(10000);assert.ok(await snake.locator('#result-retry').isVisible());assert.match(await snake.locator('#result-reason').innerText(),/碰撞/);await shot(snake,'snake-retry');await snake.locator('#result-retry').click();assert.equal(await snake.locator('#status').textContent(),'对局中');checks.push({game:'snake',retry:true});await snake.close();
 const pong=await page('pong');await pong.locator('#start').click();await pong.clock.runFor(1500);await pong.locator('#pong-power').click();await pong.clock.runFor(20);assert.ok(await pong.locator('#pong-power small').isVisible());assert.equal(await pong.locator('#pong-power').getAttribute('aria-pressed'),'true');await shot(pong,'pong-armed');checks.push({game:'pong',armed:true});await pong.close();
 const rescue=await page('rescue',844,390);await rescue.locator('#screen-pause').click();const map=await rescue.locator('#rescue-board').boundingBox();await rescue.touchscreen.tap(map.x+18/24*map.width,map.y+12/16*map.height);await rescue.clock.runFor(7000);assert.ok(await rescue.locator('.rs-escort').count());await shot(rescue,'rescue-escort');checks.push({game:'rescue',escort:await rescue.locator('#rs-field-goals').innerText()});await rescue.close();
 const runner=await page('runner');await runner.locator('#runner-go').click();await runner.clock.runFor(10000);assert.ok(await runner.locator('#runner-practice').isVisible());const lostDistance=Number(await runner.locator('#runner-distance').innerText());await shot(runner,'runner-coaching');await runner.locator('#runner-practice').click();const practiceDistance=Number(await runner.locator('#runner-distance').innerText());assert.ok(practiceDistance<lostDistance);assert.equal(await runner.locator('#runner-pop').innerText(),'片段练习');checks.push({game:'runner',lostDistance,practiceDistance});await runner.close();
 const kart=await page('kart',844,390);assert.ok(await kart.locator('[aria-label="下一瓶氮气"]').isVisible());await shot(kart,'kart-two-meters');checks.push({game:'kart',separateMeters:true});await kart.close();
 const dance=await page('dance',844,390);assert.equal(await dance.locator('[data-lane-feedback]').count(),4);await menu(dance);await dance.locator('#rhythm-hit-sounds').check();await dance.locator('#rhythm-level').selectOption('standard');await closeMenu(dance);await shot(dance,'dance-ready');
 await dance.locator('#rhythm-go').click();await dance.locator('.motion-overlay.counting').waitFor();const model=createRhythm({difficulty:'standard'}),keys=['KeyD','KeyF','KeyJ','KeyK'];
 const events=model.notes.flatMap(n=>[{type:'down',time:n.at+125,lane:n.lane},{type:'up',time:n.at+n.duration+145,lane:n.lane}]).sort((a,b)=>a.time-b.time);let at=await dance.locator('#rhythm-progress').evaluate((n,d)=>n.value*d,model.duration);
 for(const e of events){await dance.clock.runFor(Math.max(0,e.time-at));at=e.time;await dance.keyboard[e.type](keys[e.lane]);}
 await dance.clock.runFor(model.duration-at+200);await shot(dance,'dance-before-calibration');console.log('dance result',await dance.locator('#rhythm-overlay').innerText(),await dance.locator('#rhythm-progress').getAttribute('value'));await dance.locator('#rhythm-calibrate').waitFor();const button=await dance.locator('#rhythm-calibrate').boundingBox();assert.ok(button.y>=0&&button.y+button.height<=390);await shot(dance,'dance-timing-result');await dance.locator('#rhythm-calibrate').click();assert.ok(Number(await dance.locator('#rhythm-offset').inputValue())>=40);
 checks.push({game:'dance',laneFeedback:4,hitSoundToggle:true,calibratedOffset:await dance.locator('#rhythm-offset').inputValue()});await dance.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify(checks,null,2));
}finally{await fs.writeFile(out+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
