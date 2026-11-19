import fs from 'node:fs/promises';
import path from 'node:path';
import {project} from './paths.mjs';
import {comparisonFiles,preview} from './comparison-files.mjs';
const {files,release}=await comparisonFiles(),directory=path.join(project,'.runtime/compare-site');
for(const [name,data]of files){const file=path.join(directory,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
await fs.writeFile(path.join(directory,'index.html'),files.get(preview.baselinePath+'/index.html'));
console.log(JSON.stringify({directory,source:release.source,entry:'/compare/'},null,2));
