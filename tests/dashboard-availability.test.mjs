import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const snapshotSource=(await readFile(new URL('../lib/dashboard-snapshot.js',import.meta.url),'utf8')).replace(/export /g,'');
const {readDashboardSnapshot,measuredScans}=new Function(snapshotSource+';return {readDashboardSnapshot,measuredScans};')();
const values={'/api/dashboard':{summary:{activeClients:0,scansToday:0,approvals:0,mrrByCurrency:[]},providers:[]},'/api/scans':{scans:[]},'/api/status':{auth:{configured:true}}};
const okFetcher=async path=>({ok:true,json:async()=>values[path]});
test('real empty data remains distinct from failed fetches',async()=>{
 const snapshot=await readDashboardSnapshot(okFetcher);assert.equal(snapshot.summary.activeClients,0);assert.equal(snapshot.authReady,true);
 await assert.rejects(readDashboardSnapshot(async()=>({ok:false,status:503})),/dashboard-unavailable/);
 await assert.rejects(readDashboardSnapshot(async()=>({ok:false,status:401})),/dashboard-session-required/);
});
test('partial failures and malformed payloads never become an empty successful dashboard',async()=>{
 await assert.rejects(readDashboardSnapshot(async path=>path==='/api/scans'?{ok:false,status:500}:okFetcher(path)),/dashboard-unavailable/);
 await assert.rejects(readDashboardSnapshot(async()=>({ok:true,json:async()=>({})})),/dashboard-invalid-response/);
 await assert.rejects(readDashboardSnapshot(async()=>({ok:true,json:async()=>{throw Error('html')}})),/dashboard-invalid-response/);
});
test('request cancellation is forwarded to every independent endpoint',async()=>{
 const signal=new AbortController().signal;let calls=0;
 await readDashboardSnapshot(async(path,options)=>{assert.equal(options.signal,signal);assert.equal(options.cache,'no-store');calls++;return okFetcher(path)},signal);assert.equal(calls,3);
});
const route=(await readFile(new URL('../app/api/dashboard/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const handler=getDashboard=>new Function('getDashboard','providerStatus','requireAdmin',route+';return GET;')(getDashboard,()=>[],async()=>null);
test('dashboard API returns sanitized uncached 503 on database failure',async()=>{
 const response=await handler(async()=>{throw Error('secret connection URL')})({});assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(await response.json()).includes('secret'));
});
test('dashboard API reports actual database mode after a successful read',async()=>{
 const response=await handler(async()=>({...values['/api/dashboard'].summary,database:{mode:'production-ready'}}))({});assert.equal(response.status,200);assert.equal((await response.json()).mode,'production-ready');
});
const repository=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
const dashboard=repository.slice(repository.indexOf('export async function getDashboard(){'),repository.indexOf('export async function getClient(')).replace('export ','');
test('missing database configuration never masquerades as zero sales',async()=>{
 const getDashboard=new Function('withDb','databaseStatus','readCommercialMetrics',dashboard+';return getDashboard;')(async()=>null,()=>({configured:false}),async()=>({}));await assert.rejects(getDashboard(),/dashboard-database-unavailable/);
});

test('missing scan scores are not zero measurements, but a measured zero remains valid',()=>{
 assert.deepEqual(measuredScans([null,undefined,'',-1,101,'not-a-score'].map(score=>({status:'completed',score}))),[]);
 assert.equal(measuredScans([{status:'completed',score:0},{status:'queued',score:50}]).length,1);
});
