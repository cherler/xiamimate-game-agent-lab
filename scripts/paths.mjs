import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const project=fileURLToPath(new URL('../',import.meta.url));
export const results=process.env.ARENA_RESULTS || path.resolve(project,'../output/game-agent-lab/round-2');
export function median(values) {
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b), mid=Math.floor(ordered.length/2);
  return ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;
}
export function percentile(values,q) {
  if(!values.length) return null;
  const a=[...values].sort((x,y)=>x-y);
  return Math.round(a[Math.max(0,Math.ceil(a.length*q)-1)]*100)/100;
}
export function counts(values) {
  return Object.fromEntries([...new Set(values)].map(v=>[v,values.filter(x=>x===v).length]));
}
