import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {createKart,stepKart,kartAI,sealKart,replayKart} from '../src/kart.mjs';

const url=(process.env.ARENA_URL||'http://127.0.0.1:4843').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/kart-smooth-2026-11-19');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],metrics=[],checks=[];
async function page(width,height,hz=60,touch=false){
 const p=await browser.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch});p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install();await p.clock.pauseAt(Date.now()+1000);
 await p.addInitScript(hz=>{
  window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),1000/hz);window.cancelAnimationFrame=clearTimeout;
  window.kartMotionFrames=[];const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
   if(this.canvas.id==='kart-canvas'&&text==='橘子')window.kartMotionFrames.push({time:performance.now(),x,y});
   return original.call(this,text,x,y,...rest);
  };
 },hz);return p;
}
async function record(p,name){const waiting=p.waitForEvent('download');await p.locator('#kart-export').click();const dest=path.join(out,name+'.json');await(await waiting).saveAs(dest);const data=JSON.parse(await fs.readFile(dest,'utf8'));replayKart(data);return data;}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
try{
 for(const [w,h,hz,touch]of [[1366,768,60,false],[1366,768,120,false],[390,844,60,true]]){
  const p=await page(w,h,hz,touch);await p.goto(url+'/#kart');await p.locator('#kart-auto').uncheck();await p.locator('#kart-go').click();await p.clock.runFor(9500);
  const frames=await p.evaluate(()=>[...new Map(window.kartMotionFrames.map(f=>[f.time,f])).values()]);assert.ok(frames.length>150);
  const dy=frames.slice(1).map((f,i)=>frames[i].y-f.y),height=await p.locator('#kart-canvas').evaluate(n=>n.height);
  const frozen=dy.filter(d=>Math.abs(d)<1e-7).length;assert.equal(frozen,0,'对手不应停在路面分段上');assert.ok(dy.every(d=>d>0));assert.ok(Math.max(...dy)<height*.02);
  metrics.push({width:w,height:h,hz,frames:frames.length,frozen,maxStep:Math.max(...dy)});await shot(p,'moving-'+w+'-'+hz);
  await p.locator('#kart-pause').click();const paused=await record(p,'paused-'+w+'-'+hz);await p.clock.runFor(500);assert.deepEqual(await record(p,'still-paused-'+w+'-'+hz),paused);
  await p.locator('[data-game=runner]').click();await p.locator('[data-game=kart]').click();assert.deepEqual(await record(p,'returned-'+w+'-'+hz),paused);
  if(touch){
   await p.locator('#kart-auto').check();await p.locator('#kart-go').click();await p.clock.runFor(600);
   const cdp=await p.context().newCDPSession(p),right=await p.locator('[data-drive=right]').boundingBox(),drift=await p.locator('[data-drive=drift]').boundingBox();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:right.x+right.width/2,y:right.y+right.height/2},{id:2,x:drift.x+drift.width/2,y:drift.y+drift.height/2}]});await p.clock.runFor(300);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.clock.runFor(100);await p.locator('#kart-pause').click();const touchRecord=await record(p,'touch-combination');
   assert.ok(touchRecord.inputs.some(i=>i.input.gas&&i.input.steer===1&&i.input.drift));assert.equal(touchRecord.inputs.at(-1).input.steer,0);assert.equal(touchRecord.inputs.at(-1).input.drift,false);
  }
  await p.close();console.log(w+' × '+h+', '+hz+' Hz: no frozen opponent frames');
 }
 checks.push('浏览器真实绘图在桌面 60/120 Hz 与手机视口逐帧前进；暂停、切换、双指漂移和取消触摸正常');
 const p=await page(1366,768);await p.goto(url+'/#kart');
 const fixture=path.join(project,'test/fixtures/kart-1-pre-smoothing.json'),legacy=JSON.parse(await fs.readFile(fixture,'utf8'));replayKart(legacy);
 await p.locator('#upload').setInputFiles(fixture);await p.clock.runFor(6000);await p.locator('#kart-replay-again').waitFor();assert.deepEqual(await record(p,'legacy-unchanged'),legacy);
 await p.locator('#kart-replay-again').click();await p.clock.runFor(100);assert.ok((await p.locator('#kart-time').textContent()).startsWith('0:00'));checks.push('更新前的赛车录像原样校验通过，播放结束后可再次观看');
 for(const track of ['harbor','ridge']){
  const options={track,difficulty:'standard',seed:17},inputs=[];let s=createKart(options);
  while(s.tick<1200){const input=kartAI(s,0);inputs.push({tick:s.tick,input});s=stepKart(s,input);}
  const file=path.join(out,'corner-'+track+'.json');await fs.writeFile(file,JSON.stringify(sealKart(options,inputs,s)));await p.locator('#upload').setInputFiles(file);await p.clock.runFor(11500);await shot(p,'corner-'+track);await p.clock.runFor(9000);await p.locator('#kart-replay-again').waitFor();
 }
 checks.push('两条赛道的连续弯道录像可完整播放');await p.close();
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({url,checks,metrics,errors,browser:browser.version()},null,2));console.log(JSON.stringify({checks,metrics,errors},null,2));
}finally{await browser.close();}
