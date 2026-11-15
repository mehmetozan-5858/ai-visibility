import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {comparisonReportRows} from '../lib/customer-comparison-report.mjs';

// REVIEW ONLY: import the actual production GET body with injected synthetic
// collaborators; no Next.js runtime, real cookie, provider, Neon or DB writes.
const source=(await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8'))
 .replace(/^import .*;$/gm,'').replace(/export /g,'');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const dependencies=[
 'cookies','verifyClientToken','getClientAccount','customerAccess','getClientProfile',
 'resolveRequestLanguage','SERVICE_CODES','servicePrice','formatMoney',
 'readCustomerComparisonReport','databasePool','getDatabaseUrl',
 'withVerifiedClientTenantRead','inspectPortalReaderPrivileges',
 'inspectComparisonRlsPolicy','strictReportEntitlementReady',
 'strictCustomerSettlementEnabled','portalReadDatabaseEnabled','getPortalReadDatabaseUrl'
];
function fixture({entitlementReady=true,readerEnabled=true,roleReady=true,
 rlsReady=true,readFails=false,accessAllowed=true}={}){
 const calls={legacy:0,role:0,rls:0,secured:0,reader:0};
 const rows=comparisonReportRows([
  {clientId:A,query:'own historical observation',createdAt:'2026-11-15T10:00:00Z',
   results:[{provider:'gemini',status:'answer-received-unverified',
    answer:'Synthetic historical observation',verified:false}]},
  {clientId:B,query:'foreign tenant secret',createdAt:'2026-11-15T10:00:00Z',
   results:[{provider:'gemini',status:'answer-received-unverified',
    answer:'FOREIGN_SECRET',verified:false}]}
 ],A);
 const methods={
  cookies:async()=>({get:()=>({value:'signed-cookie-fixture'})}),
  verifyClientToken:async()=>({clientId:A}),
  getClientAccount:async()=>({client:{id:A},scans:[]}),
  customerAccess:async()=>({allowed:accessAllowed,kind:'pilot'}),
  getClientProfile:async()=>null,
  resolveRequestLanguage:()=> 'tr',
  SERVICE_CODES:[],
  servicePrice:()=>null,
  formatMoney:()=> '',
  readCustomerComparisonReport:async(_tx,tenant)=>{
   if(_tx?.kind==='legacy'){calls.legacy++;throw Error('must-not-open-legacy-reader')}
   calls.secured++;
   assert.equal(tenant,A);
   if(readFails)throw Error('private-sql-error');
   return rows;
  },
  databasePool:url=>{calls.reader++;return {kind:url==='strict-reader'?'scoped':'legacy'}},
  getDatabaseUrl:()=> 'legacy-reader',
  withVerifiedClientTenantRead:async(pool,cookie,callback)=>{
   assert.equal(pool.kind,'scoped');
   assert.equal(cookie,'signed-cookie-fixture');
   return callback(pool,A);
  },
  inspectPortalReaderPrivileges:async()=>{calls.role++;return {ready:roleReady}},
  inspectComparisonRlsPolicy:async()=>{calls.rls++;return {ready:rlsReady}},
  strictReportEntitlementReady:()=>entitlementReady,
  strictCustomerSettlementEnabled:()=>false,
  portalReadDatabaseEnabled:()=>readerEnabled,
  getPortalReadDatabaseUrl:()=> 'strict-reader'
 };
 const get=new Function(...dependencies,source+';return GET')
  (...dependencies.map(k=>methods[k]));
 return {get,calls};
}
async function strictCase(options,expectedStatus){
 const old=process.env.PORTAL_TENANT_RLS_ENABLED;
 process.env.PORTAL_TENANT_RLS_ENABLED='true';
 try{
  const f=fixture(options);
  const r=await f.get(new Request('https://example.test/api/client-portal?clientId='+B));
  assert.equal(r.status,expectedStatus);
  assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');
  assert.equal(f.calls.legacy,0,'strict failures must not downgrade to shared reader');
  return {response:await r.json(),calls:f.calls};
 }finally{
  if(old===undefined)delete process.env.PORTAL_TENANT_RLS_ENABLED;
  else process.env.PORTAL_TENANT_RLS_ENABLED=old;
 }
}
test('strict customer portal cannot downgrade when independent security gates fail',async()=>{
 const cases=[
  [{entitlementReady:false},0,0],
  [{readerEnabled:false},0,0],
  [{roleReady:false},1,0],
  [{rlsReady:false},1,1],
  [{readFails:true},1,1]
 ];
 for(const [options,role,rls] of cases){
  const {response,calls}=await strictCase(options,503);
  assert.ok(response.error);
  assert.equal(calls.role,role);
  assert.equal(calls.rls,rls);
  assert.equal(calls.legacy,0);
 }
});
test('strict route returns only tenant-scoped historical preview, never live AI verification',async()=>{
 const {response,calls}=await strictCase({},200);
 assert.equal(calls.secured,1);
 assert.equal(calls.legacy,0);
 assert.deepEqual(response.account.reportEvidence,{
  available:true,comparisonCount:1,evidenceClass:'historical',
  verifiedProviderEvidence:false
 });
 assert.equal(response.reportPreview.evidenceClass,'historical');
 assert.equal(response.reportPreview.verifiedProviderEvidence,false);
 assert.deepEqual(response.reportPreview.reports.map(row=>row.clientId),[A]);
 assert.doesNotMatch(JSON.stringify(response),/FOREIGN_SECRET/);
 assert.equal(response.reportPreview.reports[0].results[0].verified,false);
});
test('inactive customer cannot reach dedicated report reader',async()=>{
 const {response,calls}=await strictCase({accessAllowed:false},403);
 assert.ok(response.error);
 assert.equal(calls.reader,0);
 assert.equal(calls.secured,0);
 assert.equal(calls.legacy,0);
});
