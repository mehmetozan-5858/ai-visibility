import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../app/api/webhooks/resend/route.js',import.meta.url),'utf8');
async function route({invalid=false,queueFails=false,inserted=true}={}){
 const state={callbacks:[],processed:0,queued:0};
 const code=source.replace(/^import .*;$/gm,'');
 const factory=new Function('verifyInboundWebhook','enqueueInbound','processInbound','after','withRequestBudget',code.replace(/export /g,'')+';return POST');
 return {state,POST:factory(()=>{if(invalid)throw Error();return {type:'email.received',data:{email_id:'test'}}},async()=>{state.queued++;if(queueFails)throw Error();return inserted},async()=>{state.processed++;return {results:[]}},callback=>state.callbacks.push(callback),async(_,callback)=>callback())};
}
test('only verified durable mail queues trigger deferred processing, including retries',async()=>{
 const previous=process.env.RESEND_WEBHOOK_SECRET;process.env.RESEND_WEBHOOK_SECRET='test-secret';
 try{
  for(const options of [{invalid:true},{queueFails:true},{},{inserted:false}]){
   const {state,POST}=await route(options);
   const response=await POST(new Request('https://example.com',{method:'POST',body:'{}'}));
   assert.equal(response.status,options.invalid?401:options.queueFails?500:200);
   assert.equal(state.callbacks.length,options.invalid||options.queueFails?0:1);
   assert.equal(state.processed,0);
   for(const callback of state.callbacks)await callback();
   assert.equal(state.processed,state.callbacks.length);
  }
 }finally{if(previous===undefined)delete process.env.RESEND_WEBHOOK_SECRET;else process.env.RESEND_WEBHOOK_SECRET=previous}
});
