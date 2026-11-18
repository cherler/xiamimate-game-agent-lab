import { leading, noise, ranked } from './common.mjs';

export const SIDE = 11, SNAKE_LIMIT = 180;
export const DELTA = { up: [0,-1], right: [1,0], down: [0,1], left: [-1,0] };
const reverse = { up:'down', down:'up', left:'right', right:'left' };
const directions = Object.keys(DELTA);
export const xy = cell => [cell % SIDE, Math.floor(cell / SIDE)];
const distance = (a,b) => Math.abs(a % SIDE-b % SIDE) + Math.abs(Math.floor(a/SIDE)-Math.floor(b/SIDE));

export function nextCell(cell, direction) {
  const [x,y] = xy(cell), [dx,dy] = DELTA[direction];
  const nx = x+dx, ny = y+dy;
  return nx < 0 || nx >= SIDE || ny < 0 || ny >= SIDE ? -1 : ny*SIDE+nx;
}

function placeFood(state) {
  const occupied = new Set(state.bodies.flat());
  const free = Array.from({length:SIDE*SIDE}, (_,i)=>i).filter(i=>!occupied.has(i));
  return free.length ? free[Math.floor(noise(state.seed, state.tick, 17)*free.length)] : -1;
}

export function initSnake(seed,{legacy=false}={}) {
  const s = { game:'snake', seed, tick:0, bodies:[[46,45,44],[74,75,76]], dirs:['right','left'],
    food:-1, score:[0,0], alive:[true,true], winner:null, reason:'' };
  s.food=legacy?placeFood(s):60;
  if(!legacy)s.rules=2;
  return s;
}

export function snakeMoves(s, actor) {
  return directions.filter(d=>d !== reverse[s.dirs[actor]]);
}

export function stepSnake(s, moves) {
  if (s.winner !== null || !Array.isArray(moves) || moves.length !== 2 ||
      !moves.every((d,i)=>snakeMoves(s,i).includes(d))) throw new Error('无效的蛇移动');
  const heads=s.bodies.map((body,i)=>nextCell(body[0],moves[i]));
  const grow=heads.map(c=>c===s.food && c>=0);
  // Both tails vacate on the same tick unless that snake reaches food.
  const occupied=new Set(s.bodies.flatMap((body,i)=>grow[i] ? body : body.slice(0,-1)));
  const headConflict=heads[0]===heads[1] || (heads[0]===s.bodies[1][0] && heads[1]===s.bodies[0][0]);
  const alive=heads.map(h=>h>=0 && !headConflict && !occupied.has(h));
  const bodies=s.bodies.map((body,i)=>alive[i] ? [heads[i],...(grow[i] ? body : body.slice(0,-1))] : body);
  const score=s.score.map((v,i)=>v+Number(alive[i]&&grow[i]));
  const t={...s,tick:s.tick+1,dirs:[...moves],bodies,score,alive};
  if (grow.some((v,i)=>v&&alive[i])) t.food=placeFood(t);
  if (!alive.every(Boolean)) {
    t.winner=alive[0]===alive[1] ? -1 : Number(alive[1]);
    t.reason=!alive[0]&&!alive[1] ? '双方相撞' : '碰撞出局';
    if(s.rules===2){
      t.collisions=alive.flatMap((ok,i)=>{
        if(ok)return [];
        const [x,y]=xy(s.bodies[i][0]),[dx,dy]=DELTA[moves[i]],self=s.bodies[i].slice(0,grow[i]?undefined:-1).includes(heads[i]);
        return [{actor:i,x:Math.max(0,Math.min(SIDE-1,x+dx)),y:Math.max(0,Math.min(SIDE-1,y+dy)),kind:heads[i]<0?'撞墙':headConflict?'蛇头相撞':self?'撞到自己':'撞到对手'}];
      });
      t.reason=t.collisions.map(c=>c.kind).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
    }
  } else if (t.tick>=SNAKE_LIMIT || t.food<0) {
    t.winner=leading(bodies.map(b=>b.length)); t.reason=t.food<0?'棋盘已满':'时间到';
  }
  return t;
}

const neighbors=Array.from({length:121},(_,i)=>directions.map(d=>nextCell(i,d)).filter(c=>c>=0));
function freeArea(start,blocked) {
  if (start<0 || blocked[start]) return 0;
  const visited=Uint8Array.from(blocked), queue=[start]; visited[start]=1;
  for (let i=0;i<queue.length;i++) for (const n of neighbors[queue[i]]) {
    if (!visited[n]) { visited[n]=1; queue.push(n); }
  }
  return queue.length;
}

export function snakeOptions(s, actor) {
  const rival=1-actor;
  const threats=snakeMoves(s,rival).map(d=>nextCell(s.bodies[rival][0],d));
  const blocked=new Uint8Array(121);
  for (const b of s.bodies) for (const cell of b.slice(0,-1)) blocked[cell]=1;
  return snakeMoves(s,actor).map(id=>{
    const cell=nextCell(s.bodies[actor][0],id);
    const area=freeArea(cell,blocked);
    return {id,crash:area===0,contest:threats.includes(cell)&&cell>=0,area,
      food:cell<0?99:distance(cell,s.food), eats:cell===s.food, spaceHere:cell<0?0:neighbors[cell].filter(c=>!blocked[c]).length};
  });
}

export function snakeRule(options, entropy) {
  return ranked(options, o=> (o.crash ? -1000 : 0) - 13*Number(o.contest)
    + Math.min(o.area,28)*0.55 - o.food*1.65 + o.spaceHere*0.15, entropy);
}

export function safeOptions(s,actor) {
  const options=snakeOptions(s,actor), safe=options.filter(o=>!o.crash);
  return safe.length?safe:options;
}
export function snakePacket(s,actor,encoding='features',allowed) {
  const options=snakeOptions(s,actor).filter(o=>!allowed||allowed.includes(o.id));
  const occupied = new Set(s.bodies.flat());
  const rows=Array.from({length:SIDE},(_,y)=>Array.from({length:SIDE},(_,x)=>{
    const n=y*SIDE+x;
    if(n===s.bodies[actor][0]) return 'Y';
    if(n===s.bodies[1-actor][0]) return 'R';
    if(n===s.food) return 'F';
    return occupied.has(n)?'#':'.';
  }).join(''));
  const state={board:rows,you:s.dirs[actor],rival:s.dirs[1-actor]};
  const criteria=Object.fromEntries(options.map(o=>[o.id,encoding==='raw' ? 'move '+o.id :
    (o.crash?'crashes immediately':'open')+', rival '+(o.contest?'may collide':'clear')+', food distance '+o.food+', reachable cells '+o.area]));
  return {state,questions:{move:{type:'choice',instructions:'Drive Y in grid snake. R is the rival, F is food, # is a body. Avoid crashing first, then seek food and open space. Pick the best move.',criteria}}};
}
