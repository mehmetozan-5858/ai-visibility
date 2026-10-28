import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuditPreviewHandler} from '../lib/audit-preview-handler.mjs';

// All sessions and requests are synthetic; no credentials, real database or network.
const origin='http://127.0.0.1:23456';
const request=()=>new Request(origin+'/api/client-audit-preview',{
 method:'POST',headers:{origin,host:new URL(origin).host,'content-type':'application/json'},
 body:JSON.stringify({requestId:'early-actor-fixture'})
});

for(const [name,session] of [
 ['tenant-only signed session',{clientId:'tenant1',exp:4102444800}],
 ['missing actor',{clientId:'tenant1',verified:true}],
 ['unverified actor',{clientId:'tenant1',actorId:'actor1'}],
 ['explicitly unverified actor',{clientId:'tenant1',actorId:'actor1',verified:false}],
 ['invalid actor',{clientId:'tenant1',actorId:'../actor',verified:true}],
 ['invalid tenant',{clientId:'../tenant',actorId:'actor1',verified:true}],
]){
 test(`audit HTTP handler denies ${name} before customer or storage reads`,async()=>{
  const touched=[];
  const forbidden=label=>()=>{touched.push(label);throw Error('unexpected '+label);};
  const handler=createAuditPreviewHandler({
   getSession:async()=>session,
   getSettings:()=>({ARGE_REPORT_PREVIEW_ENABLED:'true',ARGE_AUDIT_SERVICE_ENABLED:'true'}),
   getClientAccount:forbidden('customer'),
   customerAccess:forbidden('access'),
   getDatabaseUrl:forbidden('database-url'),
   databasePool:forbidden('database-pool'),
  });
  const response=await handler(request());
  assert.equal(response.status,403);
  assert.deepEqual(await response.json(),{error:'invalid-session-or-request'});
  assert.deepEqual(touched,[]);
  assert.match(response.headers.get('cache-control'),/no-store/);
 });
}

test('missing session retains 401 without downstream reads',async()=>{
 const handler=createAuditPreviewHandler({
  getSession:async()=>null,
  getSettings:()=>{throw Error('unexpected settings read');},
  getClientAccount:()=>{throw Error('unexpected account read');},
  customerAccess:()=>{throw Error('unexpected access read');},
  getDatabaseUrl:()=>{throw Error('unexpected database-url read');},
  databasePool:()=>{throw Error('unexpected pool read');},
 });
 const response=await handler(request());
 assert.equal(response.status,401);
 assert.deepEqual(await response.json(),{error:'session-required'});
});
