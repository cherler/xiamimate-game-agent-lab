import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {storageKey} from '../web/storage.mjs';
const base=(process.env.ARENA_URL||'http://127.0.0.1:4846/site').replace(/\/$/,''),out=path.join(project,'.runtime/rescue-siege/browser');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
const mark=s=>{checks.push(s);console.log(s);};
const audit=()=>{
 const Native=window.AudioContext,connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop;
 window.audioTest={contexts:[],sources:[],gestures:[]};let gesture='';for(const name of ['pointerdown','pointerup','touchend','click','keydown'])document.addEventListener(name,()=>{gesture=name;},true);
 window.AudioContext=class extends Native{
  constructor(...a){super(...a);this.probe=this.createAnalyser();this.probe.fftSize=2048;this.silent=this.createGain();this.silent.gain.value=0;connect.call(this.probe,this.silent);connect.call(this.silent,this.destination);audioTest.contexts.push(this);void super.suspend();}
  resume(){audioTest.gestures.push(gesture);if(!['pointerup','touchend','click','keydown'].includes(gesture))return Promise.reject(Error('Release gesture required'));return super.resume();}
 };
 AudioNode.prototype.connect=function(d,...args){if(d===this.context.destination&&this!==this.context.silent&&this.context.probe)connect.call(this,this.context.probe);return connect.call(this,d,...args);};
 AudioBufferSourceNode.prototype.start=function(...args){audioTest.sources.push(this);return start.apply(this,args);};AudioBufferSourceNode.prototype.stop=function(...args){this.stoppedAt=args[0]??this.context.currentTime;return stop.apply(this,args);};
 audioTest.active=()=>audioTest.sources.filter(s=>s.loop&&!(s.stoppedAt<=s.context.currentTime));audioTest.rms=()=>Math.max(0,...audioTest.contexts.map(c=>{const a=new Float32Array(2048);c.probe.getFloatTimeDomainData(a);return Math.sqrt(a.reduce((sum,v)=>sum+v*v,0)/a.length);}));
};
async function page(){const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(audit);return p;}
async function audible(p){await p.waitForFunction(()=>audioTest.active().length===1&&audioTest.rms()>.003&&document.querySelector('#runner-music').dataset.state==='playing',null,{timeout:15000});assert.equal(await p.locator('#runner-music').getAttribute('data-state'),'playing');}
try{
 const p=await page();let requests=0;await p.route('**/*skyline*.mp3',async route=>{requests++;if(requests===1)return route.abort('failed');return route.continue();});await p.goto(base+'/#runner');await p.locator('#runner-go').tap();await audible(p);assert.equal(requests,2);const gestures=await p.evaluate(()=>audioTest.gestures);assert.ok(gestures.includes('pointerdown')&&gestures.some(g=>['touchend','pointerup','click'].includes(g)));mark('模拟触屏只在抬手时允许音频：出发后音乐正常发声，首次下载失败自动重试');
 await p.locator('#runner-music').tap();await p.waitForFunction(()=>audioTest.active().length===0);await p.reload();await p.locator('#runner-go').tap();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>audioTest.active().length),0);assert.equal(await p.locator('#runner-music').getAttribute('data-state'),'muted');await p.locator('#runner-music').tap();await audible(p);mark('主动关闭音乐会保存，开局不会强行取消静音；画面内开关可直接恢复');
 await p.evaluate(()=>audioTest.contexts[0].suspend());await p.waitForFunction(()=>document.querySelector('#runner-music').dataset.state==='locked');await p.locator('#runner-music').tap();await audible(p);const bounds=await p.locator('#runner-music').boundingBox();assert.ok(bounds.width>=40&&bounds.height>=40&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844);await p.screenshot({path:path.join(out,'runner-music.png')});mark('音频被浏览器暂停后，点按恢复；手机画面内开关可触达');await p.close();
 const fail=await page();await fail.route('**/*skyline*.mp3',r=>r.abort('failed'));await fail.goto(base+'/#runner');await fail.locator('#runner-go').tap();await fail.waitForFunction(()=>document.querySelector('#runner-music').dataset.state==='error');await fail.unroute('**/*skyline*.mp3');await fail.locator('#runner-music').tap();await audible(fail);mark('连续下载失败显示重试按钮，网络恢复后无需刷新即可播放');await fail.close();
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'runner-music-report.json'),JSON.stringify({base,checks,errors,browser:browser.version()},null,2));
}finally{await browser.close();}
