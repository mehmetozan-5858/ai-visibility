import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../app/api/client-auth/login/route.js',import.meta.url),'utf8'))
 .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
function fixture({credential=true,limit=false,origin=false,throwAuth=false}={}){
 let checks=0,tokens=0;
 const deps={
  verifyClientCredential:async()=>{checks++;if(throwAuth)throw Error('synthetic db fault');return credential?{clientId:'fixture-tenant'}:null;},
  createClientToken:async()=>{tokens++;return 'synthetic-session';},
  checkRateLimit:()=>limit?new Response(null,{status:429}):null,
  clearRateLimit:()=>{},
  enforceSameOrigin:()=>origin?new Response(null,{status:403}):null,
  resolveRequestLanguage:()=> 'tr'
 };
 const api=new Function(...Object.keys(deps),source+'; return {POST,DELETE};')(...Object.values(deps));
 return {...api,counts:()=>({checks,tokens})};
}
const req=()=>new Request('https://example.invalid/api/client-auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'test@example.invalid',password:'synthetic-only'})});
function privateResponse(r){
 assert.match(r.headers.get('cache-control')||'',/private.*no-store/);
 assert.equal(r.headers.get('pragma'),'no-cache');
 assert.match(r.headers.get('vary')||'',/Cookie/);
}
test('client login success and logout are private, uncached, preserve secure HttpOnly cookie',async()=>{
 const f=fixture();
 const success=await f.POST(req());
 assert.equal(success.status,200);privateResponse(success);
 assert.match(success.headers.get('set-cookie')||'',/HttpOnly; Secure; SameSite=Strict/);
 assert.equal(f.counts().tokens,1);
 const logout=await f.DELETE(new Request('https://example.invalid/api/client-auth/login',{method:'DELETE'}));
 assert.equal(logout.status,200);privateResponse(logout);
 assert.match(logout.headers.get('set-cookie')||'',/Max-Age=0/);
});
test('client login invalid password and storage failures never cache sensitive auth outcomes',async()=>{
 const invalid=fixture({credential:false});
 const denied=await invalid.POST(req());assert.equal(denied.status,401);privateResponse(denied);
 assert.equal(invalid.counts().tokens,0);
 const fault=fixture({throwAuth:true});
 const failure=await fault.POST(req());assert.equal(failure.status,500);privateResponse(failure);
 assert.equal(fault.counts().tokens,0);
});
test('same-origin and rate limiting still short circuit before credential verification',async()=>{
 for(const config of [{origin:true},{limit:true}]){
  const f=fixture(config);
  assert.ok([403,429].includes((await f.POST(req())).status));
  assert.deepEqual(f.counts(),{checks:0,tokens:0});
 }
});
