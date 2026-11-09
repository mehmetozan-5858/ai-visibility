import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';

const source=readFileSync(new URL('../app/api/paddle/webhook/route.js',import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'').replace(/export const runtime='nodejs';/,'')
 .replace(/export async function POST/,'async function POST');
const {verifyPaddleLiveSignature}=await import('../lib/paddle-live.js');
const secret='isolated-webhook-fixture-secret';
function makeRoute(){
 let writes=0;
 const post=new Function('verifyPaddleLiveSignature','recordPaddleLiveEvent','process',
  source+';return POST;')(verifyPaddleLiveSignature,async()=>{writes++;return {recorded:true}}, {env:{PADDLE_LIVE_WEBHOOK_SECRET:secret}});
 return {post,getWrites:()=>writes};
}
function request(raw,signature){return new Request('https://isolated.invalid/api/paddle/webhook',{method:'POST',
 headers:{'content-type':'application/json',...(signature?{'paddle-signature':signature}:{})},body:raw});}
test('webhook API rejects unsigned and tampered bodies before any DB write',async()=>{
 const {post,getWrites}=makeRoute();
 const raw=JSON.stringify({event_id:'evt_fixture',event_type:'transaction.completed',data:{}});
 const ts=Math.floor(Date.now()/1000);
 const signature='ts='+ts+';h1='+createHmac('sha256',secret).update(ts+':'+raw).digest('hex');
 assert.equal((await post(request(raw))).status,401);
 assert.equal((await post(request(raw+' ',signature))).status,401);
 assert.equal(getWrites(),0);
 const oldTs=ts-601;
 const stale='ts='+oldTs+';h1='+createHmac('sha256',secret).update(oldTs+':'+raw).digest('hex');
 assert.equal((await post(request(raw,stale))).status,401);
 const badJson='{not valid json';
 const signedBad='ts='+ts+';h1='+createHmac('sha256',secret).update(ts+':'+badJson).digest('hex');
 assert.equal((await post(request(badJson,signedBad))).status,400);
 assert.equal(getWrites(),0);
 assert.equal((await post(request(raw,signature))).status,200);
 assert.equal(getWrites(),1);
});
