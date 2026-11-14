import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const loginSource=(await readFile(new URL('../app/api/client-auth/login/route.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
const portalSource=(await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
const clientId='22222222-2222-4222-8222-222222222222';
test('synthetic existing-password login rejects failures and issues secure cookie without resetting password',async()=>{
 let authorized=0,created=0,cleared=0;
 const deps={
  verifyClientCredential:async(email,password)=>{authorized++;return email==='existing@example.invalid'&&password==='original-passphrase'?{clientId,email}:null;},
  createClientToken:async(id)=>{assert.equal(id,clientId);created++;return 'synthetic-session';},
  checkRateLimit:()=>null,clearRateLimit:()=>{cleared++},enforceSameOrigin:()=>null,resolveRequestLanguage:()=> 'tr'
 };
 const {POST,DELETE}=new Function(...Object.keys(deps),loginSource+'\nreturn {POST,DELETE};')(...Object.values(deps));
 const req=(password)=>new Request('https://example.invalid/api/client-auth/login',{method:'POST',body:JSON.stringify({email:'existing@example.invalid',password})});
 const failed=await POST(req('incorrect'));assert.equal(failed.status,401);assert.equal(created,0);assert.equal(cleared,0);
 const success=await POST(req('original-passphrase'));assert.equal(success.status,200);
 const cookie=success.headers.get('set-cookie')||'';
 for(const value of ['ai_client=synthetic-session','HttpOnly','Secure','SameSite=Strict'])assert.ok(cookie.includes(value),value);
 assert.equal(created,1);assert.equal(cleared,1);assert.equal(authorized,2);
 const logout=await DELETE(new Request('https://example.invalid/api/client-auth/login',{method:'DELETE'}));
 assert.match(logout.headers.get('set-cookie')||'',/Max-Age=0/);
 assert.doesNotMatch(loginSource,/resetClientPassword|createClientCredential|password_hash\s*=/);
});
test('valid session cannot retrieve tenant report unless server customerAccess allows it',async()=>{
 let reportQueries=0;
 const deps={
  readCustomerComparisonReport:async()=>{reportQueries++;return []},
  databasePool:()=>({}),getDatabaseUrl:()=>'',customerAccess:async()=>({allowed:false}),
  cookies:async()=>({get:()=>({value:'existing-session'})}),
  verifyClientToken:async()=>({clientId}),
  getClientAccount:async(id)=>({client:{id,status:'active'},payments:[]}),
  resolveRequestLanguage:()=> 'tr',getClientProfile:async()=>null,
  servicePrice:()=>null,formatMoney:()=>'',SERVICE_CODES:[]
 };
 const {GET}=new Function(...Object.keys(deps),portalSource+'\nreturn {GET};')(...Object.values(deps));
 const response=await GET(new Request('https://example.invalid/api/client-portal'));
 assert.equal(response.status,403);
 assert.equal(reportQueries,0);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
});
test('invalid customer session rejects before account or report lookup',async()=>{
 let accountLoads=0;
 const deps={
  readCustomerComparisonReport:async()=>{throw Error('must-not-read')},
  databasePool:()=>({}),getDatabaseUrl:()=>'',customerAccess:async()=>{throw Error('must-not-check')},
  cookies:async()=>({get:()=>undefined}),verifyClientToken:async()=>null,
  getClientAccount:async()=>{accountLoads++;return null},resolveRequestLanguage:()=> 'tr',
  getClientProfile:async()=>null,servicePrice:()=>null,formatMoney:()=>'',SERVICE_CODES:[]
 };
 const {GET}=new Function(...Object.keys(deps),portalSource+'\nreturn {GET};')(...Object.values(deps));
 assert.equal((await GET(new Request('https://example.invalid/api/client-portal'))).status,401);
 assert.equal(accountLoads,0);
});

test('successful synthetic customer portal session reads only its own tenant and independently approved access',async()=>{
 const requested=[],reported=[],profileReads=[],clientId='22222222-2222-4222-8222-222222222222';
 const deps={
  readCustomerComparisonReport:async(_pool,id)=>{reported.push(id);return [{kind:'synthetic'}]},
  databasePool:()=>({}),getDatabaseUrl:()=>'synthetic-db',
  customerAccess:async(account)=>{assert.equal(account.client.id,clientId);return {allowed:true,kind:'pilot',expiresAt:'2099-01-01'}},
  cookies:async()=>({get:()=>({value:'synthetic-valid-session'})}),
  verifyClientToken:async token=>{assert.equal(token,'synthetic-valid-session');return {clientId}},
  getClientAccount:async id=>{requested.push(id);return {client:{id,status:'active'},payments:[],scans:[]}},
  resolveRequestLanguage:()=> 'tr',getClientProfile:async id=>{profileReads.push(id);return {country:'TR',requestedService:''}},
  servicePrice:()=>null,formatMoney:()=>'',SERVICE_CODES:[]
 };
 const {GET}=new Function(...Object.keys(deps),portalSource+'\nreturn {GET};')(...Object.values(deps));
 const req=new Request('https://example.invalid/api/client-portal?clientId=44444444-4444-4444-8444-444444444444');
 const response=await GET(req),json=await response.json();
 assert.equal(response.status,200);
 assert.equal(json.account.client.id,clientId);
 assert.equal(json.account.access.kind,'pilot');
 assert.deepEqual(requested,[clientId]);
 assert.deepEqual(reported,[clientId]);
 assert.deepEqual(profileReads,[clientId]);
 assert.deepEqual(json.account.reportEvidence,{available:true,comparisonCount:1});
 assert.match(response.headers.get('cache-control'),/private.*no-store/);
 assert.match(response.headers.get('vary'),/Cookie/);
});
test('report storage errors are not presented as successful report evidence',async()=>{
 const deps={
  readCustomerComparisonReport:async()=>{throw Error('sensitive-storage-failure')},
  databasePool:()=>({}),getDatabaseUrl:()=>'synthetic-db',
  customerAccess:async()=>({allowed:true,kind:'paid'}),
  cookies:async()=>({get:()=>({value:'session'})}),
  verifyClientToken:async()=>({clientId:'22222222-2222-4222-8222-222222222222'}),
  getClientAccount:async id=>({client:{id,status:'active'},payments:[]}),
  resolveRequestLanguage:()=> 'tr',getClientProfile:async()=>null,
  servicePrice:()=>null,formatMoney:()=>'',SERVICE_CODES:[]
 };
 const {GET}=new Function(...Object.keys(deps),portalSource+'\nreturn {GET};')(...Object.values(deps));
 const response=await GET(new Request('https://example.invalid/api/client-portal'));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.deepEqual(data.account.reportEvidence,{available:false,comparisonCount:0});
 assert.doesNotMatch(JSON.stringify(data),/sensitive-storage-failure/);
});
