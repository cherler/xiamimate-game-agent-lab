// Promote the main build without removing archived previews or rollback snapshots.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {project} from './paths.mjs';
import {git,pagesHead,addPagesFiles,publishPagesTree} from './pages-git.mjs';
if(git(['status','--porcelain']))throw Error('先提交源码改动，再发布试玩版本。');
if(git(['branch','--show-current'])!=='main')throw Error('正式入口只从 main 发布。');
const source=git(['rev-parse','HEAD']),parent=pagesHead();
const build=spawnSync(process.execPath,['scripts/build.mjs','--static'],{cwd:project,stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
const release={source,channel:'main',previousPages:parent,createdAt:new Date().toISOString(),games:['snake','pong','cards','chess','rescue']};
const files=new Map([
 ['.nojekyll',''],['index.html',fs.readFileSync(path.join(project,'site/index.html'))],
 ['release.json',JSON.stringify(release,null,2)+'\n'],['compare/index.html',fs.readFileSync(path.join(project,'web/compare.html'))]
]);
const tree=addPagesFiles(parent,files);
const archived=git(['ls-tree','-r','--name-only',parent]).split('\n').filter(f=>f.startsWith('versions/')||f.startsWith('preview/'));
for(const file of archived)if(git(['rev-parse',parent+':'+file])!==git(['rev-parse',tree+':'+file]))throw Error('历史试玩发生变化，停止发布。');
const commit=publishPagesTree(tree,parent,'Publish main games from '+source.slice(0,12));
console.log(JSON.stringify({source,pagesCommit:commit,previousPages:parent,archivesPreserved:archived.length},null,2));
