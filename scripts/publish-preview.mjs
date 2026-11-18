import {git,pagesHead,addPagesFiles,publishPagesTree} from './pages-git.mjs';
import {comparisonFiles,preview} from './comparison-files.mjs';
if(git(['status','--porcelain']))throw Error('先提交本次修改，再发布试验版。');
if(git(['branch','--show-current'])!==preview.branch)throw Error('请在玩法试验分支发布。');
const parent=pagesHead(),{files,release}=await comparisonFiles(),tree=addPagesFiles(parent,files);
for(const name of ['index.html','release.json','.nojekyll'])if(git(['rev-parse',parent+':'+name])!==git(['rev-parse',tree+':'+name]))throw Error('原站文件发生变化，停止发布。');
const commit=publishPagesTree(tree,parent,'Publish isolated gameplay comparison from '+release.source.slice(0,12));
console.log(JSON.stringify({source:release.source,pagesCommit:commit,previousPages:parent,preview:'preview/'+preview.slug+'/',comparison:'compare/',stableUnchanged:true},null,2));
