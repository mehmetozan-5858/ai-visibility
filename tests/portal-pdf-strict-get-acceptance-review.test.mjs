import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Review-only: execute the real PDF GET source with synthetic dependencies.
// No customer cookies, Neon access, PDF delivery, payments or live mutation.
const source=(await readFile(new URL('../app/api/client-portal/report/route.js',import.meta.url),'utf8'))
 .replace(/^import .*;$/gm,'').replace(/export /g,'');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const names=['cookies','verifyClientToken','getClientAccount','customerAccess',
 'databasePool','getDatabaseUrl','getPortalReadDatabaseUrl','portalReadDatabaseEnabled',
 'withVerifiedClientTenantRead','inspectPortalReaderPrivileges','inspectComparisonRlsPolicy',
 'strictReportEntitlementReady','strictCustomerSettlementEnabled',
 'readCustomerComparisonReport','buildReportResponse'];
function fixture({session=true,allowed=true,entitled=true,reader=true,
 privileges=true,rls=true,readError=false,foreign=false}={}){
 const calls={legacy:0,secured:0,pdf:0,reader:0};
 const deps={
  cookies:async()=>({get:()=>({value:'synthetic-session-cookie'})}),
  verifyClientToken:async()=>session?{clientId:A}:null,
  getClientAccount:async()=>({client:{id:A},scans:[
   {id:'synthetic-unverified-legacy-scan',clientId:A,status:'completed',
    score:98,results:[{summary:'Synthetic unverified legacy data'}]}
  ]}),
  customerAccess:async()=>({allowed,kind:'pilot'}),
  databasePool:url=>{if(url==='legacy'){calls.legacy++;return {kind:'legacy'}}calls.reader++;return {kind:'reader'}},
  getDatabaseUrl:()=> 'legacy',
  getPortalReadDatabaseUrl:()=> 'reader',
  portalReadDatabaseEnabled:()=>reader,
  withVerifiedClientTenantRead:async(pool,cookie,callback)=>{
   assert.equal(pool.kind,'reader');
   assert.equal(cookie,'synthetic-session-cookie');
   return callback(pool,A);
  },
  inspectPortalReaderPrivileges:async()=>({ready:privileges}),
  inspectComparisonRlsPolicy:async()=>({ready:rls}),
  strictReportEntitlementReady:()=>entitled,
  strictCustomerSettlementEnabled:()=>false,
  readCustomerComparisonReport:async(pool,tenant)=>{
   calls.secured++;
   assert.equal(tenant,A);
   if(readError)throw Error('synthetic-reader-denied');
   return [{clientId:foreign?B:A,query:'synthetic historical response',results:[]}];
  },
  buildReportResponse:async data=>{
   calls.pdf++;
   return new Response(JSON.stringify(data),{headers:{'content-disposition':'attachment; filename="report.pdf"'}});
  }
 };
 const get=new Function(...names,source+';return GET')(...names.map(n=>deps[n]));
 return {get,calls};
}
async function run(options){
 const old=process.env.PORTAL_TENANT_RLS_ENABLED;
 process.env.PORTAL_TENANT_RLS_ENABLED='true';
 try{
  const f=fixture(options);
  const response=await f.get(new Request('https://example.test/api/client-portal/report?download=1'));
  return {f,response};
 }finally{
  if(old===undefined)delete process.env.PORTAL_TENANT_RLS_ENABLED;
  else process.env.PORTAL_TENANT_RLS_ENABLED=old;
 }
}
test('PDF strict gate fails closed for missing session, access, role, RLS and reader error',async()=>{
 for(const [options,status] of [
  [{session:false},401],[{allowed:false},403],[{entitled:false},503],
  [{reader:false},503],[{privileges:false},503],[{rls:false},503],
  [{readError:true},503]
 ]){
  const {response,f}=await run(options);
  assert.equal(response.status,status);
  assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.equal(f.calls.legacy,0,'must never fall back to writer credentials');
  assert.equal(f.calls.pdf,0,'denied state must not generate a customer PDF');
 }
});
test('valid strict PDF uses only verified tenant reader and non-cacheable response',async()=>{
 const {response,f}=await run({});
 assert.equal(response.status,200);
 assert.equal(f.calls.legacy,0);
 assert.equal(f.calls.secured,1);
 assert.equal(f.calls.pdf,1);
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 const body=await response.json();
 assert.equal(body.clientId,A);
 assert.deepEqual(body.comparisons.map(x=>x.clientId),[A]);
 assert.deepEqual(body.allScans,[],
  'strict PDF must not package scans sourced from unreviewed broad-reader account lookup');
});

test('foreign tenant comparison rejects PDF even after narrow-reader success',async()=>{
 const {response,f}=await run({foreign:true});
 assert.equal(response.status,503);
 assert.equal(f.calls.secured,1);
 assert.equal(f.calls.legacy,0);
 assert.equal(f.calls.pdf,0,'foreign tenant data must never be rendered');
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
});
