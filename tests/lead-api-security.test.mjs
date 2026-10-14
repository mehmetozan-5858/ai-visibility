import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const route=(await fs.readFile(new URL('../app/api/leads/route.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
const security=(await fs.readFile(new URL('../lib/api-security.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
const {enforceSameOrigin,checkRateLimit}=new Function('verifyAdminToken',security+';return {enforceSameOrigin,checkRateLimit}')(async()=>true);
function fixture({admin=true,failure=false}={}){
 const calls=[];
 const dependencies={
  createLead:async body=>{calls.push('create');return {id:'lead',status:'new',...body}},
  listLeads:async()=>[{email:'private@example.com'}],
  updateLeadStatus:async()=>{calls.push('status');return {id:'lead',status:'qualified'}},
  getLead:async()=>{calls.push('read');if(failure)throw Error('database postgres://private-secret@host');return {id:'lead-uuid',businessName:'Fixture',website:'https://example.com',email:'fixture@example.com',requestedService:'business-monitoring'}},
  addClient:async()=>{calls.push('client');return {id:'client'}},findClientByIdentity:async()=>null,
  upsertClientProfile:async()=>{calls.push('profile')},
  createPaymentAccessToken:async(id,expires,service)=>{assert.equal(id,'client');assert.equal(service,'business-monitoring');return 'opaque-test-token'},
  verifyAdminToken:async()=>admin,enforceSameOrigin,checkRateLimit
 };
 return {calls,api:new Function(...Object.keys(dependencies),route+';return {POST,GET,PATCH,PUT}')(...Object.values(dependencies))};
}
function request(method,body={},origin='https://example.com',ip=crypto.randomUUID()){
 const req=new Request('https://example.com/api/leads',{method,headers:{host:'example.com',origin,'x-forwarded-for':ip,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 req.cookies={get:()=>({value:'test-session'})};return req;
}
test('admin lead mutations reject foreign origins and missing authorization before storage',async()=>{
 for(const method of ['PATCH','PUT']){
  const f=fixture();assert.equal((await f.api[method](request(method,{},'https://foreign.example'))).status,403);assert.deepEqual(f.calls,[]);
  const denied=fixture({admin:false});assert.equal((await denied.api[method](request(method))).status,401);assert.deepEqual(denied.calls,[]);
 }
});
test('lead conversion preserves service and keeps signed links and private lists out of caches',async()=>{
 const f=fixture();const res=await f.api.PUT(request('PUT',{id:'lead'}));assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual(await res.json(),{ok:true,clientId:'client',service:'business-monitoring',paymentUrl:'/odeme?token=opaque-test-token'});assert.deepEqual(f.calls,['read','client','profile','status']);
 const list=await f.api.GET(request('GET'));assert.equal(list.headers.get('cache-control'),'no-store');
});
test('lead conversion failures never disclose database or provider diagnostics',async()=>{
 const f=fixture({failure:true});const res=await f.api.PUT(request('PUT'));assert.equal(res.status,500);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual(await res.json(),{error:'Başvuru müşteriye dönüştürülemedi.'});assert.deepEqual(f.calls,['read']);
});
test('non-object and malformed requests fail before writes; public lead response is minimal',async()=>{
 for(const method of ['POST','PATCH','PUT'])for(const body of [null,[],true]){const f=fixture();assert.equal((await f.api[method](request(method,body))).status,400);assert.deepEqual(f.calls,[])}
 const f=fixture();const res=await f.api.POST(request('POST',{name:'Fixture',email:'fixture@example.com',businessName:'Business'}));assert.deepEqual(await res.json(),{ok:true,lead:{id:'lead',status:'new'}});
 const bad=request('POST');bad.json=async()=>{throw new SyntaxError('invalid JSON')};assert.equal((await f.api.POST(bad)).status,400);
});
test('repeated admin conversions are throttled before storage',async()=>{
 const f=fixture(),ip=crypto.randomUUID();for(let i=0;i<10;i++)assert.equal((await f.api.PUT(request('PUT',{},'https://example.com',ip))).status,200);
 const before=f.calls.length,res=await f.api.PUT(request('PUT',{},'https://example.com',ip));assert.equal(res.status,429);assert.ok(Number(res.headers.get('retry-after'))>0);assert.equal(f.calls.length,before);
});
