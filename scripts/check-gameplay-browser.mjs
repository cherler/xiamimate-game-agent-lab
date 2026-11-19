import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from './playwright.mjs';
import {project} from './paths.mjs';
import {storageKey} from '../web/storage.mjs';
import {beginStrategy,advanceStrategy,sealStrategy,replayStrategy} from '../src/strategy.mjs';
import {nextChessOpponent,board} from '../src/chess.mjs';
import {replayRescue,playbackRescue,beginRescue,sealRescue} from '../src/rescue.mjs';
import {rescueScenario} from './rescue-scenarios.mjs';
import {fingerprint} from '../src/common.mjs';

const base=(process.env.ARENA_URL||'http://127.0.0.1:4842').replace(/\/$/,''),url=base+'/',out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/strategy-depth-2026-11-18/browser');await fs.mkdir(out,{recursive:true});
const oldCards=JSON.parse(await fs.readFile(path.join(project,'test/fixtures/cards-practice-complete.json'),'utf8'));
const oldSave={record:oldCards,history:[],faction:'W',deckKey:'W-swarm',rivalDeck:'auto',cardDifficulty:'practice'};
const cardRecord=faction=>{const m=beginStrategy('cards',41003,[{faction},{faction:'F'}]);for(const actor of [0,1])advanceStrategy(m,actor,{type:'mulligan',replace:[]});while(m.state.players[0].turns<3||m.state.turn!==0)advanceStrategy(m,m.state.turn,{id:'end'});return sealStrategy(m);};
const cardSave=faction=>({record:cardRecord(faction),history:[],faction,deckKey:{W:'W-swarm',F:'F-growth',S:'S-combo'}[faction],rivalDeck:'F-growth',cardDifficulty:'practice'});
const runs=[1,2,3].map(level=>rescueScenario({level,version:4})),snapshots={};
for(const s of playbackRescue(runs[0].record)){
 const key=s.evac.phase==='gathering'?'gathering':s.soldiers.some(u=>u.hp>0&&u.maxHp-u.hp>=60)?'hurt':null;
 if(key&&!snapshots[key])snapshots[key]={...runs[0].record,commands:runs[0].record.commands.filter(c=>c.tick<=s.tick),end:{tick:s.tick,hash:fingerprint(s),winner:s.winner}};
}
assert.ok(snapshots.gathering&&snapshots.hurt);
const browser=await chromium.launch({headless:true}),checks=[],errors=[],api=[];
async function newPage(mobile=false){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 await context.addInitScript(()=>{const raw=sessionStorage.getItem('gameplay-test-restore');if(raw){const {key,value}=JSON.parse(raw);localStorage.setItem(key,JSON.stringify(value));sessionStorage.removeItem('gameplay-test-restore');}});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname.includes('/api/'))api.push(r.url());});await p.goto(url+'#cards');return p;
}
async function restore(p,game,value){
 const key=storageKey('glimmer-'+({cards:'card',chess:'chess',rescue:'rescue'}[game])+'-save');
 await p.evaluate(({key,value})=>sessionStorage.setItem('gameplay-test-restore',JSON.stringify({key,value})),{key,value});await p.goto(url+'#'+game);await p.reload();
 await p.locator(game==='cards'?'.card-table':game==='chess'?'.ac-board':'#rescue-board').waitFor();
}
async function exported(p,game,name){
 if(game==='cards')await p.locator('#card-settings').click();
 const download=p.waitForEvent('download');await p.locator({cards:'#card-export',chess:'#ac-export',rescue:'#rs-export'}[game]).click();const file=path.join(out,name+'.json');await(await download).saveAs(file);const record=JSON.parse(await fs.readFile(file,'utf8'));
 if(game==='cards')await p.locator('#settings-close').click();return {record,state:game==='rescue'?replayRescue(record):replayStrategy(record)};
}
async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function point(p,x,y,touch=false){await p.locator('#rescue-board').scrollIntoViewIfNeeded();const r=await p.locator('#rescue-board').boundingBox();const at=[r.x+r.width*x/24,r.y+r.height*y/16];if(touch)await p.touchscreen.tap(...at);else await p.mouse.click(...at);}
try{
 const p=await newPage();await p.evaluate(save=>localStorage.setItem('glimmer-card-save',JSON.stringify(save)),oldSave);
 await restore(p,'cards',cardSave('W'));const before=(await exported(p,'cards','cards-before')).state,chosen=before.players[0].hand.find(c=>!c.cardId.startsWith('T'));
 await p.locator(`[data-hand="${chosen.uid}"]`).click();await p.locator('#card-cycle').click();await p.locator('#card-power-alt:enabled').waitFor();let r=await exported(p,'cards','cards-after-cycle');assert.equal(r.state.players[0].cycled,true);assert.equal(r.state.players[0].deck.at(-1).uid,chosen.uid);assert.equal(r.state.players[0].mana,2);
 await p.locator('#card-power-alt').click();await p.locator('#card-end:enabled').waitFor();r=await exported(p,'cards','cards-after-assemble');assert.equal(r.state.players[0].board.at(-1).cardId,'T01');assert.equal(r.state.players[0].mana,0);assert.equal(await p.locator('#card-power-alt').isDisabled(),true);assert.match(await p.locator('.action-timeline').innerText(),/拼装零件/);await shot(p,'cards-cycle-and-power');checks.push('实际点击完成调度与工坊造偶，能量、次数、回牌库底和技能来源反馈一致');
 for(const faction of ['F','S']){await restore(p,'cards',cardSave(faction));if(faction==='S'){const coin=replayStrategy(cardRecord('S')).players[0].hand.find(c=>c.cardId==='T06');await p.locator('[data-hand="'+coin.uid+'"]').click();await p.locator('#card-play').click();await p.locator('#card-power-alt:enabled').waitFor();}await p.locator('#card-power-alt').click();await p.locator('#card-end:enabled').waitFor();r=await exported(p,'cards','cards-power-'+faction);if(faction==='F')assert.ok(r.state.players[0].board.some(u=>u.cardId==='T07'&&u.guard));else assert.equal(r.state.players[0].hp,18);await shot(p,'cards-power-'+faction);}checks.push('林地召唤守护幼苗、星塔付出生命补牌均可从界面使用');
 assert.deepEqual(JSON.parse(await p.evaluate(()=>localStorage.getItem('glimmer-card-save'))),oldSave);

 await restore(p,'chess',sealStrategy(beginStrategy('chess',41003)));await p.locator('[data-buy]:enabled').first().click();await p.locator('#ac-arrange').click();await p.locator('#ac-ready').click();await p.locator('#ac-skip').click();await p.locator('.ac-loot').waitFor();assert.equal(await p.locator('[data-loot]').count(),3);assert.equal(await p.locator('#ac-next').isDisabled(),true);await shot(p,'chess-loot-choice');
 await p.locator('[data-loot="1"]').click();r=await exported(p,'chess','chess-loot');assert.equal(r.state.players[0].inventory.length,1);assert.equal(r.state.players[0].loot,null);await p.locator('#ac-next').click();
 await p.locator('[data-equip="0"]').click();await p.locator('.ac-piece-layer .home-piece').first().click();r=await exported(p,'chess','chess-equipped');const gold=r.state.players[0].gold;await p.locator('.ac-piece-layer .home-piece').first().click();await p.locator('[data-unequip="0"]').click();r=await exported(p,'chess','chess-unequipped');assert.equal(r.state.players[0].gold,gold-1);assert.equal(r.state.players[0].inventory.length,1);await p.locator('[data-equip="0"]').click();await p.locator('.ac-piece-layer .home-piece').first().click();checks.push('野怪三选一只能领一件，选完再推进；装备可以花一金币拆下并重新装备');
 for(let round=2;round<=3;round++){
  if(!(await p.locator('#ac-shop-panel').isVisible()))await p.locator('#ac-shop-toggle').click();if(await p.locator('[data-buy]:enabled').count())await p.locator('[data-buy]:enabled').first().click();await p.locator('#ac-arrange').click();await p.locator('#ac-ready').click();await p.locator('#ac-skip').click();await p.locator('.ac-recap').waitFor();if(await p.locator('[data-loot]').count())await p.locator('[data-loot]').first().click();await p.locator('#ac-next').click();
 }
 r=await exported(p,'chess','chess-round4');assert.equal(r.state.round,4);const rival=nextChessOpponent(r.state);assert.ok(r.state.players.slice(1).every(q=>q.hp<=0||q.ready));assert.equal(await p.locator('.ac-piece-layer .enemy-piece').count(),board(r.state.players[rival]).length);await p.locator('#ac-scout').click();assert.match(await p.locator('.ac-board-heading').innerText(),new RegExp(r.state.players[rival].name));await p.locator('#ac-home').click();await shot(p,'chess-scout-and-counter');
 const unit=r.state.players[0].units.find(u=>u.cell!==null);await p.locator(`.ac-piece-layer [data-uid="${unit.uid}"]`).click();await p.locator('[data-cell="56"]').click();await p.locator('#ac-ready').click();r=await exported(p,'chess','chess-announced-battle');assert.equal(r.state.battle.opponent,rival);await p.locator('#ac-skip').click();await p.locator('.ac-recap').waitFor();checks.push('连续完成野怪轮，第4轮先看锁定对手再改站位，实际战斗对手与预告相同');

 await restore(p,'rescue',snapshots.gathering);assert.equal(await p.locator('#rs-call').isEnabled(),true);assert.equal(await p.locator('#rescue-board').getAttribute('data-evac-progress'),'0');await shot(p,'rescue-await-call');await p.locator('#rs-call').click();assert.equal(await p.locator('#rs-call').isDisabled(),true);await p.locator('#rs-start').click();await p.waitForFunction(()=>document.querySelector('#rescue-board').dataset.raging==='true');await p.locator('#rs-start').click();r=await exported(p,'rescue','rescue-called');assert.equal(r.state.evac.alerts,1);assert.equal(r.record.format,'rescue-4');
 const supplies=r.state.supplies;await p.locator('#rs-decoy').click();await point(p,4.5,8.5);r=await exported(p,'rescue','rescue-decoy');assert.equal(r.state.supplies,supplies-1);assert.equal(r.state.decoys.length,1);await shot(p,'rescue-decoy');
 await restore(p,'rescue',snapshots.hurt);const hurt=replayRescue(snapshots.hurt).soldiers.find(u=>u.hp>0&&u.maxHp-u.hp>=60);await p.locator('#rs-medic').click();await point(p,hurt.x,hurt.y);r=await exported(p,'rescue','rescue-medic');assert.equal(r.state.soldiers.find(u=>u.id===hurt.id).hp,hurt.hp+55);assert.equal(r.state.supplies,1);await shot(p,'rescue-medic');checks.push('平民集结后主动呼叫，暂停时可布置诱饵和急救；按钮行为与资源、实际生命变化一致');
 await restore(p,'rescue',sealRescue(beginRescue()));await p.locator('#rs-start').click();await point(p,12.5,11.5);await p.waitForFunction(()=>document.querySelector('#rs-supplies').textContent==='3',null,{timeout:16000});await p.locator('#rs-start').click();r=await exported(p,'rescue','rescue-collected-supply');assert.equal(r.state.crates[0].claimed,true);checks.push('通过地图移动实际抵达补给箱，可以获得额外一份战术补给');
 for(let i=0;i<3;i++){await restore(p,'rescue',runs[i].beforeEnd);await p.locator('#rs-start').click();await p.locator('#rs-result:not([hidden])').waitFor();assert.match(await p.locator('#rs-result').innerText(),/救援成功/);if(i<2)await p.locator('[data-upgrade="'+(i===0?'fire':'gate')+'"]').click();}checks.push('三关新版完整行动可结算、解锁和携带升级，导出的真实操作均可重演');

 const phone=await newPage(true);await restore(phone,'cards',cardSave('W'));const hand=await phone.locator('[data-hand]').first();await hand.tap();await phone.locator('#card-cycle').tap();await phone.locator('#card-power-alt:enabled').waitFor();await phone.locator('#card-power-alt').tap();await phone.locator('#card-end:enabled').waitFor();await shot(phone,'mobile-cards-tactics');assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await restore(phone,'rescue',snapshots.gathering);await phone.locator('#rs-call').tap();await phone.locator('#rs-start').tap();await phone.waitForTimeout(200);await phone.locator('#rs-start').tap();await phone.locator('#rs-decoy').tap();await point(phone,4.5,8.5,true);r=await exported(phone,'rescue','mobile-rescue-tactics');assert.equal(r.state.decoys.length,1);await shot(phone,'mobile-rescue-tactics');assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push('手机触控可使用调度、双选技能、呼叫与诱饵，界面没有横向溢出');
 assert.deepEqual(errors,[]);assert.deepEqual(api,[]);const result={url,checks,errors,api,browser:browser.version()};await fs.writeFile(path.join(out,'gameplay-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
