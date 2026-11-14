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
