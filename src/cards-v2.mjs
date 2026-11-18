import {CARDS,STARTERS,HEROES,TOKENS} from './catalog-v2.mjs';
import {noise} from './common.mjs';
import {beginCardEvents,cardEvent,cardBatch,cardCause,withCardSource} from './card-events.mjs';
export {CARDS,STARTERS,HEROES};
export const cardInfo=id=>CARDS[id]||TOKENS[id];
const copy=s=>structuredClone(s);
const log=(s,text)=>{s.log.push(text);s.log=s.log.slice(-32);};
function shuffle(items,seed,channel){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(noise(seed,i,channel)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validateDeck(faction,deck){
 return Object.hasOwn(HEROES,faction)&&Array.isArray(deck)&&deck.length===20&&deck.every(id=>CARDS[id]&&(id[0]==='N'||id[0]===faction)&&deck.filter(x=>x===id).length<=2);
}
export function initCards(seed=1,configs){
 configs??=[{faction:'W'},{faction:'F'}];
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Array.isArray(configs)||configs.length!==2)throw Error('开局设置无效');
 const first=Math.floor(noise(seed,0,19)*2),s={game:'cards',version:2,seed,seq:0,uid:50,turn:first,first,phase:'mulligan',kept:[false,false],winner:null,reason:'',log:[],players:[]};
 for(let i=0;i<2;i++){
  const faction=configs[i]?.faction,deck=configs[i]?.deck||STARTERS[faction];
  if(!validateDeck(faction,deck))throw Error('卡组需要 20 张，同名最多两张，只能使用本阵营与中立牌');
  const p={faction,hp:20,mana:0,maxMana:0,turns:0,powerUsed:false,cardsPlayed:0,spellsPlayed:0,fatigue:0,board:[],hand:[],discard:[],deck:shuffle(deck.map((cardId,n)=>({uid:'p'+i+'c'+n,cardId})),seed,41+i)};
  s.players.push(p);for(let n=0;n<(i===first?3:4);n++)p.hand.push(p.deck.shift());
 }
 return s;
}
function find(s,id){if(id==='h0'||id==='h1')return s.players[Number(id[1])];return s.players.flatMap(p=>p.board).find(u=>u.uid===id);}
function winnerCheck(s){const dead=s.players.map(p=>p.hp<=0);if(dead.some(Boolean)){s.winner=dead[0]&&dead[1]?-1:dead[0]?1:0;s.phase='ended';s.reason='英雄生命归零';}}
function buff(s,u,attack,hp){u.attack+=attack;u.hp+=hp;u.maxHp+=hp;cardEvent(s,{kind:'buff',target:u.uid,attackGain:attack,healthGain:hp,attack:u.attack,hp:u.hp,maxHp:u.maxHp});}
function status(s,u,change,kind){Object.assign(u,change);cardEvent(s,{kind,target:u.uid,change});}
function heal(s,id,n){
 const t=find(s,id);if(!t||t.hp<=0||n<=0)return 0;const amount=Math.min(n,(t.maxHp||20)-t.hp);t.hp+=amount;
 cardEvent(s,{kind:'heal',target:id,amount,hp:t.hp});
 if(amount>0&&(id==='h0'||id==='h1'))for(const u of t.board)if(u.hp>0&&!u.silenced&&u.cardId==='F11'){withCardSource(s,{actor:Number(id[1]),uid:u.uid,cardId:u.cardId,kind:'trigger',trigger:'共生'},()=>buff(s,u,1,1));log(s,'共生古藤因治疗获得 +1／+1');}
 return amount;
}
function spawn(s,actor,cardId){
 const p=s.players[actor];if(p.board.length>=5){log(s,'战场已满，无法召唤'+cardInfo(cardId).name);cardEvent(s,{kind:'full',actor,cardId});return null;}
 const c=cardInfo(cardId),u={uid:'u'+s.uid++,cardId,attack:c.attack,hp:c.health,maxHp:c.health,shield:!!c.shield,guard:!!c.guard,rush:!!c.rush,drain:!!c.drain,frozen:false,silenced:false,spellTriggers:0,fresh:true,exhausted:false};
 p.board.push(u);cardEvent(s,{kind:'summon',actor,target:u.uid,unit:{...u}});
 if(c.token)for(const source of p.board)if(source.cardId==='W10'&&!source.silenced&&source.hp>0)withCardSource(s,{actor,uid:source.uid,cardId:source.cardId,kind:'trigger',trigger:'装配'},()=>buff(s,u,1,0));
 return u;
}
function settle(s){
 winnerCheck(s);if(s.winner!==null)return;
 const dead=[];
 for(const actor of [s.turn,1-s.turn]){const p=s.players[actor];for(const u of p.board)if(u.hp<=0)dead.push({actor,...u});p.board=p.board.filter(u=>u.hp>0);}
 for(const u of dead){s.players[u.actor].discard.push(u.cardId);log(s,cardInfo(u.cardId).name+'退场');cardEvent(s,{kind:'death',actor:u.actor,target:u.uid,cardId:u.cardId});}
 for(const u of dead){
  if(s.winner!==null)break;if(u.silenced)continue;
  const source={actor:u.actor,uid:u.uid,cardId:u.cardId,kind:'trigger',trigger:'遗赠'};
  if(u.cardId==='W01')withCardSource(s,source,()=>spawn(s,u.actor,'T01'));
  if(u.cardId==='W05')withCardSource(s,source,()=>{spawn(s,u.actor,'T02');spawn(s,u.actor,'T02');});
  if(u.cardId==='F01')withCardSource(s,source,()=>heal(s,'h'+u.actor,2));
  if(u.cardId==='N09')withCardSource(s,source,()=>drawCard(s,u.actor));
 }
}
function damage(s,packets){
 const drains=[0,0],drainSources=[],batch=cardBatch(s);
 for(const [id,n,drainActor,origin] of packets){
  const t=find(s,id);if(!t||n<=0)continue;
  const source=origin||cardCause(s);
  if(t.shield){t.shield=false;log(s,'护盾抵挡伤害');cardEvent(s,{kind:'block',target:id,amount:n,batch,source});}
  else {const actual=Math.max(0,Math.min(t.hp,n));t.hp-=n;cardEvent(s,{kind:'damage',target:id,amount:n,actual,hp:t.hp,batch,source});if([0,1].includes(drainActor)){drains[drainActor]+=actual;drainSources[drainActor]=source;}}
 }
 drains.forEach((n,actor)=>{if(n)withCardSource(s,{...drainSources[actor],actor,kind:'trigger',trigger:'汲取'},()=>{const healed=heal(s,'h'+actor,n);if(healed)log(s,'汲取恢复 '+healed+' 点生命');});});settle(s);
}
function toHand(s,actor,c,generated=false){const p=s.players[actor];if(p.hand.length>=8){p.discard.push(c.cardId);log(s,cardInfo(c.cardId).name+'因手牌已满弃置');cardEvent(s,{kind:'burn',actor,cardId:c.cardId});}else{p.hand.push(c);cardEvent(s,generated?{kind:'generate',actor,cardId:c.cardId}:{kind:'draw',actor});}}
function drawCard(s,actor){
 const p=s.players[actor];if(!p.deck.length){p.fatigue++;withCardSource(s,{actor,kind:'fatigue',uid:'h'+actor,faction:p.faction},()=>damage(s,[['h'+actor,p.fatigue]]));log(s,'疲劳伤害 '+p.fatigue);return;}toHand(s,actor,p.deck.shift());
}
function startTurn(s,actor){
 s.turn=actor;const p=s.players[actor];p.turns++;p.maxMana=Math.min(8,p.maxMana+1);p.mana=p.maxMana;p.powerUsed=false;p.cardsPlayed=0;p.spellsPlayed=0;
 for(const u of p.board){u.fresh=false;u.exhausted=false;u.spellTriggers=0;}cardEvent(s,{kind:'turn',actor,mana:p.mana,maxMana:p.maxMana,turns:p.turns});withCardSource(s,{actor,kind:'start',uid:'h'+actor,faction:p.faction},()=>drawCard(s,actor),false);
}
function finishTurn(s,actor){
 const p=s.players[actor];
 for(const u of [...p.board]){
  if(u.silenced||u.hp<=0||s.winner!==null)continue;
  const source={actor,uid:u.uid,cardId:u.cardId,kind:'trigger',trigger:'余辉'};
  if(u.cardId==='F10'){withCardSource(s,source,()=>heal(s,'h'+actor,2));log(s,'月露祭司的余辉');}
  if(u.cardId==='S10'&&p.spellsPlayed>0){withCardSource(s,source,()=>spawn(s,actor,'T04'));log(s,'星辉导师的余辉');}
 }
 for(const u of p.board)u.frozen=false;
}
function targetIds(s,actor,id){
 const own=s.players[actor].board.map(u=>u.uid),enemy=s.players[1-actor].board.map(u=>u.uid);
 if(['N06','N11','N12','W07','F07','S02','S08','S11','T05'].includes(id))return enemy;
 if(id==='S06')return ['h'+(1-actor),...enemy];
 if(id==='N07')return ['h'+actor,...own];
 if(['W06','W11','F06'].includes(id))return own;
 if(['W03','F03'].includes(id))return own.length?own:[null];
 return [null];
}
export function cardActions(s,actor=s.turn){
 if(s.winner!==null||s.phase!=='play'||s.turn!==actor)return [];
 const p=s.players[actor],enemy=s.players[1-actor],actions=[];
 for(const c of p.hand){
  const info=cardInfo(c.cardId);if(p.mana<info.cost||(info.kind==='unit'&&p.board.length>=5))continue;
  for(const choice of info.choices||[null])for(const target of targetIds(s,actor,c.cardId))actions.push({id:`play:${c.uid}:${choice?choice.id+':':''}${target||'-'}`,type:'play',uid:c.uid,target,...(choice?{choice:choice.id}:{})});
 }
 const guards=enemy.board.filter(u=>u.guard);
 for(const u of p.board){
  if(u.exhausted||u.frozen||u.attack<=0||(u.fresh&&!u.rush))continue;
  const targets=(guards.length?guards:enemy.board).map(e=>e.uid);if(!guards.length&&!u.fresh)targets.push('h'+(1-actor));
  for(const target of targets)actions.push({id:`attack:${u.uid}:${target}`,type:'attack',uid:u.uid,target});
 }
 if(!p.powerUsed&&p.mana>=2){const targets=p.faction==='W'?enemy.board.map(u=>u.uid):p.faction==='S'?(p.hand.length<8?[null]:[]):['h'+actor,...p.board.map(u=>u.uid)];
  for(const target of targets)actions.push({id:'power:'+(target||'-'),type:'power',target});
 }
 actions.push({id:'end',type:'end'});return actions;
}
export function stepCards(s,actor,input,{trace=false}={}){
 if(![0,1].includes(actor)||s.winner!==null)throw Error('对局已结束或玩家无效');
 if(s.phase==='mulligan'){
  if(input.type!=='mulligan'||s.kept[actor]||!Array.isArray(input.replace)||new Set(input.replace).size!==input.replace.length||!input.replace.every(id=>s.players[actor].hand.some(c=>c.uid===id)))throw Error('起手换牌无效');
  const t=copy(s),p=t.players[actor],removed=p.hand.filter(c=>input.replace.includes(c.uid));if(trace)beginCardEvents(t,actor,{type:'mulligan'},{actor,kind:'mulligan'});p.hand=p.hand.filter(c=>!input.replace.includes(c.uid));
  for(let i=0;i<removed.length;i++)p.hand.push(p.deck.shift());p.deck=shuffle([...p.deck,...removed],s.seed,81+actor);t.kept[actor]=true;t.seq++;
  if(t.kept.every(Boolean)){t.phase='play';startTurn(t,t.first);log(t,'牌局开始');}return t;
 }
 const a=cardActions(s,actor).find(x=>x.id===input.id);if(!a)throw Error('这个动作现在不能执行');
 const t=copy(s),p=t.players[actor];t.seq++;
 const origin=a.type==='play'?p.hand.find(c=>c.uid===a.uid):a.type==='attack'?p.board.find(c=>c.uid===a.uid):null;
 if(trace)beginCardEvents(t,actor,a,{actor,kind:a.type==='play'?cardInfo(origin.cardId).kind:a.type,uid:origin?.uid||'h'+actor,...(origin?{cardId:origin.cardId}:{}),faction:p.faction,...(a.choice?{choice:a.choice}:{})});
 if(a.type==='end'){
  finishTurn(t,actor);if(t.winner!==null)return t;log(t,HEROES[p.faction].name+'结束回合');
  if(p.turns>=20&&t.players[1-actor].turns>=20){t.winner=-1;t.phase='ended';t.reason='双方各完成 20 回合';}else startTurn(t,1-actor);return t;
 }
 if(a.type==='attack'){
  const u=find(t,a.uid),target=find(t,a.target);u.exhausted=true;log(t,cardInfo(u.cardId).name+'攻击'+(a.target.startsWith('h')?'英雄':cardInfo(target.cardId).name));
  damage(t,[[a.target,u.attack,u.drain?actor:null],...(a.target.startsWith('h')?[]:[[u.uid,target.attack,target.drain?1-actor:null,{actor:1-actor,kind:'attack',uid:target.uid,cardId:target.cardId}]])]);return t;
 }
 if(a.type==='power'){
  p.mana-=2;p.powerUsed=true;log(t,HEROES[p.faction].power);
  if(p.faction==='W')damage(t,[[a.target,1]]);else if(p.faction==='F')heal(t,a.target,2);else toHand(t,actor,{uid:'c'+t.uid++,cardId:'T05'},true);return t;
 }
 const hand=p.hand.find(c=>c.uid===a.uid),c=cardInfo(hand.cardId),id=c.id,combo=(p.cardsPlayed||0)>0;
 p.hand=p.hand.filter(c=>c.uid!==a.uid);p.mana-=c.cost;p.cardsPlayed=(p.cardsPlayed||0)+1;log(t,'打出'+c.name+(a.choice?' · '+c.choices.find(x=>x.id===a.choice).name:''));
 const summoned=c.kind==='unit'?spawn(t,actor,id):null;if(c.kind==='spell'){p.discard.push(id);p.spellsPlayed=(p.spellsPlayed||0)+1;}
 const target=find(t,a.target);
 if(id==='N03')drawCard(t,actor);
 if(id==='N06')damage(t,[[a.target,3]]);
 if(id==='N07'){heal(t,a.target,3);drawCard(t,actor);}
 if(id==='N08'){drawCard(t,actor);if(t.winner===null)drawCard(t,actor);}
 if(id==='N11'&&target){const base=cardInfo(target.cardId);target.attack=base.attack;target.maxHp=base.health;target.hp=Math.min(target.hp,target.maxHp);target.shield=target.guard=target.rush=target.drain=target.frozen=false;target.silenced=true;cardEvent(t,{kind:'silence',target:target.uid,unit:{...target}});log(t,base.name+'被沉默');}
 if(id==='N12'){damage(t,[[a.target,1]]);if(t.winner===null)drawCard(t,actor);}
 if(id==='W03'&&target)buff(t,target,1,0);
 if(id==='W06'&&target)buff(t,target,0,2);
 if(id==='W07'){damage(t,[[a.target,4]]);if(t.winner===null)damage(t,[['h'+actor,1]]);}
 if(id==='W08')damage(t,t.players[1-actor].board.map(u=>[u.uid,2]));
 if(id==='W09')spawn(t,actor,'T01');
 if(id==='W11'&&target){buff(t,target,0,2);status(t,target,{shield:true},'shield');}
 if(id==='W12'){spawn(t,actor,'T01');spawn(t,actor,'T01');for(const u of p.board)if(cardInfo(u.cardId).token)buff(t,u,1,0);}
 if(id==='F03'&&target)heal(t,a.target,3);
 if(id==='F05')heal(t,'h'+actor,2);
 if(id==='F06'&&target)buff(t,target,1,1);
 if(id==='F07'){damage(t,[[a.target,3]]);if(t.winner===null)heal(t,'h'+actor,2);}
 if(id==='F08')for(const u of p.board)buff(t,u,1,1);
 if(id==='F09')spawn(t,actor,'T03');
 if(id==='F12'){
  if(a.choice==='bloom'){spawn(t,actor,'T03');spawn(t,actor,'T03');for(const u of p.board)buff(t,u,1,0);}
  else {heal(t,'h'+actor,4);drawCard(t,actor);}
 }
 if(id==='S02'){damage(t,[[a.target,2]]);const u=find(t,a.target);if(u)status(t,u,{frozen:true},'freeze');}
 if(id==='S03'&&combo)drawCard(t,actor);
 if(id==='S04'&&combo&&summoned)status(t,summoned,{shield:true},'shield');
 if(id==='S05'){const index=p.deck.findIndex(c=>cardInfo(c.cardId).kind==='spell');if(index>=0)toHand(t,actor,p.deck.splice(index,1)[0]);}
 if(id==='S06')damage(t,[[a.target,combo?4:2]]);
 if(id==='S07'){const ids=t.players[1-actor].board.map(u=>u.uid);damage(t,ids.map(id=>[id,1]));for(const id of ids){const u=find(t,id);if(u)status(t,u,{frozen:true},'freeze');}}
 if(id==='S08')damage(t,[[a.target,3,actor]]);
 if(id==='S11')damage(t,t.players[1-actor].board.map(u=>[u.uid,u.uid===a.target?6:2]));
 if(id==='S12'&&combo)spawn(t,actor,'T04');
 if(id==='T05')damage(t,[[a.target,1]]);
 if(c.kind==='spell'&&t.winner===null)for(const u of p.board)if(u.cardId==='S01'&&!u.silenced&&(u.spellTriggers||0)<2){withCardSource(t,{actor,uid:u.uid,cardId:u.cardId,kind:'trigger',trigger:'施法'},()=>buff(t,u,1,0));u.spellTriggers=(u.spellTriggers||0)+1;log(t,'星尘学徒因施法获得 +1 攻击');}
 return t;
}
function evaluate(s,actor){
 if(s.winner!==null)return s.winner===-1?0:s.winner===actor?100000:-100000;
 const value=p=>p.hp*.65+p.hand.length*1.8+p.mana*.04+p.board.reduce((v,u)=>v+2.5+u.attack*1.3+u.hp*.65+(u.shield?2:0)+(u.guard?.8:0)+(u.drain?1.1:0)-(u.frozen?u.attack*.45+.8:0)+(!u.silenced?({W05:4,W01:1.2,N09:1.5,F10:1.5,F11:1.5,W10:1.3,S01:1.1,S10:2}[u.cardId]||0):0),0);
 return value(s.players[actor])-value(s.players[1-actor]);
}
export function rankCardActions(s,actor=s.turn,deep=true){
 const rows=cardActions(s,actor).map(action=>{const next=stepCards(s,actor,action);return {action,value:evaluate(next,actor),next};}).sort((a,b)=>b.value-a.value||a.action.id.localeCompare(b.action.id));
 if(deep)for(const row of rows.slice(0,8)){
  // Stop at hidden draws: the newly drawn identity cannot influence this choice.
  if(row.next.turn!==actor||row.next.winner!==null||row.next.players.some((p,i)=>p.deck.length!==s.players[i].deck.length))continue;
  const next=rankCardActions(row.next,actor,false)[0];if(next)row.value=Math.max(row.value,next.value-.015);
 }
 return rows.sort((a,b)=>b.value-a.value||a.action.id.localeCompare(b.action.id)).map(({action,value})=>({action,value}));
}
export function chooseCard(s,actor=s.turn){if(s.phase==='mulligan')return {type:'mulligan',replace:s.players[actor].hand.filter(c=>cardInfo(c.cardId).cost>=4).map(c=>c.uid)};return rankCardActions(s,actor)[0]?.action;}
export function cardActionText(s,actor,a){
 if(a.type==='mulligan')return '确认起手';if(a.type==='end')return '结束回合';if(a.type==='power')return HEROES[s.players[actor].faction].power;
 const u=a.type==='play'?s.players[actor].hand.find(c=>c.uid===a.uid):s.players[actor].board.find(c=>c.uid===a.uid),info=cardInfo(u?.cardId);
 return (a.type==='play'?'打出':'使用')+(info?.name||'单位')+(a.choice?' · '+info.choices.find(c=>c.id===a.choice).name:'')+(a.target?' · '+(a.target.startsWith('h')?'英雄':cardInfo(find(s,a.target)?.cardId)?.name||'单位'):'');
}
export function cardCandidates(s,actor){return rankCardActions(s,actor).slice(0,6).map((r,i)=>({id:'A'+i,action:r.action,value:r.value,label:cardActionText(s,actor,r.action)}));}
export function cardPacket(s,actor,candidates=cardCandidates(s,actor)){
 const p=s.players[actor],e=s.players[1-actor];
 return {state:{yourHP:p.hp,enemyHP:e.hp,mana:p.mana,comboReady:p.cardsPlayed>0,spellsThisTurn:p.spellsPlayed||0,ownBoard:p.board.length,enemyBoard:e.board.length,ownHand:p.hand.length,enemyHand:e.hand.length},questions:{move:{type:'choice',instructions:'Choose a legal card-duel move. Lethal wins first. Combo needs an earlier card this turn. Frozen units cannot attack next own turn. Drain heals actual HP damage. End turn triggers dusk effects. Larger estimated value is usually better.',criteria:Object.fromEntries(candidates.map(c=>{
  const a=c.action,unit=p.hand.find(x=>x.uid===a.uid)||p.board.find(x=>x.uid===a.uid),info=cardInfo(unit?.cardId),target=find(s,a.target);
  return [c.id,`${a.type} ${info?`${info.id} (${info.attack} attack ${info.health} HP${info.drain?' drain':''}${info.shield?' shield':''}${info.guard?' guard':''})`:''}${a.choice?' choose '+a.choice:''} target ${a.target||'none'}${target?.frozen?' frozen':''}. Estimated value ${c.value.toFixed(2)}.`];
 }))}}};
}
export function cardView(s,actor){const t=copy(s);delete t.seed;delete t.uid;t.players.forEach((p,i)=>{p.deckCount=p.deck.length;delete p.deck;if(i!==actor)p.hand=p.hand.map(()=>({cardId:null}));});return t;}
