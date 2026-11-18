// Publish only generated static files; keep the source checkout on its branch.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {project} from './paths.mjs';
process.chdir(project);
function git(args,input){
 const r=spawnSync('git',args,{input,encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr||r.stdout||'Git command failed');
 return r.stdout.trim();
}
if(git(['status','--porcelain']))throw Error('先提交源码改动，再发布试玩版本。');
const remote=git(['remote','get-url','origin']);
if(!/^(https:\/\/github\.com\/|git@github\.com:)[\w.-]+\/[\w.-]+(?:\.git)?$/.test(remote))throw Error('origin 必须是目标 GitHub 仓库。');
const source=git(['rev-parse','HEAD']);
const build=spawnSync(process.execPath,['scripts/build.mjs','--static'],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
const release={source,createdAt:new Date().toISOString(),games:['snake','pong','cards','chess','rescue']};
const entries=[['.nojekyll',''],['index.html',fs.readFileSync('site/index.html')],['release.json',JSON.stringify(release,null,2)+'\n']];
const tree=git(['mktree'],entries.map(([name,content])=>`100644 blob ${git(['hash-object','-w','--stdin'],content)}\t${name}`).join('\n')+'\n');
const old=git(['ls-remote','origin','refs/heads/gh-pages']);
let parent=[];
if(old){git(['fetch','--quiet','origin','gh-pages']);parent=['-p',git(['rev-parse','FETCH_HEAD'])];}
const commit=git(['commit-tree',tree,...parent,'-m','Deploy playable demo from '+source.slice(0,12)]);
git(['push','origin',commit+':refs/heads/gh-pages']);
console.log(JSON.stringify({source,pagesCommit:commit,branch:'gh-pages'},null,2));
