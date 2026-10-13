import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutIntentRequest,createSandboxCheckoutIntent,linkSandboxIntent} from '../lib/paddle-sandbox-identity.js';
import {sandboxCatalog,recordSandboxEvent} from '../lib/paddle-sandbox.js';
const env={VERCEL_ENV:'preview',PADDLE_ENVIRONMENT:'sandbox',PADDLE_SANDBOX_ENABLED:'true'};
const price=sandboxCatalog('USD').find(x=>x.code==='business-monitoring').priceId;
const request=(body={service:'business-monitoring',currency:'USD'},headers={})=>new Request('https://test.example/api/paddle-sandbox/checkout-intents',{method:'POST',headers:{origin:'https://test.example','content-type':'application/json',cookie:'ai_client=server-signed-token',...headers},body:JSON.stringify(body)});
test('identity originates from verified session, never buyer fields; CSRF and invalid catalog fail closed',async()=>{
 const options={env,verifySession:async token=>token==='server-signed-token'?{clientId:'client-a'}:null};
 const r=await checkoutIntentRequest(request(),options);assert.equal(r.clientId,'client-a');assert.equal(r.priceId,price);
 assert.equal((await checkoutIntentRequest(request({...r,service:'business-monitoring',currency:'USD'}),options)).status,400);
 for(const h of [{origin:'https://attacker.example'},{cookie:''},{cookie:'ai_client=forged'},{cookie:'ai_client=x; ai_client=y'},{'content-type':'text/plain'}])assert.notEqual((await checkoutIntentRequest(request(undefined,h),options)).status,200);
 for(const body of [{service:'__proto__',currency:'USD'},{service:'business-monitoring',currency:'__proto__'},{service:'business-solution',currency:'USD'},{service:'business-monitoring',currency:'XYZ'}])assert.equal((await checkoutIntentRequest(request(body),options)).status,400);
 assert.equal((await checkoutIntentRequest(request(),{...options,env:{...env,VERCEL_ENV:'production'}})).status,404);
});
test('intent response exposes only opaque checkout reference and validated price',async()=>{
 let stored;const out=await createSandboxCheckoutIntent({clientId:'client-a',service:'business-monitoring',priceId:price,kind:'monthly'},{query:async(sql,args)=>{stored=args}});
 assert.match(out.intentId,/^[0-9a-f-]{36}$/);assert.deepEqual(Object.keys(out).sort(),['intentId','priceId']);assert.equal(stored[1],'client-a');
});
const id='f263ff04-2fc4-4a90-b1d9-ac8dcefb6c81';
const base={id,client_id:'client-a',price_id:price,kind:'monthly',created_at:'2026-10-13T19:00:00Z',expires_at:'2026-10-13T19:30:00Z',paddle_customer_id:null,subscription_id:null,initial_transaction_id:null};
const event={event_id:'evt_identityfixture',event_type:'subscription.activated',occurred_at:'2026-10-13T19:20:00Z',data:{id:'sub_test',customer_id:'ctm_test',status:'active',custom_data:{checkout_intent_id:id,client_id:'attacker'},items:[{price:{id:price},quantity:1}]}};
const item={id:event.event_id,type:event.event_type,entityId:event.data.id,priceIds:[price],occurredAt:event.occurred_at};
function db(intent=base,owner='client-a'){const writes=[];return {writes,query:async(sql,args)=>{if(sql.startsWith('SELECT *'))return {rows:intent?[intent]:[]};if(sql.startsWith('SELECT client_id'))return {rows:[{client_id:owner}]};writes.push({sql,args});return {rows:[]}}}}
test('signed event maps only stored owner; delayed original event is accepted',async()=>{
 const tx=db();await linkSandboxIntent(event,item,tx);const binding=tx.writes.find(x=>x.sql.startsWith('UPDATE'));assert.deepEqual(binding.args,[id,'ctm_test','sub_test',null]);assert.equal(tx.writes.find(x=>x.sql.startsWith('INSERT')).args[1],'client-a');
});
test('unknown, expired, wrong-price, quantity, customer, subscription and cross-owner claims reject',async()=>{
 for(const [ev,it,tx] of [
  [event,item,db(null)],[event,{...item,occurredAt:'2026-10-13T19:31:00Z'},db()],
  [event,{...item,priceIds:['pri_wrong']},db()],
  [{...event,data:{...event.data,items:[{price:{id:price},quantity:2}]}},item,db()],
  [event,item,db({...base,paddle_customer_id:'ctm_other'})],
  [event,item,db({...base,paddle_customer_id:'ctm_test',subscription_id:'sub_other'})],
  [event,item,db(base,'client-other')],
 ])await assert.rejects(()=>linkSandboxIntent(ev,it,tx));
});
test('bound renewal can arrive after expiry but a different subscription cannot reuse the intent',async()=>{
 const intent={...base,paddle_customer_id:'ctm_test',subscription_id:'sub_test',initial_transaction_id:'txn_original'};
 const ev={...event,event_type:'transaction.completed',data:{...event.data,id:'txn_renewal',subscription_id:'sub_test'}};
 const it={...item,type:ev.event_type,entityId:'txn_renewal',occurredAt:'2026-11-13T19:20:00Z'};
 await linkSandboxIntent(ev,it,db(intent));await assert.rejects(()=>linkSandboxIntent({...ev,data:{...ev.data,subscription_id:'sub_other'}},it,db(intent)));
});
test('link failure rolls back event insertion and never updates entity state',async()=>{
 const queries=[];const tx={query:async(sql)=>{queries.push(sql);return {rows:sql.startsWith('INSERT INTO paddle_sandbox_events')?[{event_id:event.event_id}]:[]}},release:()=>{}};
 await assert.rejects(()=>recordSandboxEvent(event,{connect:async()=>tx},{linkIntent:async()=>{throw Error('customer-already-linked')}}));
 assert.ok(queries.includes('ROLLBACK'));assert.equal(queries.some(x=>x.startsWith('INSERT INTO paddle_sandbox_entities')),false);
});
