import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {storageKey} from '../web/storage.mjs';
import {beginRescue,sealRescue,replayRescue} from '../src/rescue.mjs';
import {createRhythm,replayRhythm} from '../src/rhythm.mjs';
const base=(process.env.ARENA_URL||'http://127.0.0.1:4847/site').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.join(project,'.runtime/mobile-playfield/check');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],metrics=[],checks=[];
const mark=text=>{checks.push(text);console.log(text);};
async function page(w=390,h=844,mode='missing'){
 const p=await browser.newPage({viewport:{width:w,height:h},hasTouch:true,isMobile:true,reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(7000);
 await p.addInitScript(({mode,key})=>{
  if(mode==='missing'||mode==='rejected'){Element.prototype.requestFullscreen=mode==='missing'?undefined:()=>Promise.reject(Error('unsupported'));Element.prototype.webkitRequestFullscreen=undefined;}
  if(mode==='lock-rejected')screen.orientation.lock=()=>Promise.reject(Error('unsupported'));
  const saved=sessionStorage.getItem('playfield-pending');if(saved){localStorage.setItem(key,saved);sessionStorage.removeItem('playfield-pending');}
 },{mode,key:storageKey('glimmer-rescue-save')});return p;
}
async function restore(p,level=2){await p.evaluate(r=>sessionStorage.setItem('playfield-pending',JSON.stringify(r)),sealRescue(beginRescue({level})));await p.reload();await p.locator('#rescue-board').waitFor();}
async function menu(p){if(!await p.locator('#screen-settings-head').isVisible())await p.locator('#screen-menu').tap();}
const closeMenu=p=>p.locator('#screen-settings-close').tap();
const shot=(p,name)=>p.screenshot({path:path.join(out,name+'.png')});
async function exported(p,id,name){await menu(p);const pending=p.waitForEvent('download');await p.locator('#'+id+'-export').tap();const file=path.join(out,name+'.json');await(await pending).saveAs(file);await closeMenu(p);return JSON.parse(await fs.readFile(file,'utf8'));}
async function reachable(p,selector){const result=await p.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.disabled).map(n=>{const r=n.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:n.id,hit:n===at||n.contains(at),inside:r.x>=-.1&&r.y>=-.1&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1};}));assert.ok(result.length&&result.every(n=>n.hit&&n.inside),JSON.stringify(result));}
async function measured(p,game,label){
 await p.waitForFunction(selector=>{const c=document.querySelector(selector);return c&&Math.abs(c.width/c.height-c.clientWidth/c.clientHeight)<.01;},game==='rescue'?'#rescue-board':'#rhythm-canvas');
 const m=await p.locator(game==='rescue'?'#rescue-board':'#rhythm-canvas').evaluate((c,{game,label})=>{const r=c.getBoundingClientRect();return {game,label,w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,logicalW:c.clientWidth,logicalH:c.clientHeight,backingW:c.width,backingH:c.height,share:r.width*r.height/(innerWidth*innerHeight),rotated:document.body.classList.contains('screen-rotated')};},{game,label});
 assert.ok(m.sw<=m.w+1&&m.sh<=m.h+1&&m.x>=-.1&&m.y>=-.1&&m.right<=m.w+1&&m.bottom<=m.h+1,JSON.stringify(m));
 assert.ok(m.share>=(game==='rescue'?.60:.75),JSON.stringify(m));
 if(game==='rescue')assert.ok(Math.abs(m.logicalW/m.logicalH-(m.logicalW>m.logicalH?1.5:2/3))<.006,JSON.stringify(m));
 assert.ok(Math.abs(m.backingW/m.backingH-m.logicalW/m.logicalH)<.01,'canvas backing stays in logical orientation');metrics.push(m);return m;
}
async function worldPoint(p,x,y){return p.locator('#rescue-board').evaluate((c,{x,y})=>{const r=c.getBoundingClientRect(),tall=c.clientHeight>c.clientWidth,fx=tall?1-y/16:x/24,fy=tall?x/24:y/16;return document.body.classList.contains('screen-rotated')?{x:r.right-fy*r.width,y:r.top+fx*r.height}:{x:r.left+fx*r.width,y:r.top+fy*r.height};},{x,y});}
async function controlled(p){await p.clock.install();await p.clock.pauseAt(Date.now()+1000);await p.addInitScript(()=>{AudioContext.prototype.getOutputTimestamp=function(){return {contextTime:this.currentTime,performanceTime:performance.now()};};const base=BaseAudioContext.prototype,read=Object.getOwnPropertyDescriptor(base,'currentTime').get,anchors=new WeakMap();Object.defineProperty(base,'currentTime',{configurable:true,get(){if(!anchors.has(this))anchors.set(this,{audio:read.call(this),now:performance.now()});const a=anchors.get(this);return a.audio+(performance.now()-a.now)/1000;}});});}
async function point(p,selector,id=1){const b=await p.locator(selector).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2,id};}
try{
 for(const [w,h]of [[360,640],[640,360],[390,844],[844,390],[320,568],[568,320]]){
  const p=await page(w,h);for(const game of ['rescue','dance']){
   await p.goto(base+'/#'+game);await measured(p,game,'natural');await reachable(p,'#screen-menu,#screen-fullscreen,#screen-games-toggle');
   if(game==='rescue')await reachable(p,'#rs-retreat,#rs-hold,#rs-gate,#rs-zoom');
   await shot(p,game+'-'+w+'x'+h);
   if(w<h){await p.locator('#screen-fullscreen').tap();await measured(p,game,'web-landscape');assert.equal(await p.locator('body').evaluate(n=>n.classList.contains('screen-rotated')),true);await reachable(p,'#screen-menu,#screen-fullscreen,#screen-games-toggle');await shot(p,game+'-turned-'+w);
    await menu(p);await reachable(p,'#screen-settings-close');await p.locator('[data-screen-settings]:visible [data-audio-settings]').tap();await reachable(p,'#audio-close');await p.locator('#audio-close').tap();await closeMenu(p);
    await p.locator('#screen-games-toggle').tap();await reachable(p,'#screen-games-close,[data-screen-game]');await p.locator('#screen-games-close').tap();await p.locator('#screen-fullscreen').tap();assert.equal(await p.locator('body').evaluate(n=>n.classList.contains('screen-rotated')),false);
   }
  }await p.close();
 }
 mark('两款游戏六种手机尺寸：主画面占比、原生横竖屏、网页横屏及设置/选游戏/音量入口可用');
 for(const mode of ['missing','rejected','lock-rejected']){
  const p=await page(390,844,mode);await p.goto(base+'/#rescue');await restore(p);await p.locator('#screen-pause').tap();await p.locator('#screen-pause').tap();
  // Emulate a device rotation without resizing Chromium's native fullscreen window.
  const rotate=async(width,height)=>{if(mode!=='lock-rejected')return p.setViewportSize({width,height});const cdp=await p.context().newCDPSession(p);await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile:true,screenOrientation:{type:width>height?'landscapePrimary':'portraitPrimary',angle:width>height?90:0}});await cdp.detach();};
  for(const view of ['portrait','web-landscape','physical-landscape']){
   if(view==='web-landscape')await p.locator('#screen-fullscreen').tap();
   if(view==='physical-landscape'){await rotate(844,390);await p.waitForFunction(()=>!document.body.classList.contains('screen-rotated'));}
   const dest=await worldPoint(p,19.5,4.5);await p.touchscreen.tap(dest.x,dest.y);assert.equal(await p.locator('#rescue-board').getAttribute('data-order'),'accepted');
   const record=await exported(p,'rs',mode+'-'+view),move=record.commands.filter(c=>c.command.type==='move').at(-1).command;assert.ok(Math.abs(move.x-19.5)<.05&&Math.abs(move.y-4.5)<.05,JSON.stringify(move));assert.equal(move.ids.length,5);replayRescue(record);
   if(view==='web-landscape'){
    await p.locator('#rs-zoom').tap();const before=await p.locator('.rs-map-wrap').evaluate(n=>({left:n.scrollLeft,top:n.scrollTop})),cdp=await p.context().newCDPSession(p),from=await point(p,'.rs-map-wrap');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...from,y:from.y-50}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await p.locator('.rs-map-wrap').evaluate(n=>({left:n.scrollLeft,top:n.scrollTop}));assert.ok(after.left>before.left+30,JSON.stringify({before,after}));
    const noMove=await exported(p,'rs',mode+'-pan');assert.equal(noMove.commands.filter(c=>c.command.type==='move').length,record.commands.filter(c=>c.command.type==='move').length,'panning must not issue orders');
   }
  }
  assert.equal(await p.locator('#rs-zoom').getAttribute('aria-pressed'),'false');
  await rotate(390,844);await p.waitForFunction(()=>document.body.classList.contains('screen-rotated'));await p.locator('#screen-fullscreen').tap();assert.equal(await p.locator('#rescue-board').getAttribute('data-level'),'2');
  await p.locator('#screen-fullscreen').tap();await p.locator('#screen-games-toggle').tap();await p.locator('[data-screen-game=runner]').tap();assert.equal(await p.locator('body').evaluate(n=>n.classList.contains('screen-rotated')),false);await p.locator('#screen-games-toggle').tap();await p.locator('#screen-windowed').tap();await p.locator('.site-head').waitFor();await p.close();
 }
 mark('缺少/拒绝全屏、拒绝方向锁定均可横屏：三种朝向下点同一房间均指挥全队，拖图不误下命令，旋转返回保留进度');
 const native=await page(390,844,'lock-rejected');await native.goto(base+'/#runner');await native.locator('#screen-fullscreen').tap();await native.waitForFunction(()=>!!document.fullscreenElement);await native.locator('#screen-games-toggle').tap();await native.locator('[data-screen-game=dance]').tap();assert.equal(await native.locator('#screen-fullscreen').textContent(),'横屏玩');await native.locator('#screen-fullscreen').tap();await native.waitForFunction(()=>document.body.classList.contains('screen-rotated'));assert.ok(await native.evaluate(()=>!!document.fullscreenElement));await native.locator('#screen-fullscreen').tap();await native.waitForFunction(()=>!document.fullscreenElement);await native.close();mark('从其他游戏的原生全屏切入舞台后，横屏玩仍会旋转画面');
 const maps=await page();await maps.goto(base+'/#rescue');for(const level of [1,2,3,4,5,6]){await restore(maps,level);await measured(maps,'rescue','level-'+level);await shot(maps,'portrait-level-'+level);await maps.locator('#screen-fullscreen').tap();await measured(maps,'rescue','turned-level-'+level);await reachable(maps,'#rs-retreat,#rs-hold,#rs-gate,#rs-zoom');await maps.locator('#screen-fullscreen').tap();}await maps.close();mark('六张救援地图完整保留，竖屏不裁掉房间，横屏不拉伸单位');
 const p=await page(360,640);await controlled(p);await p.goto(base+'/#dance');await p.locator('#screen-fullscreen').tap();await menu(p);await p.locator('#rhythm-level').selectOption('standard');await closeMenu(p);await p.locator('#rhythm-go').tap();await p.locator('.motion-overlay.counting').waitFor();
 const model=createRhythm({difficulty:'standard'}),hold=model.notes.find(n=>n.duration>0),cdp=await p.context().newCDPSession(p),toTime=async target=>{const current=await p.locator('#rhythm-progress').evaluate((n,d)=>n.value*d,model.duration);if(target>current)await p.clock.runFor(target-current);};
 await toTime(hold.at);let points=[await point(p,'[data-rhythm-lane="'+hold.lane+'"]')];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await toTime(hold.at+hold.duration+25);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const chord=model.notes.find((n,i)=>n.at>hold.at+hold.duration&&model.notes[i+1]?.at===n.at),pair=model.notes.filter(n=>n.at===chord.at);await toTime(chord.at);points=await Promise.all(pair.map((n,i)=>point(p,'[data-rhythm-lane="'+n.lane+'"]',i+1)));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await shot(p,'dance-turned-chord');
 const r=await exported(p,'rhythm','dance-turned-inputs'),state=replayRhythm(r);assert.ok(['perfect','great'].includes(state.judgments[hold.id]));assert.ok(pair.every(n=>['perfect','great','good'].includes(state.judgments[n.id])));
 await p.locator('#rhythm-go').tap();await p.clock.runFor(100);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point(p,'[data-rhythm-lane="0"]')]});await p.setViewportSize({width:640,height:360});await p.clock.runFor(100);const frozen=await p.locator('#rhythm-progress').getAttribute('value');await p.clock.runFor(1500);assert.equal(await p.locator('#rhythm-progress').getAttribute('value'),frozen);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.locator('#rhythm-go').tap();await p.clock.runFor(300);assert.equal(await p.locator('[data-rhythm-lane="0"]').getAttribute('aria-pressed'),'false');await p.close();mark('网页横屏舞台：真实双指与长按命中，旋转会暂停并释放手指，回放判定一致');
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({base,checks,metrics,errors,browser:browser.version()},null,2));
}finally{await browser.close();}
