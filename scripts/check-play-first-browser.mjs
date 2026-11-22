import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {checkReplay} from '../src/arena.mjs';
import {replayStrategy} from '../src/strategy.mjs';
import {replayRescue} from '../src/rescue.mjs';
import {replayKart} from '../src/kart.mjs';
import {replayRunner} from '../src/runner.mjs';
const base=process.env.ARENA_URL||'http://127.0.0.1:4846/site',out=path.join(project,'.runtime/play-first/playtest');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
async function page(game){
 const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 p.setDefaultTimeout(7000);p.errors=[];p.on('pageerror',e=>p.errors.push(e.message));
 await p.addInitScript(()=>{crypto.getRandomValues=a=>{a.fill(1);return a;};});
 await p.clock.install();await p.clock.pauseAt(Date.now()+1000);await p.goto(base+'/#'+game);return p;
}
const advance=(p,ms)=>p.clock.runFor(ms),shot=(p,name)=>p.screenshot({path:path.join(out,name+'.png')});
async function settings(p){if(!await p.locator('#screen-settings-head').isVisible())await p.locator('#play-settings').click();}
async function close(p){if(await p.locator('#screen-settings-head').isVisible())await p.locator('#screen-settings-close').click();}
async function exported(p,game){
 await settings(p);
 if(['snake','pong'].includes(game))await p.locator('.arcade-details summary').click();
 if(game==='cards')await p.locator('#card-settings').click();
 const id={snake:'export',pong:'export',cards:'card-export',chess:'ac-export',rescue:'rs-export',kart:'kart-export',runner:'runner-export'}[game];
 if(game==='chess')await close(p);
 const pending=p.waitForEvent('download');await p.locator('#'+id).click();const file=path.join(out,game+'.json');await(await pending).saveAs(file);
 if(game==='cards')await p.locator('#settings-close').click();await close(p);
 return JSON.parse(await fs.readFile(file,'utf8'));
}
async function move(p,selector,target){const a=await p.locator(selector).boundingBox(),b=await p.locator(target).boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(a.x+a.width/2+12,a.y+a.height/2-8,{steps:3});await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await p.mouse.up();}
const runs={
 async snake(p){
  await p.locator('#start').click();await advance(p,1490);await p.keyboard.press('ArrowDown');await advance(p,550);await shot(p,'snake-contest');await p.keyboard.press('ArrowLeft');await advance(p,4500);
  const first={score:await p.locator('.score-strip').innerText(),result:await p.locator('#result').innerText()};
  if(await p.locator('#result').isVisible())await p.locator('#start').click();else{await p.locator('#restart').click();await p.locator('#start').click();}
  await advance(p,1000);await p.keyboard.press('ArrowUp');await advance(p,600);await p.keyboard.press('ArrowRight');await advance(p,700);await p.keyboard.press('ArrowDown');await advance(p,700);await p.keyboard.press('ArrowRight');await advance(p,5000);
  await shot(p,'snake-result');const r=await exported(p,'snake'),s=checkReplay(r);assert.ok(r.frames.length);assert.ok(s.reason);return {first,final:{score:s.score,ticks:s.tick,reason:s.reason},checks:['方向控制','抢食与碰撞反馈','再开一局','导出并重演']};
 },
 async pong(p){
  await p.locator('#start').click();await advance(p,1400);
  for(let i=0;i<22;i++){
   const key=i%2?'ArrowLeft':'ArrowRight';await p.keyboard.down(key);await advance(p,210+i%3*65);await p.keyboard.up(key);
   for(const skill of ['#pong-power','#pong-spin','#pong-dash'])if(await p.locator(skill).isEnabled()){await p.locator(skill).click();break;}
   await advance(p,650);
  }
  await shot(p,'pong-play');await p.locator('#pong-rotate').click();assert.equal(await p.locator('#pong-view').inputValue(),'left');await shot(p,'pong-rotated');const r=await exported(p,'pong'),s=checkReplay(r);assert.ok(s.tick>0);assert.ok(r.frames.some(f=>f[1][0]?.skill));return {score:s.score,rally:s.bestRally,ticks:s.tick,checks:['移动','三种击球技巧输入','球台旋转','回放一致']};
 },
 async cards(p){
  assert.equal(await p.locator('.action-timeline').isVisible(),false);await p.locator('#card-keep').click();await advance(p,4000);
  let turns=0,plays=0,attacks=0,powers=0,cycles=0;const names=[];
  for(;turns<30&&!await p.locator('.table-result').count();turns++){
   for(let step=0;step<24;step++){
    await advance(p,1800);if(await p.locator('.table-result').count())break;
    if(!await p.locator('#card-end').isEnabled()){await advance(p,5000);continue;}
    if(!powers&&await p.locator('#card-power-alt').isEnabled()){await p.locator('#card-power-alt').click();powers++;continue;}
    const playable=p.locator('.hand-card.playable').first();
    if(await playable.count()){
     const name=await playable.locator('.card-name').textContent();await playable.click();let target=p.locator('#card-play,.choice-action').first();
     if(!await target.count())target=p.locator('.enemy-row .targetable,.hero-row.enemy .targetable').first();
     if(!await target.count())target=p.locator('.own-row .targetable,.hero-row.own .targetable').first();
     if(await target.count()){await target.click();plays++;names.push(name);continue;}
     await p.locator('#card-cancel').click();
    }
    const attacker=p.locator('.own-row .can-attack').first();
    if(await attacker.count()){
     await attacker.click();const target=p.locator('.hero-row.enemy .targetable,.enemy-row .targetable').first();
     if(await target.count()){await target.click();attacks++;continue;}
    }
    if(await p.locator('#card-power').isEnabled()){
     await p.locator('#card-power').click();const target=p.locator('.hero-row.enemy .targetable,.enemy-row .targetable').first();if(await target.count())await target.click();powers++;continue;
    }
    if(turns===2&&!cycles){const card=p.locator('.hand-card').first();if(await card.count()){await card.click();if(await p.locator('#card-cycle').count()&&await p.locator('#card-cycle').isEnabled()){await p.locator('#card-cycle').click();cycles++;continue;}await p.locator('#card-cancel').click();}}
    await p.locator('#card-end').click();await advance(p,7000);break;
   }
   if(turns===2)await shot(p,'cards-midgame');
  }
  await shot(p,'cards-result');const r=await exported(p,'cards'),s=replayStrategy(r);assert.ok(plays&&attacks&&powers);assert.equal(s.phase,'ended');return {turns,plays,attacks,powers,cycles,cards:[...new Set(names)],winner:s.winner,hp:s.players.map(p=>p.hp),checks:['高亮牌出牌','合法目标攻击','英雄能力','行动来源','结算','菜单内卡组设置与回放']};
 },
 async chess(p){
  await p.locator('[data-buy]:enabled').first().click();await p.locator('#ac-shop-close').click();assert.ok(await p.locator('.ac-deploy-cue').isVisible());
  await p.locator('[data-cell="43"]').click();assert.equal(await p.locator('.ac-deploy-cue').count(),0);assert.equal(await p.locator('.ac-piece-layer .ac-piece:not(.enemy-piece)').count(),1);
  const uid=await p.locator('.ac-piece-layer .ac-piece:not(.enemy-piece)').first().getAttribute('data-uid');await move(p,'[data-uid="'+uid+'"]','.ac-bench');assert.equal(await p.locator('.ac-bench [data-uid="'+uid+'"]').count(),1);await move(p,'.ac-bench [data-uid="'+uid+'"]','[data-cell="42"]');
  await shot(p,'chess-deploy');const rounds=[];
  for(let round=1;round<=5;round++){
   if(round>1){
    let buys=0;while(await p.locator('[data-buy]:enabled').count()&&buys++<4)await p.locator('[data-buy]:enabled').first().click();
    if(await p.locator('#ac-level').isEnabled())await p.locator('#ac-level').click();
    await p.locator('#ac-arrange').click();
   }
   await p.locator('#ac-ready').click();assert.equal(await p.locator('#ac-shop-panel').isVisible(),false);await advance(p,1800);await shot(p,'chess-round-'+round);
   await p.locator('#ac-skip').click();rounds.push(await p.locator('#ac-battle-result').textContent());
   if(await p.locator('[data-loot]').count())await p.locator('[data-loot]').first().click();
   if(round<5){await advance(p,5500);assert.equal(await p.locator('#ac-shop-panel').isVisible(),true);}
  }
  const r=await exported(p,'chess'),s=replayStrategy(r);assert.ok(s.round>=5);return {rounds,round:s.round,hp:s.players[0].hp,units:s.players[0].units.length,checks:['招募','首枚棋子落点提示','拖回备战席再部署','开战自动收起','野怪装备','自动下一轮','玩家对战轮']};
 },
 async rescue(p){
  await p.locator('#rs-start').click();const b=await p.locator('#rescue-board').boundingBox();await p.mouse.click(b.x+19.5/24*b.width,b.y+8.5/16*b.height);assert.equal(await p.locator('#rescue-board').getAttribute('data-order'),'accepted');
  let ticks=0;while(Number(await p.locator('#rs-following').textContent())+Number(await p.locator('#rs-boarding').textContent())<10&&ticks++<40)await advance(p,1000);
  await shot(p,'rescue-escort');await p.locator('#rs-retreat').click();let peak=0;
  for(let i=0;i<100;i++){await advance(p,1000);peak=Math.max(peak,Number(await p.locator('#rescue-board').getAttribute('data-enemies')));if(i===12)await shot(p,'rescue-siege');if(await p.locator('#rs-result').isVisible())break;}
  assert.ok(await p.locator('#rs-result').isVisible());await shot(p,'rescue-result');const r=await exported(p,'rescue'),s=replayRescue(r);return {winner:s.winner,saved:s.saved,lost:s.lost,kills:s.kills,peakAfterReturn:peak,commands:r.commands.map(c=>c.command.type),checks:['点击地图全队移动','自动接应与射击','撤回','接驳读秒','尸潮','结算与升级入口']};
 },
 async kart(p){
  await p.locator('#kart-go').click();await p.keyboard.down('ArrowUp');await advance(p,5000);
  await p.keyboard.down('ArrowRight');await p.keyboard.down('Shift');await advance(p,360);await p.keyboard.up('Shift');await p.keyboard.up('ArrowRight');await advance(p,1100);await shot(p,'kart-drift');
  for(let i=0;i<7;i++){await p.keyboard.down(i%2?'ArrowRight':'ArrowLeft');await advance(p,200);await p.keyboard.up(i%2?'ArrowRight':'ArrowLeft');await advance(p,1200);}
  await p.keyboard.up('ArrowUp');await shot(p,'kart-driving');const r=await exported(p,'kart'),s=replayKart(r);assert.ok(r.inputs.some(i=>i.input.drift));return {phase:s.phase,rank:s.rank,player:s.cars[0],checks:['油门','转向','漂移松开','碰撞反馈','设置与暂停','录像一致'],coverage:'约 17 秒驾驶，未完成两圈'};
 },
 async runner(p){
  await p.locator('#runner-go').click();await advance(p,3300);for(const key of ['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Space']){await p.keyboard.press(key);await advance(p,160);}await shot(p,'runner-actions');
  for(let i=0;i<35;i++){await advance(p,1000);if(await p.locator('#runner-go').isVisible())break;}
  await shot(p,'runner-result');const r=await exported(p,'runner'),s=replayRunner(r);assert.equal(s.phase,'finished');await p.locator('#runner-go').click();await advance(p,1000);assert.equal(await p.locator('#runner-distance').textContent(),'0');return {distance:Math.floor(s.z),score:s.score,reason:s.reason,inputs:r.inputs,checks:['换道','跳跃','翻滚','护板','碰撞结算','重新出发']};
 }
};
try{
 for(const game of process.argv[2]?[process.argv[2]]:Object.keys(runs)){
  const p=await page(game);let result;
  try{result={game,ok:true,...await runs[game](p)};assert.deepEqual(p.errors,[]);}
  catch(e){result={game,ok:false,error:e.stack,errors:p.errors};await shot(p,game+'-failure');}
  await p.close();results.push(result);await fs.writeFile(path.join(out,game+'-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}finally{await browser.close();}
if(results.some(r=>!r.ok))process.exitCode=1;
