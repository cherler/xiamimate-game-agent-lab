import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
const base=process.env.ARENA_URL||'http://127.0.0.1:4846/site',out=path.join(project,'.runtime/play-first/access');await fs.mkdir(out,{recursive:true});
const check=await fs.readFile(path.join(project,'scripts/check-music-browser.mjs'),'utf8'),audit=check.slice(check.indexOf('const audit=()=>{'),check.indexOf('async function page(options'))+'audit();';
const browser=await chromium.launch({headless:true}),results=[],errors=[];
const targets={snake:'#start',pong:'#start',cards:'#card-keep',chess:'[data-buy]:enabled',rescue:'#rs-start',kart:'#kart-go',dance:'#rhythm-go',runner:'#runner-go'};
const hit=async(p,selector)=>p.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.disabled).map(n=>{const r=n.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:n.id,reachable:n===at||n.contains(at),x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
try{
 for(const [game,start]of Object.entries(targets)){
  const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(audit);await p.goto(base+'/#'+game);await p.locator(start).first().click();
  await p.waitForFunction(()=>Math.max(...__musicAudit.rms())>.001,null,{timeout:20000});const rms=await p.evaluate(()=>Math.max(...__musicAudit.rms()));
  await p.locator('#play-settings').click();assert.equal(await p.locator('[data-screen-settings]:visible').count(),1);await p.locator('[data-screen-settings]:visible [data-audio-settings]').click();assert.ok(await p.locator('#audio-settings').isVisible());await p.locator('#audio-close').click();
  const panel=await p.locator('[data-screen-settings]:visible').boundingBox();assert.ok(panel.y>=0&&panel.y+panel.height<=900);await p.screenshot({path:path.join(out,game+'-settings.png')});await p.locator('#screen-settings-close').click();assert.equal(await p.locator('[data-screen-settings]:visible').count(),0);
  if(['runner','kart','dance'].includes(game)){assert.ok(await p.locator('#play-pause').isVisible());await p.locator('#play-pause').click();}
  if(game==='pong'){const controls=await hit(p,'#pong-view,#pong-rotate,#pad button');assert.ok(controls.every(c=>c.reachable&&c.bottom<=900),JSON.stringify(controls));}
  results.push({game,musicSignal:rms,settings:true});console.log(game+': sound and settings reachable');await p.close();
 }
 for(const [width,height]of [[667,375],[844,390],[932,430]]){
  const p=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});await p.goto(base+'/#rescue');const buttons=await hit(p,'#rs-retreat,#rs-hold,#rs-gate,#rs-zoom');assert.ok(buttons.every(c=>c.reachable&&c.right<=width&&c.bottom<=height),JSON.stringify(buttons));await p.locator('#screen-pause').click();await p.locator('#rs-hold').tap();await p.locator('#rs-retreat').tap();await p.close();results.push({game:'rescue',width,height,buttons});
 }
 for(const width of [320,390]){
  const p=await browser.newPage({viewport:{width,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});await p.clock.install();await p.clock.pauseAt(Date.now()+1000);await p.addInitScript(()=>{crypto.getRandomValues=a=>{a.fill(1);return a;};});await p.goto(base+'/#cards');await p.locator('#card-keep').click();await p.clock.runFor(3000);await p.locator('#card-end').click();await p.clock.runFor(8000);await p.locator('.hand-card').first().click();assert.ok(await p.locator('#card-cycle').isVisible());const buttons=await hit(p,'.turn-actions button');assert.ok(buttons.every(c=>c.reachable&&c.x>=0&&c.right<=width),JSON.stringify(buttons));await p.locator('#card-cancel').tap();await p.locator('.hand-card').first().tap();await p.locator('#card-cycle').tap();await p.clock.runFor(2000);assert.equal(await p.locator('#card-cycle').count(),0);await p.screenshot({path:path.join(out,'cards-cycle-'+width+'.png')});await p.close();results.push({game:'cards',width,buttons});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({results,errors,browser:browser.version()},null,2));
}finally{await browser.close();}
