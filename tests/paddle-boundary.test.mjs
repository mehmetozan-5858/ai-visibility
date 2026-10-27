import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../proxy.js',import.meta.url),'utf8').replace(/^import .*;\s*$/mg,'').replaceAll('export ','');
class NextResponse extends Response{static next(){return new Response('next')}static redirect(){return new Response(null,{status:307})}}
let authCalls=0;
const proxy=new Function('NextResponse','verifyAdminToken','verifyClientToken','authConfigured',source+';return proxy')(NextResponse,async()=>{authCalls++;return true},async()=>{authCalls++;return true},()=>true);
const req=pathname=>({method:'GET',nextUrl:{pathname},headers:new Headers({authorization:'Bearer scheduler-fixture'}),cookies:{get:()=>({value:'valid-fixture'})}});
test('sandbox preview blocks client, lead and scheduler routes even with valid credentials',async()=>{
 const keys=['VERCEL_ENV','PADDLE_ENVIRONMENT','PADDLE_SANDBOX_ENABLED','CRON_SECRET'];const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{Object.assign(process.env,{VERCEL_ENV:'preview',PADDLE_ENVIRONMENT:'sandbox',PADDLE_SANDBOX_ENABLED:'true',CRON_SECRET:'scheduler-fixture'});
  for(const path of ['/api/clients','/api/leads','/api/payment','/api/free-assessment','/api/cron/daily-cycle','/admin','/musteri-panel','/'])assert.equal((await proxy(req(path))).status,404,path);
  assert.equal(authCalls,0);for(const path of ['/paddle-checkout','/paddle-sandbox','/api/webhooks/paddle-sandbox','/api/paddle-sandbox/checkout-intents','/api/paddle-sandbox/account','/api/paddle-sandbox/test-session'])assert.equal(await (await proxy(req(path))).text(),'next');
  process.env.VERCEL_ENV='production';for(const path of ['/paddle-sandbox','/api/paddle-sandbox/checkout-intents','/api/paddle-sandbox/account','/api/paddle-sandbox/test-session'])assert.equal((await proxy(req(path))).status,404);assert.equal(await (await proxy(req('/'))).text(),'next');
 }finally{for(const k of keys){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}}
});
