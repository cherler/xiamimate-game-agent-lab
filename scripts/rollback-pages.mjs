import {git,pagesHead,publishPagesTree} from './pages-git.mjs';
const args=process.argv.slice(2),at=args.indexOf('--to'),target=at>=0?args[at+1]:null;
if(!target||!/^[a-f0-9]{40}$/.test(target))throw Error('指定完整的旧发布提交：npm run rollback:pages -- --to <40 位提交号> [--apply]');
const current=pagesHead();git(['merge-base','--is-ancestor',target,current]);
const release=JSON.parse(git(['show',target+':release.json']));if(!/^[a-f0-9]{40}$/.test(release.source)||!git(['show',target+':index.html']).startsWith('<!doctype html>'))throw Error('目标不是有效的试玩发布版本。');
const tree=git(['rev-parse',target+'^{tree}']);
if(!args.includes('--apply'))console.log(JSON.stringify({dryRun:true,currentPages:current,restorePages:target,source:release.source,tree,changes:'恢复该发布的全部网页；使用新的提交保留发布历史。'},null,2));
else console.log(JSON.stringify({restoredFrom:target,pagesCommit:publishPagesTree(tree,current,'Restore Pages release '+target.slice(0,12)),source:release.source},null,2));
