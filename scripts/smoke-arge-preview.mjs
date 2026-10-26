/** Local production-server security smoke. No real DB, provider keys or customers. */
import {spawn} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const secret=randomBytes(32).toString('hex');
const exp=Math.floor(Date.now()/1000)+3600;
const value=`client.tenant1.${exp}`;
const token=value+'.'+createHmac('sha256',secret).update(value).digest('base64url');
const adminToken=exp+'.'+createHmac('sha256',secret).update(String(exp)).digest('base64url');
let assertions=0;
async function scenario(enabled){
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
 const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const origin=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  stdio:'ignore',env:{PATH:process.env.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',
   AUTH_SECRET:secret,ADMIN_PASSWORD:randomBytes(24).toString('hex'),
   ARGE_REPORT_PREVIEW_ENABLED:String(enabled),ARGE_AUDIT_SERVICE_ENABLED:String(enabled),
   VERCEL_ENV:'production',ZERA_SINGLE_SCAN_ENABLED:'true',ZERA_GEMINI_FREE_TIER_CONFIRMED:'true',
   GEMINI_API_KEY:'local-test-only-not-a-provider-credential'}});
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   try{const r=await fetch(origin+'/robots.txt',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(ready,'local production server did not start');
  const call=(path,body={},cookie=token,extra={})=>fetch(origin+path,{method:'POST',
   headers:{origin,'content-type':'application/json',...(cookie?{cookie:'ai_client='+cookie}:{}),...extra},body:JSON.stringify(body)});
  let r=await call('/api/client-audit-preview',{},null);assert.equal(r.status,401);assertions++;
  r=await call('/api/client-audit-preview',{},token+'tampered');assert.equal(r.status,401);assertions++;
  r=await call('/api/clients');assert.equal(r.status,401);assertions++;
  r=await call('/api/client-audit-preview-extra');assert.equal(r.status,401);assertions++;
  if(!enabled){
   r=await call('/api/client-audit-preview',{requestId:'request1'});assert.equal(r.status,403);
   assert.equal((await r.json()).error,'preview-disabled');assert.match(r.headers.get('cache-control'),/no-store/);assertions++;
  }else{
   r=await call('/api/client-audit-preview',{requestId:'request1'},token,{origin:'https://other.invalid'});
   assert.equal(r.status,403);assert.equal((await r.json()).error,'invalid-origin-or-content-type');assertions++;
   r=await call('/api/client-audit-preview',{requestId:'request1',tenantId:'other'});assert.equal(r.status,400);assertions++;
   r=await call('/api/client-audit-preview',{requestId:'x'.repeat(3000)});assert.equal(r.status,413);assertions++;
   for(const path of ['/api/clients/zera-ai-runner','/api/clients/zera-single-scan']){
    r=await fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',cookie:'ai_admin='+adminToken},body:'{}'});
    assert.equal(r.status,409);assert.match((await r.json()).error,/paused/);assertions++;
   }
   r=await fetch(origin+'/api/clients/zera-scan-readiness',{headers:{cookie:'ai_admin='+adminToken}});
   assert.equal(r.status,200);const readiness=await r.json();assert.equal(readiness.ready,false);
   assert.equal(readiness.scanStarted,false);assert.equal(readiness.customerReadiness,'not-checked');assertions++;
   r=await fetch(origin+'/api/client-provider-results');assert.equal(r.status,401);assertions++;
   r=await fetch(origin+'/api/client-provider-results?clientId=other',{headers:{cookie:'ai_client='+token}});
   assert.equal(r.status,400);assert.equal((await r.json()).error,'customer-selectors-not-accepted');assertions++;
   r=await fetch(origin+'/api/client-provider-results',{headers:{cookie:'ai_admin='+adminToken}});
   assert.equal(r.status,401);assertions++;
  }
 }finally{server.kill('SIGTERM');await once(server,'exit');}
}
await scenario(false);await scenario(true);
console.log(JSON.stringify({ok:true,assertions,scope:'local-production-auth-and-request-boundaries',liveAcceptance:false}));
