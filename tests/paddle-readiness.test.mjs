import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {paddleLiveReadiness} from '../lib/paddle-readiness.js';

const approved={VERCEL_ENV:'production',PADDLE_LIVE_API_KEY:'fixture-key',NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN:'fixture-public',PADDLE_LIVE_WEBHOOK_SECRET:'fixture-webhook',PADDLE_LIVE_SELLER_APPROVED:'true',PADDLE_LIVE_APPROVED_DOMAINS:'["www.example.invalid"]'};
const readiness=(env=approved,origin='https://www.example.invalid',service='business-diagnosis')=>paddleLiveReadiness({env,origin,service});

test('keys alone never establish live checkout readiness',()=>{
 const env={...approved};delete env.PADDLE_LIVE_SELLER_APPROVED;delete env.PADDLE_LIVE_APPROVED_DOMAINS;
 const result=readiness(env);assert.equal(result.configured,true);assert.equal(result.ready,false);
 for(const key of Object.keys(approved))assert.equal(readiness({...approved,[key]:undefined}).ready,false,key);
 for(const flag of ['false','TRUE','1',true,1])assert.equal(readiness({...approved,PADDLE_LIVE_SELLER_APPROVED:flag}).ready,false);
 assert.equal(readiness().ready,true);
});
test('software plans are eligible; manual solution, pilot and unbound links are blocked',()=>{
 assert.equal(readiness(approved,undefined,'business-monitoring').ready,true);
 for(const service of ['business-solution','pilot-diagnosis','',null,undefined,'business-diagnosis-extra'])assert.equal(paddleLiveReadiness({env:approved,origin:'https://www.example.invalid',service}).ready,false,String(service));
});
test('approved domains are exact, HTTPS only and fail closed on malformed configuration',()=>{
 for(const origin of ['https://example.invalid','https://sub.www.example.invalid','http://www.example.invalid','https://www.example.invalid.evil.test','https://user:password@www.example.invalid','https://www.example.invalid:8443','invalid',null])assert.equal(readiness(approved,origin).ready,false,String(origin));
 for(const domains of ['broken','null','{}','"www.example.invalid"','["*.example.invalid"]','["https://www.example.invalid"]','["www.example.invalid",12]','["www.example.invalid",""]'])assert.equal(readiness({...approved,PADDLE_LIVE_APPROVED_DOMAINS:domains}).ready,false,domains);
 for(const target of ['preview','development',undefined])assert.equal(readiness({...approved,VERCEL_ENV:target}).ready,false);
});

function checkoutRoute(env){
 const source=fs.readFileSync(new URL('../app/api/payment/paddle/route.js',import.meta.url),'utf8').replace(/^import .*;\s*$/mg,'').replace('export async function POST','async function POST');
 const calls={profile:0,payment:0,provider:0,consent:0};
 const dependencies={
  verifyPaymentAccessToken:async()=>({clientId:'fixture-customer',service:'business-diagnosis'}),
  getClientProfile:async()=>{calls.profile++;return {country:'United States'}},
  getOrCreatePaymentIntent:async()=>{calls.payment++;return {id:'fixture-payment',status:'pending'}},
  recordPaymentConsent:async()=>{calls.consent++},
  servicePrice:()=>({code:'business-diagnosis',name:'Fixture',setupAmount:129,monthlyAmount:0,currency:'USD'}),
  PADDLE_SERVICE_CODES:['business-diagnosis','business-monitoring'],paymentMatchesPlan:()=>true,
  checkRateLimit:()=>null,enforceSameOrigin:()=>null,
  buildPaddleTransactionPayload:()=>({fixture:true}),
  createPaddleLiveTransaction:async()=>{calls.provider++;return {transactionId:'fixture-transaction',status:'draft'}},
  paddleLiveReadiness:args=>paddleLiveReadiness({...args,env}),
  process:{env},
 };
 const route=new Function(...Object.keys(dependencies),source+';return POST')(...Object.values(dependencies));
 return {route,calls};
}
test('direct authenticated POST cannot create local or provider records while approvals are absent',async()=>{
 for(const changes of [{PADDLE_LIVE_SELLER_APPROVED:undefined},{PADDLE_LIVE_APPROVED_DOMAINS:'[]'},{PADDLE_LIVE_WEBHOOK_SECRET:undefined},{VERCEL_ENV:'preview'}]){
  const {route,calls}=checkoutRoute({...approved,...changes});
  const response=await route(new Request('https://www.example.invalid/api/payment/paddle',{method:'POST',body:JSON.stringify({token:'fixture-token',consent:true})}));
  assert.equal(response.status,503);assert.equal((await response.json()).code,'paddle-unavailable');assert.deepEqual(calls,{profile:0,payment:0,provider:0,consent:0});
 }
});
test('eligible approved checkout preserves the existing payment/consent path with mocked writes',async()=>{
 const {route,calls}=checkoutRoute(approved);
 const response=await route(new Request('https://www.example.invalid/api/payment/paddle',{method:'POST',body:JSON.stringify({token:'fixture-token',consent:true})}));
 assert.equal(response.status,200);assert.deepEqual(calls,{profile:1,payment:1,provider:1,consent:1});
});
