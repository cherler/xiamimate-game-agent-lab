import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { askProvider,askTyped,layaInfo,jevModel } from './providers.mjs';
import { safeOptions,snakeMoves,DELTA } from './src/snake.mjs';
import { snakePlans } from './src/snake-planner.mjs';
import { project } from './scripts/paths.mjs';
import { RoomStore } from './rooms.mjs';
import { cardCandidates,cardPacket } from './src/cards.mjs';
import {chessPacket} from './src/chess-v1.mjs';
const rooms=new RoomStore();

const port=Number(process.env.PORT||4841), hosts=new Set(['127.0.0.1:'+port,'localhost:'+port]);
const lan=process.env.ARENA_LAN==='1';
if(lan)for(const values of Object.values(os.networkInterfaces()))for(const n of values||[])if(n.family==='IPv4'&&!n.internal)hosts.add(n.address+':'+port);
const active=new Set();
function json(res,code,value) {
  if(res.destroyed)return;
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(value));
}
async function readRequest(req){
  let size=0;const chunks=[];
  for await(const c of req){size+=c.length;if(size>160000)throw Error('body too large');chunks.push(c);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function validate(s,tag) {
  const validCell=n=>Number.isInteger(n)&&n>=0&&n<121;
  return s&&Array.isArray(s.bodies)&&s.bodies.length===2&&s.bodies.every(b=>Array.isArray(b)&&b.length>0&&b.length<=121&&b.every(validCell))&&
    Array.isArray(s.dirs)&&s.dirs.length===2&&s.dirs.every(d=>Object.hasOwn(DELTA,d))&&validCell(s.food)&&
    tag&&typeof tag.matchId==='string'&&tag.matchId.length<=90&&Number.isInteger(tag.epoch)&&tag.epoch>=0&&tag.epoch<180&&[0,1].includes(tag.actor);
}
const server=http.createServer(async(req,res)=>{
  if(!hosts.has(req.headers.host)){json(res,403,{error:'local host only'});return;}
  if(req.method==='GET'&&req.url==='/api/health'){json(res,200,{arena:'round2',ready:true});return;}
  if(req.method==='GET'&&['/web/index.html','/dist/index.html'].includes(req.url)){
    res.writeHead(302,{'Location':'/','Cache-Control':'no-store'});res.end();return;
  }
  if(req.method==='POST'&&((req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)||req.headers['content-type']?.split(';')[0]!=='application/json')){json(res,403,{error:'same-origin JSON required'});return;}
  if(req.url==='/api/rooms'&&req.method==='POST'){
    try{const body=await readRequest(req);json(res,200,rooms.create(body.game,body));}catch(e){json(res,400,{error:e.message});}return;
  }
  const route=req.url.match(/^\/api\/rooms\/([A-F0-9]{6})(?:\/(join|action|replay))?$/);
  if(route){
    const [,code,action]=route,auth=req.headers.authorization?.replace(/^Bearer /,'');
    try{
      if(action==='join'&&req.method==='POST')json(res,200,rooms.join(code,await readRequest(req)));
      else if(action==='action'&&req.method==='POST'){const b=await readRequest(req);json(res,200,rooms.act(code,auth,b.seq,b.action));}
      else if(action==='replay'&&req.method==='GET')json(res,200,rooms.replay(code,auth));
      else if(!action&&req.method==='GET')json(res,200,rooms.view(code,auth));
      else json(res,405,{error:'method not supported'});
    }catch(e){json(res,400,{error:e.message});}return;
  }
  if(req.url==='/api/strategy-decision'&&req.method==='POST'){
    let body;try{body=await readRequest(req);}catch{json(res,400,{error:'invalid JSON'});return;}
    const {game,state,actor,provider}=body||{};
    const valid=state?.game===game&&[0,1].includes(actor)&&provider==='laya'&&Array.isArray(state.players)&&state.players.length===2&&
      (game==='cards'?state.players.every(p=>Array.isArray(p.hand)&&p.hand.length<=8&&Array.isArray(p.board)&&p.board.length<=5&&Array.isArray(p.deck)&&p.deck.length<=20):
       game==='chess'&&state.phase==='prep'&&state.players.every(p=>Array.isArray(p.units)&&p.units.length<=11&&Array.isArray(p.shop)&&p.shop.length===4));
    if(!valid){json(res,400,{error:'invalid game state'});return;}
    if(active.has(provider)){json(res,429,{error:'busy'});return;}active.add(provider);
    const ctrl=new AbortController();res.on('close',()=>ctrl.abort());
    try{const candidates=game==='cards'?cardCandidates(state,actor):[{id:'balanced'},{id:'economy'},{id:'strength'},{id:'level'}];if(!candidates.length)throw Error();const answer=await askTyped(provider,game==='cards'?cardPacket(state,actor,candidates):chessPacket(state,actor),2500,ctrl.signal);if(!candidates.some(c=>c.id===answer.id))throw Error();json(res,200,answer);}
    catch{json(res,503,{error:'model unavailable'});}finally{active.delete(provider);}return;
  }
  if(req.method==='GET'&&req.url==='/api/providers'){
    let info=null;try{info=await layaInfo();}catch{}
    json(res,200,{arena:'round2',laya:Boolean(info?.revision),layaModel:info?.model||null,
      jev:Boolean(process.env.TYPESAFE_API_KEY),jevModel});return;
  }
  if(req.method==='POST'&&req.url==='/api/decision'){
    if((req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)||req.headers['content-type']?.split(';')[0]!=='application/json'){
      json(res,403,{error:'same-origin JSON required'});return;
    }
    let payload;try{payload=await readRequest(req);}catch{json(res,400,{error:'invalid JSON'});return;}
    const {snapshot,tag,provider,guarded,planning,trail=[]}=payload||{};
    if(!validate(snapshot,tag)||!['jev','laya'].includes(provider)){json(res,400,{error:'invalid board'});return;}
    if(!Array.isArray(trail)||trail.length>12||!trail.every(n=>Number.isInteger(n)&&n>=0&&n<121)){json(res,400,{error:'invalid trail'});return;}
    if(active.has(provider)){json(res,429,{error:'busy'});return;}
    if(provider==='jev'&&!process.env.TYPESAFE_API_KEY){json(res,503,{error:'Jev unavailable'});return;}
    const ctrl=new AbortController();res.on('close',()=>ctrl.abort());active.add(provider);
    try{
      const ids=planning?snakePlans(snapshot,tag.actor,trail).map(p=>p.id):guarded?safeOptions(snapshot,tag.actor).map(o=>o.id):snakeMoves(snapshot,tag.actor);
      const answer=ids.length===1?{id:ids[0],source:'forced',ms:0}:
        await askProvider(provider,snapshot,tag.actor,planning?'plans':'features',5000,ctrl.signal,planning?trail:ids);
      json(res,200,{tag,answer});
    }catch{json(res,503,{error:'model unavailable'});}finally{active.delete(provider);}
    return;
  }
  if(req.method==='GET'&&['/','/index.html'].includes(req.url)){
    try{const html=await fs.readFile(path.join(project,'dist/index.html'));res.writeHead(200,{
      'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(html);}
    catch{json(res,503,{error:'Run npm run build first'});}
  }else if(req.url==='/favicon.ico'){res.writeHead(204);res.end();}
  else json(res,404,{error:'unknown route'});
});
server.on('error',e=>{console.error('试玩服务无法启动',e.code);process.exitCode=1;});
server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{console.log('试玩入口 http://127.0.0.1:'+port);if(lan)for(const host of hosts)if(!host.startsWith('127.')&&!host.startsWith('localhost'))console.log('同一局域网入口 http://'+host);});
