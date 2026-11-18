import { CARDS,STARTERS,HEROES } from './catalog-v1.mjs';
import { noise } from './common.mjs';
export {CARDS,STARTERS,HEROES};
const tokens={T01:{id:'T01',name:'零件偶',attack:1,health:1,kind:'unit'},T02:{id:'T02',name:'维修偶',attack:2,health:2,kind:'unit'}};
export const cardInfo=id=>CARDS[id]||tokens[id];
const copy=s=>structuredClone(s);
const log=(s,text)=>{s.log.push(text);s.log=s.log.slice(-24);};
function shuffle(items,seed,channel){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(noise(seed,i,channel)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validateDeck(faction,deck){
  return ['W','F'].includes(faction)&&Array.isArray(deck)&&deck.length===20&&deck.every(id=>CARDS[id]&&(id[0]==='N'||id[0]===faction)&&deck.filter(x=>x===id).length<=2);
}
export function initCards(seed=1,configs=[{faction:'W'},{faction:'F'}]) {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||configs.length!==2)throw Error('开局设置无效');
  const first=Math.floor(noise(seed,0,19)*2);
  const s={game:'cards',version:1,seed,seq:0,uid:50,turn:first,first,phase:'mulligan',kept:[false,false],winner:null,reason:'',log:[],players:[]};
  for(let i=0;i<2;i++){
    const faction=configs[i].faction,deck=configs[i].deck||STARTERS[faction];
    if(!validateDeck(faction,deck))throw Error('卡组需要 20 张，同名最多两张，只能使用本阵营与中立牌');
    const p={faction,hp:20,mana:0,maxMana:0,turns:0,powerUsed:false,fatigue:0,board:[],hand:[],discard:[],deck:shuffle(deck.map((cardId,n)=>({uid:'p'+i+'c'+n,cardId})),seed,41+i)};
    s.players.push(p);for(let n=0;n<(i===first?3:4);n++)p.hand.push(p.deck.shift());
  }
  return s;
}
function find(s,id){if(id==='h0'||id==='h1')return s.players[Number(id[1])];return s.players.flatMap(p=>p.board).find(u=>u.uid===id);}
function winnerCheck(s){
  const dead=s.players.map(p=>p.hp<=0);if(dead.some(Boolean)){s.winner=dead[0]&&dead[1]?-1:dead[0]?1:0;s.phase='ended';s.reason='英雄生命归零';}
}
function heal(s,id,n){const t=find(s,id);if(t&&t.hp>0)t.hp=Math.min(t.maxHp||20,t.hp+n);}
function spawn(s,actor,cardId){
  const p=s.players[actor];if(p.board.length>=5)return;
  const c=cardInfo(cardId);p.board.push({uid:'u'+s.uid++,cardId,attack:c.attack,hp:c.health,maxHp:c.health,shield:!!c.shield,guard:!!c.guard,rush:!!c.rush,fresh:true,exhausted:false});
}
function settle(s){
  winnerCheck(s);if(s.winner!==null)return;
  const dead=[];
  for(const actor of [s.turn,1-s.turn]){
    const p=s.players[actor];for(const u of p.board)if(u.hp<=0)dead.push({actor,...u});
    p.board=p.board.filter(u=>u.hp>0);
  }
  for(const u of dead){
    s.players[u.actor].discard.push(u.cardId);log(s,cardInfo(u.cardId).name+'退场');
    if(u.cardId==='W01')spawn(s,u.actor,'T01');
    if(u.cardId==='W05'){spawn(s,u.actor,'T02');spawn(s,u.actor,'T02');}
    if(u.cardId==='F01')heal(s,'h'+u.actor,2);
  }
}
function damage(s,packets){
  for(const [id,n] of packets){const t=find(s,id);if(!t||n<=0)continue;if(t.shield){t.shield=false;log(s,'护盾抵挡伤害');}else t.hp-=n;}
  settle(s);
}
function drawCard(s,actor){
  const p=s.players[actor];if(!p.deck.length){p.fatigue++;damage(s,[['h'+actor,p.fatigue]]);log(s,'疲劳伤害 '+p.fatigue);return;}
  const c=p.deck.shift();if(p.hand.length>=8){p.discard.push(c.cardId);log(s,cardInfo(c.cardId).name+'因手牌已满弃置');}else p.hand.push(c);
}
function startTurn(s,actor){
  s.turn=actor;const p=s.players[actor];p.turns++;p.maxMana=Math.min(8,p.maxMana+1);p.mana=p.maxMana;p.powerUsed=false;
  for(const u of p.board){u.fresh=false;u.exhausted=false;}drawCard(s,actor);
}
function targetIds(s,actor,id){
  const own=s.players[actor].board.map(u=>u.uid),enemy=s.players[1-actor].board.map(u=>u.uid);
  if(['N06','W07','F07'].includes(id))return enemy;
  if(id==='N07')return ['h'+actor,...own];
  if(['W06','F06'].includes(id))return own;
  if(['W03','F03'].includes(id))return own.length?own:[null];
  return [null];
}
export function cardActions(s,actor=s.turn){
  if(s.winner!==null||s.phase!=='play'||s.turn!==actor)return [];
  const p=s.players[actor],enemy=s.players[1-actor],actions=[];
  for(const c of p.hand){const info=CARDS[c.cardId];if(p.mana<info.cost||(info.kind==='unit'&&p.board.length>=5))continue;
    for(const target of targetIds(s,actor,c.cardId))actions.push({id:`play:${c.uid}:${target||'-'}`,type:'play',uid:c.uid,target});
  }
  const guards=enemy.board.filter(u=>u.guard);
  for(const u of p.board){
    if(u.exhausted||u.attack<=0||(u.fresh&&!u.rush))continue;
    const targets=(guards.length?guards:enemy.board).map(e=>e.uid);
    if(!guards.length&&!u.fresh)targets.push('h'+(1-actor));
    for(const target of targets)actions.push({id:`attack:${u.uid}:${target}`,type:'attack',uid:u.uid,target});
  }
  if(!p.powerUsed&&p.mana>=2){const targets=p.faction==='W'?enemy.board.map(u=>u.uid):['h'+actor,...p.board.map(u=>u.uid)];
    for(const target of targets)actions.push({id:'power:'+target,type:'power',target});
  }
  actions.push({id:'end',type:'end'});return actions;
}
export function stepCards(s,actor,input){
  if(![0,1].includes(actor)||s.winner!==null)throw Error('对局已结束或玩家无效');
  if(s.phase==='mulligan'){
    if(input.type!=='mulligan'||s.kept[actor]||!Array.isArray(input.replace)||new Set(input.replace).size!==input.replace.length||!input.replace.every(id=>s.players[actor].hand.some(c=>c.uid===id)))throw Error('起手换牌无效');
    const t=copy(s),p=t.players[actor],removed=p.hand.filter(c=>input.replace.includes(c.uid));
    p.hand=p.hand.filter(c=>!input.replace.includes(c.uid));for(let i=0;i<removed.length;i++)p.hand.push(p.deck.shift());
    p.deck=shuffle([...p.deck,...removed],s.seed,81+actor);t.kept[actor]=true;t.seq++;
    if(t.kept.every(Boolean)){t.phase='play';startTurn(t,t.first);log(t,'牌局开始');}return t;
  }
  const a=cardActions(s,actor).find(x=>x.id===input.id);if(!a)throw Error('这个动作现在不能执行');
  const t=copy(s),p=t.players[actor];t.seq++;
  if(a.type==='end'){
    log(t,HEROES[p.faction].name+'结束回合');
    if(p.turns>=20&&t.players[1-actor].turns>=20){t.winner=-1;t.phase='ended';t.reason='双方各完成 20 回合';}
    else startTurn(t,1-actor);return t;
  }
  if(a.type==='attack'){
    const u=find(t,a.uid),target=find(t,a.target);u.exhausted=true;
    log(t,cardInfo(u.cardId).name+'攻击'+(a.target.startsWith('h')?'英雄':cardInfo(target.cardId).name));
    damage(t,[[a.target,u.attack],...(a.target.startsWith('h')?[]:[[u.uid,target.attack]])]);return t;
  }
  if(a.type==='power'){
    p.mana-=2;p.powerUsed=true;log(t,HEROES[p.faction].power);
    if(p.faction==='W')damage(t,[[a.target,1]]);else heal(t,a.target,2);return t;
  }
  const hand=p.hand.find(c=>c.uid===a.uid),c=CARDS[hand.cardId],id=c.id;
  p.hand=p.hand.filter(c=>c.uid!==a.uid);p.mana-=c.cost;log(t,'打出'+c.name);
  if(c.kind==='unit')spawn(t,actor,id);else p.discard.push(id);
  const target=find(t,a.target);
  if(id==='N03')drawCard(t,actor);
  if(id==='N06')damage(t,[[a.target,3]]);
  if(id==='N07'){heal(t,a.target,3);drawCard(t,actor);}
  if(id==='N08'){drawCard(t,actor);if(t.winner===null)drawCard(t,actor);}
  if(id==='W03'&&target)target.attack++;
  if(id==='W06'&&target){target.hp+=2;target.maxHp+=2;}
  if(id==='W07'){damage(t,[[a.target,4]]);if(t.winner===null)damage(t,[['h'+actor,1]]);}
  if(id==='W08')damage(t,t.players[1-actor].board.map(u=>[u.uid,2]));
  if(id==='F03'&&target)heal(t,a.target,3);
  if(id==='F05')heal(t,'h'+actor,2);
  if(id==='F06'&&target){target.attack++;target.hp++;target.maxHp++;}
  if(id==='F07'){damage(t,[[a.target,3]]);if(t.winner===null)heal(t,'h'+actor,2);}
  if(id==='F08')for(const u of p.board){u.attack++;u.hp++;u.maxHp++;}
  return t;
}
function evaluate(s,actor){
  if(s.winner!==null)return s.winner===-1?0:s.winner===actor?100000:-100000;
  const value=p=>p.hp*.65+p.hand.length*1.8+p.mana*.04+p.board.reduce((v,u)=>v+2.5+u.attack*1.3+u.hp*.65+(u.shield?2:0)+(u.guard?.8:0)+(u.cardId==='W05'?4:u.cardId==='W01'?1.2:0),0);
  return value(s.players[actor])-value(s.players[1-actor]);
}
export function rankCardActions(s,actor=s.turn,deep=true){
  const rows=cardActions(s,actor).map(action=>{const next=stepCards(s,actor,action);return {action,value:evaluate(next,actor),next};}).sort((a,b)=>b.value-a.value||a.action.id.localeCompare(b.action.id));
  if(deep)for(const row of rows.slice(0,8)){
    // Drawing changes unknown information. Never search the actual hidden next card.
    if(row.next.turn!==actor||row.next.winner!==null||row.next.players.some((p,i)=>p.deck.length!==s.players[i].deck.length))continue;
    const next=rankCardActions(row.next,actor,false)[0];if(next)row.value=Math.max(row.value,next.value-.015);
  }
  return rows.sort((a,b)=>b.value-a.value||a.action.id.localeCompare(b.action.id)).map(({action,value})=>({action,value}));
}
export function chooseCard(s,actor=s.turn){
  if(s.phase==='mulligan')return {type:'mulligan',replace:s.players[actor].hand.filter(c=>CARDS[c.cardId].cost>=4).map(c=>c.uid)};
  return rankCardActions(s,actor)[0]?.action;
}
export function cardActionText(s,actor,a){
  if(a.type==='mulligan')return '确认起手';if(a.type==='end')return '结束回合';
  if(a.type==='power')return HEROES[s.players[actor].faction].power;
  const u=a.type==='play'?s.players[actor].hand.find(c=>c.uid===a.uid):s.players[actor].board.find(c=>c.uid===a.uid);
  return (a.type==='play'?'打出':'使用')+(cardInfo(u?.cardId)?.name||'单位')+(a.target?' · '+(a.target.startsWith('h')?'英雄':cardInfo(find(s,a.target)?.cardId)?.name||'单位'):'');
}
export function cardCandidates(s,actor){return rankCardActions(s,actor).slice(0,6).map((r,i)=>({id:'A'+i,action:r.action,value:r.value,label:cardActionText(s,actor,r.action)}));}
export function cardPacket(s,actor,candidates=cardCandidates(s,actor)){
  const p=s.players[actor],e=s.players[1-actor];
  return {state:{yourHP:p.hp,enemyHP:e.hp,mana:p.mana,ownBoard:p.board.length,enemyBoard:e.board.length,ownHand:p.hand.length,enemyHand:e.hand.length},questions:{move:{type:'choice',instructions:'Choose a legal move in a card duel. Defeat the enemy hero, protect your hero, and preserve useful units and cards. Larger board value estimates are usually better, but lethal wins first.',criteria:Object.fromEntries(candidates.map(c=>{
    const a=c.action,unit=p.hand.find(x=>x.uid===a.uid)||p.board.find(x=>x.uid===a.uid),info=cardInfo(unit?.cardId);
    return [c.id,`${a.type} ${info?`${info.id} (${info.attack} attack ${info.health} HP${info.shield?' shield':''}${info.guard?' guard':''})`:''} target ${a.target||'none'}. Estimated value ${c.value.toFixed(2)}.`];
  }))}}};
}
export function cardView(s,actor){
  const t=copy(s);delete t.seed;delete t.uid;
  t.players.forEach((p,i)=>{p.deckCount=p.deck.length;delete p.deck;if(i!==actor)p.hand=p.hand.map(()=>({cardId:null}));});
  return t;
}
