import test from 'node:test';
import assert from 'node:assert/strict';
import {accountScanEstimates,readClientAccount,recordedEstimateDelta} from '../lib/client-account-view.js';
const now=Date.parse('2026-10-07T12:00:00Z');
test('account estimates sort actual times and exclude incomplete, missing, invalid and future scores',()=>{
 const row=(id,score,createdAt,status='completed')=>({id,score,createdAt,status});
 const d=accountScanEstimates([row('new',60,'2026-10-07T10:00:00Z'),row('null',null,'2026-10-06'),row('boolean',false,'2026-10-06'),row('blank','','2026-10-06'),row('pending',90,'2026-10-06','running'),row('future',100,'2026-10-08'),row('old',0,'2026-10-05'),row('bad',200,'2026-10-06'),row('nodate',42,null)],now);
 assert.equal(d.first.id,'old');assert.equal(d.latest.id,'new');assert.equal(d.count,2);assert.equal(d.delta,undefined);
 assert.deepEqual(accountScanEstimates(null,now),{first:null,latest:null,count:0});
});
test('account source rejects wrong client, malformed data and authorization failures',async()=>{
 for(const account of [null,{client:{id:'other'},scans:[],activity:[],payments:[]},{client:{id:'a'},scans:null,activity:[],payments:[]}])await assert.rejects(readClientAccount(async()=>({ok:true,json:async()=>({account})}),'a'));
 for(const status of [401,403,503])await assert.rejects(readClientAccount(async()=>({ok:false,status}),'a'));
 const account={client:{id:'a'},scans:[],activity:[],payments:[]},signal=new AbortController().signal;
 assert.equal(await readClientAccount(async(path,o)=>{assert.match(path,/clientId=a/);assert.equal(o.cache,'no-store');assert.equal(o.signal,signal);return {ok:true,json:async()=>({account})}},'a',signal),account);
});
test('legacy activity deltas remain estimates and missing values never become zero',()=>{
 for(const x of [null,undefined,'',' ',false,NaN,101])assert.equal(recordedEstimateDelta(x),null);
 assert.equal(recordedEstimateDelta(0),'Ön puan farkı: 0 (tahmin)');assert.equal(recordedEstimateDelta(12),'Ön puan farkı: +12 (tahmin)');
});
