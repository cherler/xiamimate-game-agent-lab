import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {createRunner,stepRunner,runnerScene,sealRunner,replayRunner} from '../src/runner.mjs';

const url=(process.env.ARENA_URL||'http://127.0.0.1:4843').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/runner-courier-2026-11-19/browser');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],checks=[],metrics=[];
async function page(w,h,slow=false){
 const p=await browser.newPage({viewport:{width:w,height:h},isMobile:w<651,hasTouch:w<651});p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install();await p.clock.pauseAt(Date.now()+1000);
 await p.addInitScript(slow=>{localStorage.setItem('gameplay-v1:runner-best-practice',JSON.stringify({score:999999,distance:9999}));if(slow){window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=clearTimeout;}},slow);
 await p.goto(url+'/#runner');return p;
}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
async function record(p,name){const wait=p.waitForEvent('download');await p.locator('#runner-export').click();const dest=path.join(out,name+'.json');await(await wait).saveAs(dest);const rec=JSON.parse(await fs.readFile(dest,'utf8'));replayRunner(rec);return rec;}
try{
 for(const [w,h]of [[1366,768],[1280,640],[390,844],[320,568],[844,390]]){
  const p=await page(w,h);assert.doesNotMatch(await p.locator('#runner-best').textContent(),/999999|999,999/);assert.equal(await p.locator('.runner-portrait').isVisible(),true);
  const m=await p.evaluate(()=>{const canvas=document.querySelector('#runner-canvas').getBoundingClientRect(),go=document.querySelector('#runner-go').getBoundingClientRect();return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,canvas:{top:canvas.top,bottom:canvas.bottom,height:canvas.height},go:{top:go.top,bottom:go.bottom}};});
  assert.ok(m.sw<=w&&m.sh<=h+1&&m.canvas.height>=130&&m.go.top>=m.canvas.top&&m.go.bottom<=m.canvas.bottom,JSON.stringify(m));metrics.push(m);await shot(p,'welcome-'+w+'x'+h);
  await p.locator('#runner-go').click();await p.clock.runFor(4100);await p.keyboard.press('ArrowLeft');await p.clock.runFor(100);await p.keyboard.press('ArrowUp');await p.clock.runFor(260);await shot(p,'jump-'+w+'x'+h);await p.keyboard.press('ArrowDown');await p.clock.runFor(100);await shot(p,'roll-'+w+'x'+h);
  await p.locator('#runner-pause').click();const rec=await record(p,'motion-'+w+'x'+h),state=replayRunner(rec);assert.equal(rec.format,'runner-3');assert.equal(state.jump,-1);assert.ok(state.roll>0);const before=await p.locator('#runner-distance').textContent();await p.clock.runFor(500);assert.equal(await p.locator('#runner-distance').textContent(),before);
  await p.locator('[data-game=kart]').click();await p.locator('[data-game=runner]').click();assert.deepEqual(await record(p,'returned-'+w+'x'+h),rec);await p.close();
 }
 checks.push('阿米欢迎、跳跃、蜷缩翻滚在五种屏幕尺寸完整显示；暂停和切换不丢对局');console.log(checks.at(-1));
 const options={seed:17,difficulty:'standard'},inputs=[],milestones=[];let s=createRunner(options);
 while(s.z<1100){const row=runnerScene(s,140).find(r=>r.z+14>s.z),target=row?.safe??1,actions=s.countdown?[]:target<s.lane?['left']:target>s.lane?['right']:[];if(actions.length)inputs.push({tick:s.tick,actions});s=stepRunner(s,actions);assert.notEqual(s.phase,'finished');if(milestones.length===0&&s.z>=120||milestones.length===1&&s.z>=460||milestones.length===2&&s.z>=860)milestones.push(s.tick);}
 const fixture=path.join(out,'three-districts.json'),rec=sealRunner(options,inputs,s);await fs.writeFile(fixture,JSON.stringify(rec));
 const p=await page(1366,768,true);await p.locator('#upload').setInputFiles(fixture);let elapsed=0;
 for(let i=0;i<milestones.length;i++){const target=milestones[i]/60*1000+150;await p.clock.runFor(target-elapsed);elapsed=target;assert.equal(await p.locator('#runner-zone').textContent(),['晨光车站','桥下市集','滨河栈桥'][i]);await shot(p,['station','market','river'][i]);}
 await p.clock.runFor(rec.end.tick/60*1000+300-elapsed);await p.locator('#runner-replay-again').waitFor();assert.deepEqual(await record(p,'three-districts-end'),rec);await p.locator('#runner-replay-again').click();await p.clock.runFor(300);assert.equal(await p.locator('#runner-zone').textContent(),'晨光车站');checks.push('新路线可穿过车站、市集、滨河栈桥，录像完整播放并可重新观看');console.log(checks.at(-1));
 const old=path.join(project,'test/fixtures/runner-1-pre-courier.json');await p.locator('#upload').setInputFiles(old);await p.clock.runFor(17000);await p.locator('.runner-results').waitFor();assert.equal(await p.locator('#runner-route').isVisible(),false);assert.equal((await record(p,'old-route')).format,'runner-1');await p.locator('#runner-reset').click();await p.locator('#runner-go').click();await p.clock.runFor(100);assert.equal((await record(p,'new-after-old')).format,'runner-3');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gameplay-v1:runner-best-practice')).score),999999);await p.close();checks.push('旧路线录像保持原规则；重新出发进入新路线，旧版纪录没有被覆盖');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({url,checks,metrics,errors},null,2));console.log(JSON.stringify({checks,errors,layouts:metrics.length},null,2));
}finally{await browser.close();}
