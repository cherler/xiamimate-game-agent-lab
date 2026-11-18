import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {project} from './paths.mjs';
import {cardActions,cardInfo} from '../src/cards.mjs';
import {PRESETS} from '../src/catalog.mjs';
import {replayStrategy} from '../src/strategy.mjs';
import {chromium} from './playwright.mjs';
const url=(process.env.ARENA_URL||'http://127.0.0.1:4841').replace(/\/$/,''),out=process.env.ARENA_RESULTS||path.resolve(project,'../output/game-agent-lab/cards-effects-2026-11-17');
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true}),errors=[],checks=[];
const hp=(p,actor=0)=>p.locator(`[data-piece="h${actor}"]`).getAttribute('data-hp');
const reveal=(p,id)=>p.locator(`.spell-reveal[data-source-card="${id}"]`);
const hit=(p,id,target)=>p.locator(`.effect-impact[data-effect-source="${id}"]${target?`[data-effect-target="${target}"]`:''}`);
async function page(options={}){const c=await browser.newContext({viewport:{width:1360,height:900},...options}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/#cards');await p.evaluate(()=>{window.effectObservations=[];const seen=new WeakSet();new MutationObserver(()=>{for(const n of document.querySelectorAll('.spell-beam,.effect-impact'))if(!seen.has(n)){seen.add(n);window.effectObservations.push({kind:n.classList.contains('spell-beam')?'beam':'impact',source:n.dataset.effectSource,target:n.dataset.effectTarget,hp:document.querySelector('[data-piece="h0"]')?.dataset.hp});}}).observe(document.body,{childList:true,subtree:true});});return p;}
async function replay(p,name){const file=path.join(project,'test/fixtures/cards-'+name+'.json');replayStrategy(JSON.parse(await fs.readFile(file,'utf8')));await p.evaluate(()=>{window.effectObservations=[];});await p.locator('#upload').setInputFiles(file);}
async function done(p){await p.locator('.table-error').filter({hasText:'回放结束'}).waitFor();}
async function snapshot(p,name){await p.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
async function inside(p,locator){const r=await locator.boundingBox(),v=p.viewportSize();assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=v.width&&r.y+r.height<=v.height,JSON.stringify({r,v}));}
async function request(route,auth,body){const r=await fetch(url+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{Authorization:'Bearer '+auth.token}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json();assert.ok(r.ok,value.error);return value;}
const view=auth=>request('/api/rooms/'+auth.code,auth);
const move=async(auth,action)=>request('/api/rooms/'+auth.code+'/action',auth,{seq:(await view(auth)).state.seq,action});
async function spellRoom(){
 const config=id=>({game:'cards',...PRESETS.find(d=>d.id===id)}),a=await request('/api/rooms',null,config('W-swarm')),b=await request('/api/rooms/'+a.code+'/join',null,config('S-combo')),seats=[a,b];
 for(const seat of seats){const s=(await view(seat)).state;await move(seat,{type:'mulligan',replace:seat.actor===1?s.players[1].hand.filter(c=>c.cardId!=='S06').map(c=>c.uid):[]});}
 // Prepare through legal public actions, without injecting state or exposing a seed.
 for(let i=0;i<240;i++){
  const current=(await view(a)).state,actor=current.turn,own=(await view(seats[actor])).state,p=own.players[actor];assert.equal(current.winner,null);
  const actions=cardActions(own,actor),spell=actions.find(x=>x.type==='play'&&p.hand.find(c=>c.uid===x.uid)?.cardId==='S06'&&x.target==='h0');
  if(actor===1&&spell){if(p.cardsPlayed===0)return {seats,spell};await move(b,{id:'end'});continue;}
  const allowed=actions.filter(x=>!x.target?.startsWith('h')&&!(actor===1&&p.hand.find(c=>c.uid===x.uid)?.cardId==='S06'));
  const action=allowed.find(x=>x.type==='attack')||allowed.find(x=>x.type==='play'&&cardInfo(p.hand.find(c=>c.uid===x.uid)?.cardId)?.kind==='unit')||allowed.find(x=>x.type==='play')||{id:'end'};
  await move(seats[actor],action);
 }
 throw Error('未能通过合法行动准备好友局法术场景');
}
try{
 const p=await page();await replay(p,'spell-hero');await reveal(p,'S06').waitFor();assert.equal(await hp(p),'20');assert.match(await reveal(p,'S06').innerText(),/对手[\s\S]*星火连弹/);await snapshot(p,'法术亮牌');
 await p.waitForFunction(()=>window.effectObservations.some(e=>e.kind==='beam'));assert.equal(await p.evaluate(()=>window.effectObservations.find(e=>e.kind==='beam').hp),'20');await p.waitForFunction(()=>document.querySelector('.effect-impact[data-effect-source="S06"][data-effect-target="h0"]'));assert.equal(await hp(p),'18');await p.waitForTimeout(180);await snapshot(p,'法术命中');await done(p);
 await p.locator('.action-chip.latest').click();assert.match(await p.locator('.receipt-step').innerText(),/星火连弹[\s\S]*苔光园丁[\s\S]*−2/);await snapshot(p,'最近行动');await p.locator('#history-close').click();checks.push('敌方法术先亮出来源卡，飞行途中保持旧生命，命中后扣血并标出牌名；行动回看列出来源与受击者');

 await replay(p,'freeze-deathrattle');await reveal(p,'S02').waitFor();assert.equal(await hp(p),'18');await hit(p,'S02').waitFor();assert.ok(await hit(p,'S02').first().evaluate(e=>e.classList.contains('ice-effect')));await reveal(p,'F01').filter({hasText:'遗赠'}).waitFor();assert.equal(await hp(p),'18');await snapshot(p,'遗赠来源');await hit(p,'F01','h0').waitFor();assert.equal(await hp(p),'20');assert.ok(await hit(p,'F01','h0').evaluate(e=>e.classList.contains('heal-effect')));await done(p);assert.equal(await p.locator('.own-row .unit-card').count(),0);checks.push('冰系伤害、单位退场、遗赠亮牌和治疗依次发生，治疗明确归因于芽苗精');

 await replay(p,'aoe');await reveal(p,'W08').waitFor();const targets=await p.locator('.own-row .unit-card').evaluateAll(nodes=>nodes.map(e=>e.dataset.piece));assert.equal(targets.length,2);await p.waitForFunction(()=>document.querySelectorAll('.effect-impact[data-effect-source="W08"][data-effect="damage"]').length===2);assert.deepEqual((await hit(p,'W08').evaluateAll(nodes=>nodes.map(e=>e.dataset.effectTarget))).sort(),targets.sort());await p.waitForTimeout(150);await snapshot(p,'群体法术命中');await reveal(p,'W01').filter({hasText:'遗赠'}).waitFor();await done(p);assert.deepEqual(await p.locator('.own-row .unit-card').evaluateAll(nodes=>nodes.map(e=>[e.querySelector('.unit-name').textContent,e.dataset.hp])),[['巡路学徒','1'],['零件偶','1']]);checks.push('群体伤害同时命中原有两个单位，退场后召唤的新零件偶不会错误受伤');

 const phone=await page({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await replay(phone,'spell-hero');await reveal(phone,'S06').waitFor();await inside(phone,reveal(phone,'S06'));await snapshot(phone,'手机法术亮牌');await done(phone);await phone.locator('.action-chip.latest').tap();await inside(phone,phone.locator('#deck-dialog'));assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await snapshot(phone,'手机行动回看');checks.push('390 像素手机上的法术卡与行动回看均完整可见，无横向溢出');

 const calm=await page({reducedMotion:'reduce'});await replay(calm,'spell-hero');await reveal(calm,'S06').waitFor();assert.equal(await hp(calm),'20');await hit(calm,'S06','h0').waitFor();assert.equal(await hp(calm),'18');assert.equal(await calm.locator('.spell-beam').count(),0);await done(calm);checks.push('减少动态效果时仍保留来源亮牌、目标与扣血顺序');
 await replay(calm,'spell-hero');await reveal(calm,'S06').waitFor();await calm.locator('[data-game=pong]').click();await calm.waitForTimeout(1800);assert.equal(await calm.locator('.spell-reveal,.spell-beam,.effect-impact').count(),0);await calm.locator('[data-game=cards]').click();assert.equal(await hp(calm),'20');assert.equal(await calm.locator('.action-chip').count(),0);checks.push('亮牌时切换游戏会清除待播效果，不会污染新牌局');

 const prepared=await spellRoom(),clients=[];
 for(const auth of prepared.seats){const context=await browser.newContext({viewport:{width:1360,height:900}});await context.addInitScript(a=>sessionStorage.setItem('gameplay-v1:glimmer-room-cards',JSON.stringify(a)),auth);const client=await context.newPage();client.on('pageerror',e=>errors.push(e.message));await client.goto(url+'/#cards');await client.locator('#room-clock').waitFor();clients.push(client);}
 const [receiver,caster]=clients;await caster.waitForFunction(()=>!document.querySelector('#card-end')?.disabled);const oldHP=Number(await hp(receiver));assert.equal(oldHP,20);await caster.locator(`[data-hand="${prepared.spell.uid}"]`).click();await caster.locator('[data-target="h0"]').click();await reveal(receiver,'S06').waitFor();assert.equal(await hp(receiver),String(oldHP));await hit(receiver,'S06','h0').waitFor();assert.equal(await hp(receiver),String(oldHP-2));await receiver.waitForTimeout(180);await snapshot(receiver,'好友对战法术');await receiver.locator('.action-chip.latest').click();assert.match(await receiver.locator('.receipt-step').innerText(),/星火连弹[\s\S]*−2/);checks.push('两个独立好友客户端：对手真实出牌后，接收方按来源、飞行、命中的顺序播放并保留回看');

 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'effects-check.json'),JSON.stringify({date:'2026-11-17',url,checks,errors,browser:browser.version()},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
