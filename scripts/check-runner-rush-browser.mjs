import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {createRunner,stepRunner,runnerScene,sealRunner,replayRunner} from '../src/runner.mjs';
const url=(process.env.ARENA_URL||'http://127.0.0.1:4844').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/runner-rush-2026-11-19/browser');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
function mark(s){checks.push(s);console.log(s);}
async function page(w=390,h=844,reduced=false){
 const p=await browser.newPage({viewport:{width:w,height:h},isMobile:w<651,hasTouch:w<651,reducedMotion:reduced?'reduce':'no-preference'});p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.clock.pauseAt(Date.now()+1000);
 await p.addInitScript(()=>{
  localStorage.setItem('gameplay-v1:runner2-best-standard',JSON.stringify({score:999999,distance:9999}));
  window.runnerEffects=[];window.runnerAudioNodes=[];
  window.addEventListener('glimmer-effect',e=>window.runnerEffects.push({kind:e.detail,at:performance.now()}));
  const create=BaseAudioContext.prototype.createBufferSource;BaseAudioContext.prototype.createBufferSource=function(){const node=create.call(this),data={loop:false,started:false,stopped:false},start=node.start.bind(node),stop=node.stop.bind(node);window.runnerAudioNodes.push(data);node.start=(...args)=>{data.loop=node.loop;data.started=true;return start(...args);};node.stop=(...args)=>{data.stopped=true;return stop(...args);};return node;};
 });await p.goto(url+'/#runner');return p;
}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
async function record(p,name){const wait=p.waitForEvent('download');await p.locator('#runner-export').click();const dest=path.join(out,name+'.json');await(await wait).saveAs(dest);const r=JSON.parse(await fs.readFile(dest,'utf8'));replayRunner(r);return r;}
function collisionFixture(kind){
 const options={seed:17,difficulty:'standard'},inputs=[];let s=createRunner(options);
 while(s.phase!=='finished'&&s.z<1500){const row=runnerScene(s,140).find(r=>r.z+14>s.z),o=row?.obstacles.find(o=>o.kind===kind),target=o?.lane??row?.safe??1,actions=s.countdown?[]:target<s.lane?['left']:target>s.lane?['right']:[];if(actions.length)inputs.push({tick:s.tick,actions});s=stepRunner(s,actions);}
 assert.equal(s.reason?.kind,kind);return sealRunner(options,inputs,s);
}
try{
 for(const [kind,w,h]of [['train',390,844],['barrier',1366,768],['arch',390,844],['gap',1366,768]]){
  const p=await page(w,h),rec=collisionFixture(kind),file=path.join(out,'collision-'+kind+'.json');await fs.writeFile(file,JSON.stringify(rec));await p.locator('#upload').setInputFiles(file);
  await p.clock.runFor(rec.end.tick/60*1000-170);await shot(p,kind+'-approach');await p.clock.runFor(270);
  assert.equal(await p.locator('.runner-cabinet').getAttribute('data-phase'),'impact');assert.equal(await p.locator('#runner-overlay').isVisible(),false);await shot(p,kind+'-impact');
  const frozen=await p.locator('#runner-distance').textContent();await p.clock.runFor(350);assert.equal(await p.locator('#runner-overlay').isVisible(),false);assert.equal(await p.locator('#runner-distance').textContent(),frozen);await shot(p,kind+'-recoil');
  await p.clock.runFor(500);assert.equal(await p.locator('.runner-results').isVisible(),true);assert.deepEqual(await record(p,kind+'-end'),rec);await p.close();
 }
 mark('列车、路障、横梁和缺口均先展示碰撞或坠落，约 0.9 秒后结算，录像与最终成绩不受动画影响');
 const p=await page();assert.equal(await p.locator('#runner-level').inputValue(),'standard');assert.doesNotMatch(await p.locator('#runner-best').textContent(),/999,999|999999/);await p.locator('#runner-go').click();await p.clock.runFor(3300);assert.equal((await p.evaluate(()=>runnerAudioNodes)).length,0,'muted runner must not create sound nodes');await p.locator('#sound').click();await p.clock.runFor(1100);await p.keyboard.press('Space');
 for(let i=0;i<30&&!await p.evaluate(()=>runnerEffects.some(e=>e.kind==='runner-saved'));i++)await p.clock.runFor(16);
 assert.equal(await p.evaluate(()=>runnerEffects.filter(e=>e.kind==='runner-saved').length),1);await shot(p,'shield-break');const stopped=await record(p,'shield-contact');await p.clock.runFor(32);assert.equal((await record(p,'shield-hitstop')).end.tick,stopped.end.tick);await p.clock.runFor(180);assert.ok((await record(p,'shield-resume')).end.tick>stopped.end.tick);assert.ok(await p.evaluate(()=>runnerAudioNodes.some(n=>n.loop&&n.started)));
 await p.locator('#runner-pause').click();await p.clock.runFor(150);assert.ok(await p.evaluate(()=>runnerAudioNodes.filter(n=>n.loop&&n.started).every(n=>n.stopped)),'pause stops wind');await p.locator('#runner-go').click();await p.clock.runFor(150);await p.locator('#sound').click();assert.ok(await p.evaluate(()=>runnerAudioNodes.filter(n=>n.loop&&n.started).every(n=>n.stopped)),'mute stops wind');
 await p.clock.runFor(3000);assert.equal(await p.locator('.runner-results').isVisible(),true);await p.locator('#runner-go').click();await p.clock.runFor(3200);assert.equal((await record(p,'restart')).format,'runner-3');await p.locator('#runner-pause').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gameplay-v1:runner2-best-standard')).score),999999);await p.close();
 mark('护板真实挡住一撞，短暂停顿后继续；静音不开声音，暂停与关闭声音会停止风声，重开和旧纪录隔离正常');
 for(const version of [1,2]){const p=await page(390,844,true),file=path.join(project,'test/fixtures',version===1?'runner-1-pre-courier.json':'runner-2-pre-rush.json'),rec=JSON.parse(await fs.readFile(file,'utf8'));await p.locator('#upload').setInputFiles(file);await p.clock.runFor(rec.end.tick/60*1000+1100);assert.equal(await p.locator('.runner-results').isVisible(),true);assert.deepEqual(await record(p,'legacy-'+version),rec);await p.locator('#runner-reset').click();await p.locator('#runner-go').click();await p.clock.runFor(100);assert.equal((await record(p,'after-legacy-'+version)).format,'runner-3');await p.close();}
 mark('两代旧录像仍按原速度和碰撞规则播放，减少动态效果模式正常');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({url,checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
