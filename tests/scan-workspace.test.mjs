import test from 'node:test';
import assert from 'node:assert/strict';
import {readScanWorkspace,provisionalScore,scanCompletionMessage} from '../lib/scan-workspace.js';
const values={'/api/clients':{clients:[]},'/api/scans':{mode:'database',scans:[]},'/api/status':{database:{configured:true},providers:['ChatGPT','Gemini','Perplexity'].map(name=>({name,status:'not-connected'}))}};
const fetcher=async path=>({ok:true,json:async()=>values[path]});
test('scan workspace accepts genuine empty database records and unconfigured providers',async()=>{const d=await readScanWorkspace(fetcher);assert.deepEqual(d.clients,[]);assert.deepEqual(d.scans,[]);assert.equal(d.providers.length,3)});
test('unauthorized, partial, malformed or demo data never becomes an empty scan workspace',async()=>{
 for(const status of [401,403,503])await assert.rejects(readScanWorkspace(async p=>p==='/api/clients'?{ok:false,status}:fetcher(p)),status===503?/scan-source-unavailable/:/scan-session-required/);
 for(const patch of [{mode:'demo-only'}, {scans:null}])await assert.rejects(readScanWorkspace(async p=>p==='/api/scans'?{ok:true,json:async()=>({...values[p],...patch})}:fetcher(p)));
 for(const patch of [{database:{configured:false}},{providers:[]},{providers:[...values['/api/status'].providers.slice(0,2),values['/api/status'].providers[0]]}])await assert.rejects(readScanWorkspace(async p=>p==='/api/status'?{ok:true,json:async()=>({...values[p],...patch})}:fetcher(p)));
 await assert.rejects(readScanWorkspace(async()=>({ok:true,json:async()=>{throw Error('html')}})));
});
test('scan read cancellation and no-store are forwarded to all sources',async()=>{let calls=0;const signal=new AbortController().signal;await readScanWorkspace(async(p,o)=>{calls++;assert.equal(o.signal,signal);assert.equal(o.cache,'no-store');return fetcher(p)},signal);assert.equal(calls,3)});
test('completion messages keep provisional estimates separate and reject invalid score values',()=>{
 for(const value of [null,undefined,'',' ',NaN,-1,101,'invalid'])assert.equal(provisionalScore(value),'—');assert.equal(provisionalScore(0),'0/100');assert.equal(provisionalScore('42'),'42/100');const message=scanCompletionMessage({providers:[{name:'ChatGPT',score:42}],providerErrors:[{provider:'Gemini',error:'private detail'}],scan:{score:42}});assert.match(message,/1\/3 sağlayıcı yanıtı kaydedildi/);assert.match(message,/ön puan 42\/100/);assert.match(message,/Genel AI görünürlük ölçümü değildir/);assert.doesNotMatch(message,/private detail/);assert.match(scanCompletionMessage({}),/ön puanı —/);
});
