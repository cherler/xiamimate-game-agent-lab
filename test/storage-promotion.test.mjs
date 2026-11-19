import test from 'node:test';
import assert from 'node:assert/strict';
import {readGameSave,storageKey} from '../web/storage.mjs';
const storage=entries=>{const m=new Map(entries);return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),m};};
test('推广到主站时复制旧进度，仍保留原键供回滚',()=>{
 for(const key of ['glimmer-card-save','glimmer-chess-save','glimmer-rescue-save','arena-session-snake','arena-session-pong']){const s=storage([[key,'old-match']]);assert.equal(readGameSave(s,key,true),'old-match');assert.equal(s.getItem(key),'old-match');assert.equal(s.getItem(storageKey(key)),'old-match');}
});
test('已有试验版进度优先，后续操作不覆盖原版存档',()=>{
 const key='glimmer-chess-save',s=storage([[key,'old-match'],[storageKey(key),'preview-match']]);assert.equal(readGameSave(s,key,true),'preview-match');s.setItem(storageKey(key),'continued');assert.equal(s.getItem(key),'old-match');
});
test('原版与对照版不自动互相导入，空间满时仍可读取旧进度',()=>{
 const key='glimmer-chess-save',s=storage([[key,'old-match']]);assert.equal(readGameSave(s,key,false),null);assert.equal(s.getItem(storageKey(key)),null);s.setItem=()=>{throw Error('full');};assert.equal(readGameSave(s,key,true),'old-match');assert.equal(s.getItem(key),'old-match');
});
