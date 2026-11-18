import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {project} from './paths.mjs';
import {git} from './pages-git.mjs';

export const preview=JSON.parse(await fs.readFile(path.join(project,'gameplay-preview.json'),'utf8'));
export async function comparisonFiles(){
 const built=spawnSync(process.execPath,['scripts/build.mjs','--static'],{cwd:project,stdio:'inherit'});if(built.status!==0)throw Error('试玩构建失败');
 const source=git(['rev-parse','HEAD']),baselineRelease=JSON.parse(git(['show',preview.baselinePages+':release.json']));
 if(baselineRelease.source!==preview.baselineSource)throw Error('原版发布记录不匹配');
 const release={source,channel:preview.slug,baselineSource:preview.baselineSource,createdAt:new Date().toISOString(),games:['snake','pong','cards','chess','rescue']};
 const files=new Map([
  ['preview/'+preview.slug+'/index.html',await fs.readFile(path.join(project,'site/index.html'))],
  ['preview/'+preview.slug+'/release.json',JSON.stringify(release,null,2)+'\n'],
  [preview.baselinePath+'/index.html',git(['show',preview.baselinePages+':index.html'])+'\n'],
  [preview.baselinePath+'/release.json',JSON.stringify(baselineRelease,null,2)+'\n'],
  ['compare/index.html',await fs.readFile(path.join(project,'web/compare.html'))]
 ]);
 // Preserve the original HTML byte-for-byte, including its final newline policy.
 const raw=spawnSync('git',['show',preview.baselinePages+':index.html'],{cwd:project,maxBuffer:16*1024*1024});if(raw.status!==0)throw Error('无法读取原版页面');files.set(preview.baselinePath+'/index.html',raw.stdout);
 return {files,release};
}
