import test from 'node:test';
import assert from 'node:assert/strict';
import {combatPreview} from '../web/card-table.mjs';

test('攻击预览同时计算双方受伤，并按剩余生命显示致命伤害',()=>{
 const p=combatPreview({attack:3,hp:4},{attack:2,hp:2});
 assert.deepEqual(p,{target:{loss:2,blocked:false,dead:true},source:{loss:2,blocked:false,dead:false}});
});
test('攻击预览中的护盾阻止伤害且不显示击倒',()=>{
 const p=combatPreview({attack:6,hp:2,shield:true},{attack:4,hp:1,shield:true});
 assert.deepEqual(p,{target:{loss:0,blocked:true,dead:false},source:{loss:0,blocked:true,dead:false}});
});
test('英雄不反击，攻击英雄时不预告己方掉血',()=>{
 const p=combatPreview({attack:4,hp:3},{hp:20},true);
 assert.deepEqual(p,{target:{loss:4,blocked:false,dead:false},source:null});
});
test('零攻击反伤不消耗护盾',()=>{
 const p=combatPreview({attack:1,hp:3,shield:true},{attack:0,hp:4});
 assert.deepEqual(p.source,{loss:0,blocked:false,dead:false});
});
