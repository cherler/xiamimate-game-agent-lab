import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { project } from './paths.mjs';

const staticDemo=process.argv.includes('--static'),directory=path.join(project,staticDemo?'site':'dist');
const {simulate}=await import('../src/arena.mjs');
const samples=Object.fromEntries(['snake','pong'].map(g=>[g,simulate(g,41003,['planner','rule'],{record:true}).record]));
const [script,style,shell]=await Promise.all([
  build({entryPoints:[path.join(project,'web/app.mjs')],bundle:true,write:false,format:'iife',target:'es2022',outdir:directory,assetNames:'assets/music/[name]-[hash]',publicPath:'.',loader:{'.mp3':staticDemo?'file':'dataurl'}}),
  Promise.all(['style.css','tabletop.css','card-table.css','card-effects.css','chess-ui.css','rescue.css','gameplay.css','motion-games.css','rhythm-runner.css','game-screen.css','audio.css','play-first.css','mobile-playfield.css'].map(f=>fs.readFile(path.join(project,'web',f),'utf8'))).then(x=>x.join('\n')),fs.readFile(path.join(project,'web/shell.template.html'),'utf8')]);
const html=shell.replace('<script>/* ARENA_SCRIPT */</script>', '<script>globalThis.ARENA_STATIC='+JSON.stringify(staticDemo)+';/* ARENA_SCRIPT */</script>').replace('/* ARENA_STYLES */',()=>style).replace('/* ARENA_SAMPLES */',()=>JSON.stringify(samples).replaceAll('<','\\u003c'))
  .replace('/* ARENA_SCRIPT */',()=>script.outputFiles.find(f=>f.path.endsWith('.js')).text.replace(/<\/script/gi,'<\\/script'));
await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'index.html'),html);
const published=['index.html'];
if(staticDemo){await fs.writeFile(path.join(directory,'.nojekyll'),'');published.push('.nojekyll');for(const file of script.outputFiles.filter(f=>!f.path.endsWith('.js'))){const name=path.relative(directory,file.path);await fs.mkdir(path.dirname(file.path),{recursive:true});await fs.writeFile(file.path,file.contents);published.push(name);}}
await fs.writeFile(path.join(directory,'.build-files.json'),JSON.stringify(published));
console.log('Built offline and local play:',Buffer.byteLength(html),'bytes');
