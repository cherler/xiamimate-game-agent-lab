// Publish one playable release. Source branches keep history; old sites are not carried forward.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {project} from './paths.mjs';
import {git,pagesHead,addPagesFiles,publishPagesTree} from './pages-git.mjs';
if(git(['status','--porcelain']))throw Error('先提交源码改动，再发布试玩版本。');
if(git(['branch','--show-current'])!=='main')throw Error('正式入口只从 main 发布。');
const source=git(['rev-parse','HEAD']),parent=pagesHead();
const build=spawnSync(process.execPath,['scripts/build.mjs','--static'],{cwd:project,stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
const release={source,channel:'main',previousPages:parent,createdAt:new Date().toISOString(),games:['snake','pong','cards','chess','rescue','kart','dance','runner','ink']};
const manifest=JSON.parse(fs.readFileSync(path.join(project,'site/.build-files.json'),'utf8'));
const files=new Map(manifest.map(name=>[name,fs.readFileSync(path.join(project,'site',name))]));
files.set('release.json',JSON.stringify(release,null,2)+'\n');
const tree=addPagesFiles(null,files);
const commit=publishPagesTree(tree,parent,'Publish main games from '+source.slice(0,12));
console.log(JSON.stringify({source,pagesCommit:commit,previousPages:parent,entry:'/',publishedFiles:[...files.keys()]},null,2));
