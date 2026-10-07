import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {systemHealthSnapshot,readSystemHealthSnapshot} from '../lib/system-health-rules.js';
const now='2026-10-07T12:00:00Z';
const row={componentKey:'agent',expectedIntervalMinutes:60,lastStatus:'healthy',lastSuccessAt:'2026-10-07T10:00:00Z'};
test('health states are exclusive and respect the exact delay boundary',()=>{
 const rows=[row,{...row,componentKey:'late',lastSuccessAt:'2026-10-07T09:59:59Z'},{...row,componentKey:'failed',lastStatus:'failed'},{...row,componentKey:'critical',severity:'critical'},{...row,componentKey:'quarantine',severity:'critical',quarantineUntil:'2026-10-07T13:00:00Z'},{...row,componentKey:'unknown',lastSuccessAt:null}];
 const d=systemHealthSnapshot(rows,now);assert.deepEqual(d.counts,{healthy:1,warning:1,delayed:1,critical:1,quarantined:1,unknown:1});assert.equal(Object.values(d.counts).reduce((a,b)=>a+b),rows.length);assert.equal(readSystemHealthSnapshot(d),d);
});
test('missing, invalid and future success timestamps or intervals remain unknown',()=>{
 for(const change of [{lastSuccessAt:null},{lastSuccessAt:'invalid'},{lastSuccessAt:'2026-10-08T12:00:00Z'},{expectedIntervalMinutes:0},{expectedIntervalMinutes:null},{expectedIntervalMinutes:'invalid'}])assert.equal(systemHealthSnapshot([{...row,...change}],now).components[0].state,'unknown');
 assert.throws(()=>systemHealthSnapshot(null,now));assert.throws(()=>systemHealthSnapshot([], 'invalid'));
});
test('client rejects malformed snapshots instead of showing zero counts',()=>{
 const d=systemHealthSnapshot([row],now);for(const change of [{counts:{}},{generatedAt:'invalid'},{components:[{...row,state:'online'}]},{counts:{...d.counts,warning:1}}])assert.throws(()=>readSystemHealthSnapshot({...d,...change}));
});
async function route(path,deps){const source=(await readFile(new URL(path,import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');return new Function(...Object.keys(deps),source+';return GET;')(...Object.values(deps));}
test('both management APIs deny anonymous access before reading data',async()=>{
 for(const path of ['../app/api/system-health-map/route.js','../app/api/decision-audit/route.js']){let reads=0;const read=()=>{reads++;throw Error('must not read')};const GET=await route(path,{requireAdmin:async()=>Response.json({error:'auth'},{status:401}),getDatabaseUrl:read,listSystemWatchdog:read,listDecisionAudit:read,systemHealthSnapshot});assert.equal((await GET(new Request('https://example.com/api'))).status,401);assert.equal(reads,0);}
});
test('health source failures are unavailable and never leak connection errors',async()=>{
 for(const configured of [false,true]){let reads=0;const GET=await route('../app/api/system-health-map/route.js',{requireAdmin:async()=>null,getDatabaseUrl:()=>configured?'configured':null,listSystemWatchdog:async()=>{reads++;throw Error('secret connection string')},systemHealthSnapshot});const r=await GET({});assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');const d=await r.json();assert.equal(d.counts,undefined);assert.doesNotMatch(JSON.stringify(d),/secret/);assert.equal(reads,configured?1:0);}
});
test('authenticated health and audit sources return their actual records',async()=>{
 const GET=await route('../app/api/system-health-map/route.js',{requireAdmin:async()=>null,getDatabaseUrl:()=>true,listSystemWatchdog:async()=>[],systemHealthSnapshot});const r=await GET({});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual((await r.json()).counts,{healthy:0,warning:0,delayed:0,critical:0,quarantined:0,unknown:0});
 let limit;const audit=await route('../app/api/decision-audit/route.js',{requireAdmin:async()=>null,listDecisionAudit:async n=>{limit=n;return [{id:1}]}});assert.deepEqual((await (await audit(new Request('https://example.com/api?limit=20'))).json()).items,[{id:1}]);assert.equal(limit,20);
});
