import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const findings=await fs.readFile(new URL('../lib/findings.js',import.meta.url),'utf8');
const requestSource=findings.slice(findings.indexOf('export async function requestSolution('),findings.indexOf('export async function updateFindingOffer')).replace('export ','');
function fixture({findingStatus='open',offerStatus='draft',missing=false,failOffer=false}={}){
 const calls=[];const tx={release(){calls.push('release')},async query(sql,a){calls.push(sql);if(sql.startsWith('SELECT id,status FROM findings')){assert.deepEqual(a,['finding','own-client']);return {rows:missing?[]:[{id:'finding',status:findingStatus}]}}if(sql.startsWith('SELECT id,status FROM solution_offers'))return {rows:[{id:'offer',status:offerStatus}]};if(sql.startsWith('UPDATE solution_offers')&&failOffer)throw Error('offer-failed');return {rows:[]}}};
 return {calls,request:new Function('withDb',requestSource+';return requestSolution')(fn=>fn({connect:async()=>tx}))};
}
test('solution requests update together and roll back when the offer update fails',async()=>{const a=fixture();assert.equal((await a.request('own-client','finding')).requested,true);assert.ok(a.calls.includes('COMMIT'));const b=fixture({failOffer:true});await assert.rejects(b.request('own-client','finding'),/offer-failed/);assert.ok(b.calls.includes('ROLLBACK'));assert.ok(!b.calls.includes('COMMIT'));assert.equal(b.calls.at(-1),'release')});
test('foreign or missing findings cannot change; repeated requests never rewind completed or paid work',async()=>{const a=fixture({missing:true});assert.equal(await a.request('own-client','finding'),null);for(const opts of [{findingStatus:'resolved'},{findingStatus:'in-progress'},{offerStatus:'paid'},{offerStatus:'completed'},{offerStatus:'accepted'},{offerStatus:'cancelled'}]){const f=fixture(opts);assert.equal((await f.request('own-client','finding')).unchanged,true);assert.ok(!f.calls.some(x=>x.startsWith('UPDATE')))}const repeat=fixture({findingStatus:'requested',offerStatus:'requested'});await repeat.request('own-client','finding');assert.ok(!repeat.calls.some(x=>x.startsWith('UPDATE')))});
const routeSource=(await fs.readFile(new URL('../app/api/client-portal/solutions/route.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
test('free pilot can read findings but cannot initiate implementation through API',async()=>{
 let writes=0;const api=new Function('customerAccess','cookies','verifyClientToken','listFindingsForClient','requestSolution','syncFindingsFromScan','getLatestCompletedScan','getClientAccount','resolveRequestLanguage','enforceSameOrigin','checkRateLimit',routeSource+';return {GET,POST}')(async()=>({allowed:true,kind:'pilot'}),async()=>({get:()=>({value:'session'})}),async()=>({clientId:'own-client'}),async()=>[{id:'finding'}],async()=>{writes++},async()=>{},async()=>null,async()=>({client:{id:'own-client'}}),()=> 'tr',()=>null,()=>null);
 assert.equal((await api.GET(new Request('https://example.com/api'))).status,200);
 assert.equal((await api.POST(new Request('https://example.com/api',{method:'POST',body:JSON.stringify({findingId:'finding'})}))).status,403);assert.equal(writes,0);
});
const pilotSource=(await fs.readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
test('pilot revocation and its audit commit together; repeats produce no second audit',async()=>{
 for(const mode of ['ok','already-revoked','audit-failure']){
 const calls=[],tx={release(){calls.push('release')},async query(sql){calls.push(sql);if(sql.startsWith('UPDATE client_pilot_access'))return {rows:mode==='already-revoked'?[]:[{expires_at:'2026-11-01'}]};if(sql.startsWith('INSERT INTO client_activity')&&mode==='audit-failure')throw Error('audit-failed');return {rows:[]}}};
 const revoke=new Function('crypto','databasePool','getDatabaseUrl','initializeSchema',pilotSource+';return revokePilot')(crypto,()=>({connect:async()=>tx}),()=> 'db',async()=>{});
 if(mode==='audit-failure'){await assert.rejects(revoke('client'),/audit-failed/);assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'))}else{assert.equal((await revoke('client')).revoked,mode==='ok');assert.ok(calls.includes('COMMIT'));assert.equal(calls.some(x=>x.startsWith('INSERT INTO client_activity')),mode==='ok')}
 assert.equal(calls.at(-1),'release');
 }
});
