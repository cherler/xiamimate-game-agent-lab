import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {replayRunner} from '../src/runner.mjs';
import {runnerLaneHazards} from '../web/runner-view.mjs';
const url=(process.env.ARENA_URL||'http://127.0.0.1:4846/site').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/runner-depth-2026-11-19/side-check');
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],checks=[];
async function record(p,name){const wait=p.waitForEvent('download');await p.locator('#runner-export').click();const file=path.join(out,name+'.json');await(await wait).saveAs(file);return replayRunner(JSON.parse(await fs.readFile(file,'utf8')));}
try{
 for(const side of ['left','right'])for(const passTail of [false,true]){
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.clock.install();await p.clock.pauseAt(Date.now()+1000);await p.goto(url+'/#runner');assert.equal(await p.locator('#runner-canvas').evaluate(c=>getComputedStyle(c).filter),'none');
  await p.locator('#runner-go').tap();await p.clock.runFor(3800);await p.locator(`[data-runner="${side}"]`).tap();await p.clock.runFor(passTail?1300:1000);
  const label=side+(passTail?'-tail-passed':'-alongside'),before=await record(p,label+'-before'),hazard=runnerLaneHazards(before)[1];
  assert.equal(before.phase,'running');if(passTail)assert.notEqual(hazard?.obstacle.id,'0-1');else{assert.equal(hazard.obstacle.id,'0-1');assert.equal(hazard.alongside,true);assert.ok(before.z>56&&before.z<68);}
  await p.screenshot({path:path.join(out,label+'-before.png')});await p.locator(`[data-runner="${side==='left'?'right':'left'}"]`).tap();await p.clock.runFor(160);const after=await record(p,label+'-after');assert.equal(after.phase,passTail?'running':'finished');if(!passTail)assert.equal(after.reason.kind,'train');else assert.equal(after.lane,1);
  await p.screenshot({path:path.join(out,label+'-after.png')});checks.push({side,passTail,before:before.z,after:after.z,result:after.phase});await p.close();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({url,checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
