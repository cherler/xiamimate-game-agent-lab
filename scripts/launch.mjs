// The launcher owns only the processes it starts. An existing arena can be reopened.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { project } from './paths.mjs';
process.chdir(project);
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const port=Number(process.env.PORT||4841),url='http://127.0.0.1:'+port;
const children=[];
if(process.argv.includes('--stop')){
  const file=path.join(project,'.runtime/arena-preview.pid');
  if(!fs.existsSync(file)){console.log('没有由后台启动器开启的预览。');process.exit(0);}
  const pid=Number(fs.readFileSync(file,'utf8'));
  const command=Number.isSafeInteger(pid)&&pid>1?spawnSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'}).stdout||'':'';
  if(command.includes(path.join(project,'scripts/launch.mjs'))){process.kill(pid,'SIGTERM');console.log('已停止本地预览。');}
  else console.log('后台预览已停止。');
  fs.rmSync(file,{force:true});process.exit(0);
}
async function probe(target){
  try{const r=await fetch(target,{signal:AbortSignal.timeout(1200)});return r.ok?await r.json():null;}catch{return null;}
}
function launch(bin,args,env={}){
  const child=spawn(bin,args,{cwd:project,env:{...process.env,...env},stdio:'inherit'});
  child.on('error',err=>console.error(err.message));children.push(child);return child;
}
function shutdown(){children.forEach(c=>{if(c.exitCode===null)c.kill();});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{shutdown();process.exit(0);});
process.on('exit',shutdown);
function openBrowser(){
  console.log('试玩入口 '+url);
  if(process.argv.includes('--open')&&process.platform==='darwin')spawn('open',[url],{stdio:'ignore'});
}
try{await import('./build.mjs');}
catch(err){console.error('游戏页面准备失败：'+err.message);process.exit(1);}
if(process.argv.includes('--background')){
  if((await probe(url+'/api/health'))?.arena!=='round2'){
    fs.mkdirSync('.runtime',{recursive:true});const log=fs.openSync('.runtime/arena-preview.log','a');
    const child=spawn(process.execPath,[path.join(project,'scripts/launch.mjs'),...process.argv.slice(2).filter(x=>!['--background','--open'].includes(x))],{cwd:project,env:process.env,detached:true,stdio:['ignore',log,log]});
    child.unref();fs.closeSync(log);fs.writeFileSync('.runtime/arena-preview.pid',String(child.pid));
    let ready=false;for(let i=0;i<30;i++){if((await probe(url+'/api/health'))?.arena==='round2'){ready=true;break;}await new Promise(r=>setTimeout(r,250));}
    if(!ready){console.error('预览未启动，请查看 .runtime/arena-preview.log；也可直接打开 dist/index.html。');process.exit(1);}
  }
  openBrowser();process.exit(0);
}
if((await probe(url+'/api/health'))?.arena==='round2'){openBrowser();}
else{
  const app=launch(process.execPath,['server.mjs']);
  app.once('exit',code=>{shutdown();process.exitCode=code??0;});
  for(let i=0;i<25&&app.exitCode===null;i++){if((await probe(url+'/api/health'))?.arena==='round2'){openBrowser();break;}await new Promise(r=>setTimeout(r,200));}
  const modelBase=process.env.LAYA_BASE_URL||'http://127.0.0.1:4842';
  if(!process.argv.includes('--no-model')&&!process.env.LAYA_BASE_URL&&fs.existsSync('.runtime/laya-english/model.safetensors')&&!(await probe(modelBase+'/health'))){
    const py=process.env.ARENA_PYTHON||['.venv/bin/python','../xiamimate-model-lab/services/retrieval/.venv/bin/python'].find(f=>fs.existsSync(f));
    if(py){
      const sdk=path.join(project,'.runtime/sdk');
      const child=launch(py,['python/laya_server.py'],{PYTHONPATH:[sdk,process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),HF_HUB_OFFLINE:'1'});
      console.log('正在加载 Laya…');
      for(let i=0;i<90&&child.exitCode===null;i++){
        if(await probe(modelBase+'/health')){
          const {askProvider}=await import('../providers.mjs');
          const {initSnake}=await import('../src/snake.mjs');
          try{await askProvider('laya',initSnake(9701),0,'features',15000);}catch{console.log('模型启动预热未完成，可先选择规则对手。');}
          break;
        }
        await new Promise(r=>setTimeout(r,500));
      }
    }
  }

}
