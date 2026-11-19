import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {project} from './paths.mjs';

export function git(args,input,index){
 const r=spawnSync('git',args,{cwd:project,input,encoding:'utf8',maxBuffer:16*1024*1024,env:index?{...process.env,GIT_INDEX_FILE:index}:process.env});
 if(r.status!==0)throw Error(r.stderr||r.stdout||'Git 操作失败');return r.stdout.trim();
}
export function pagesHead(){
 const remote=git(['remote','get-url','origin']);if(!/^(https:\/\/github\.com\/|git@github\.com:)[\w.-]+\/[\w.-]+(?:\.git)?$/.test(remote))throw Error('origin 必须是目标 GitHub 仓库。');
 git(['fetch','--quiet','origin','gh-pages']);return git(['rev-parse','FETCH_HEAD']);
}
export function addPagesFiles(parent,files){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'arena-pages-')),index=path.join(directory,'index');
 try{git(['read-tree',parent],undefined,index);for(const [name,data]of files){
  if(!/^[\w./-]+$/.test(name)||name.startsWith('/')||name.split('/').includes('..'))throw Error('发布路径无效');
  const hash=git(['hash-object','-w','--stdin'],data);git(['update-index','--add','--cacheinfo','100644',hash,name],undefined,index);
 }return git(['write-tree'],undefined,index);}finally{fs.rmSync(directory,{recursive:true,force:true});}
}
export function publishPagesTree(tree,parent,message){
 const commit=git(['commit-tree',tree,'-p',parent,'-m',message]);git(['push','origin',commit+':refs/heads/gh-pages']);return commit;
}
