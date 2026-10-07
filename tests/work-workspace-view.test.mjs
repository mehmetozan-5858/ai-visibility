import test from 'node:test';
import assert from 'node:assert/strict';
import {readWorkWorkspace} from '../lib/work-workspace-view.js';
const reply=(data,ok=true)=>({ok,json:async()=>data});
const item={id:'w1',clientId:'c1',status:'ready'};
test('loads work and delivery records with uncached cancellable requests',async()=>{
 const signal=new AbortController().signal,requests=[];
 const result=await readWorkWorkspace(async(url,options)=>{requests.push([url,options]);return reply(url.includes('work-items')?{items:[item]}:{deliveries:[{workId:'w1',status:'draft-created'}]})},signal);
 assert.equal(result.deliveries.w1.status,'draft-created');assert.deepEqual(result.items,[item]);assert.equal(result.deliveryError,'');
 assert.ok(requests.every(([,o])=>o.signal===signal&&o.cache==='no-store'));
});
test('rejects unauthorized or malformed work lists instead of presenting empty success',async()=>{
 await assert.rejects(readWorkWorkspace(async()=>reply({error:'Yetkisiz'},false)),/Yetkisiz/);
 await assert.rejects(readWorkWorkspace(async()=>reply({items:null})),/doğrulanamadı/);
 await assert.rejects(readWorkWorkspace(async()=>reply({items:[{id:'w1'}]})),/doğrulanamadı/);
});
test('preserves work view while delivery failure disables delivery actions',async()=>{
 let count=0;const result=await readWorkWorkspace(async()=>++count===1?reply({items:[item]}):reply({deliveries:null}));
 assert.deepEqual(result.items,[item]);assert.deepEqual(result.deliveries,{});assert.match(result.deliveryError,/doğrulanamadı/);
});
test('propagates cancellation during delivery read instead of showing a partial snapshot',async()=>{
 let count=0;await assert.rejects(readWorkWorkspace(async()=>{if(++count===1)return reply({items:[item]});const e=Error('Cancelled');e.name='AbortError';throw e}),{name:'AbortError'});
});
