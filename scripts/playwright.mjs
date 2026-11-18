import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {project} from './paths.mjs';

const choices=process.env.ARENA_PLAYWRIGHT
  ?[pathToFileURL(path.resolve(process.env.ARENA_PLAYWRIGHT)).href]
  :['playwright',pathToFileURL(path.resolve(project,'../xiamimate-ai-atlas/node_modules/playwright/index.mjs')).href];
let runtime;
for(const entry of choices){try{runtime=await import(entry);break;}catch(error){if(!['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error.code))throw error;}}
if(!runtime)throw Error('浏览器检查需要 Playwright。安装 playwright，或用 ARENA_PLAYWRIGHT 指定已有安装的入口。');
export const {chromium}=runtime;
