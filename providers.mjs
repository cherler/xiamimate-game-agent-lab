import { performance } from 'node:perf_hooks';
import { snakePacket } from './src/snake.mjs';
import { snakePlanPacket } from './src/snake-planner.mjs';

const layaBase=process.env.LAYA_BASE_URL || 'http://127.0.0.1:4842';
export const jevModel=process.env.JEV_MODEL||'jev-1.14.0';
export async function layaInfo() {
  const r=await fetch(layaBase+'/health',{signal:AbortSignal.timeout(1500)});
  if(!r.ok) throw new Error('Laya 服务未就绪');
  return r.json();
}
export async function askProvider(provider,s,actor,encoding='features',timeout=5000,externalSignal,allowed) {
  return askTyped(provider,encoding==='plans'?snakePlanPacket(s,actor,allowed||[]):snakePacket(s,actor,encoding,allowed),timeout,externalSignal);
}
export async function askTyped(provider,packet,timeout=5000,externalSignal) {
  const start=performance.now();
  if(provider!=='laya'&&provider!=='jev') throw new Error('模型类型无效');
  const cloud=provider==='jev';
  if(cloud&&!process.env.TYPESAFE_API_KEY) throw new Error('Jev 凭证未配置');
  const headers={'Content-Type':'application/json'};
  if(cloud) headers.Authorization='Bearer '+process.env.TYPESAFE_API_KEY;
  else if(process.env.LAYA_API_KEY) headers.Authorization='Bearer '+process.env.LAYA_API_KEY;
  const signal=AbortSignal.timeout(timeout);
  const res=await fetch((cloud?'https://api.typesafe.ai':layaBase)+'/v1/systemone',{
    method:'POST',headers,body:JSON.stringify({...packet,model:cloud?jevModel:'laya'}),
    signal:externalSignal?AbortSignal.any([externalSignal,signal]):signal});
  if(!res.ok) throw new Error('HTTP '+res.status);
  const data=await res.json(), a=data.answers?.move;
  return {id:a?.choice,source:provider,model:data.model||null,confidence:a?.confidence??null,
    probabilities:a?.probabilities??null,inputTokens:data.usage?.input_tokens??null,
    inferenceMs:data.inference_ms??null,ms:performance.now()-start};
}
