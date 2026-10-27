import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createHmac} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {recordPaddleLiveEventWithPool} from '../lib/paddle-live.js';
import {createPaddleWebhookHandler} from '../lib/paddle-webhook-handler.mjs';

const client='550e8400-e29b-41d4-a716-446655440001';
const other='550e8400-e29b-41d4-a716-446655440002';
const payment='550e8400-e29b-41d4-a716-446655440010';
const oldPayment='550e8400-e29b-41d4-a716-446655440011';
const otherPayment='550e8400-e29b-41d4-a716-446655440012';
function event(id,type,{time='2026-10-27T10:00:00Z',entity,clientId=client,paymentId=payment,amount='2500',currency='USD',origin='api',status}={}){
 return {event_id:`evt_${id}`,event_type:type,occurred_at:time,data:{
  id:entity||(type.startsWith('subscription.')?'sub_fixture':'txn_'+id),
  status:status||(type==='transaction.completed'?'completed':type.split('.')[1]),
  currency_code:currency,origin,items:[{quantity:1,price:{unit_price:{amount}}}],
  custom_data:{client_id:clientId,payment_id:paymentId}}};
}

test('signed Paddle HTTP events enforce exact payment scope, renewal, lifecycle and durable deduplication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'paddle-ledger-'));
 let db=new PGlite(dir);
 const query=(sql,args)=>db.query(sql,args);
 const pool={query,connect:async()=>({query,release(){}})};
 const secret='isolated-http-fixture-secret';
 const handler=createPaddleWebhookHandler({getSecret:()=>secret,record:e=>recordPaddleLiveEventWithPool(e,pool)});
 const server=createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const result=await handler(new Request('http://fixture.invalid/api/paddle/webhook',{
   method:'POST',headers:req.headers,body:Buffer.concat(chunks)}));
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=`http://127.0.0.1:${server.address().port}/api/paddle/webhook`;
 const send=async(e,{signature=true}={})=>{
  const raw=JSON.stringify(e),ts=Math.floor(Date.now()/1000);
  const digest=createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex');
  return fetch(address,{method:'POST',headers:{'paddle-signature':signature?`ts=${ts};h1=${digest}`:'invalid'},body:raw});
 };
 const record=async e=>{const response=await send(e);assert.equal(response.status,200);return response.json()};
 const clientStatus=async(id=client)=>(await query('SELECT status FROM clients WHERE id=$1',[id])).rows[0].status;
 try{
  await db.exec(`CREATE TABLE clients(id UUID PRIMARY KEY,plan TEXT,status TEXT);
   CREATE TABLE payments(id UUID PRIMARY KEY,client_id UUID,reference_code TEXT UNIQUE,method TEXT,
    status TEXT,plan TEXT,setup_amount NUMERIC,monthly_amount NUMERIC,currency TEXT,
    service_start_consent_at TIMESTAMPTZ,terms_version TEXT,paid_at TIMESTAMPTZ);`);
  for(const id of [client,other])await query("INSERT INTO clients VALUES($1,'monitoring','payment-review')",[id]);
  for(const [id,owner,status,setup,monthly] of [[payment,client,'pending',10,15],[oldPayment,client,'paid',0,15],[otherPayment,other,'paid',0,15]])
   await query("INSERT INTO payments(id,client_id,status,plan,setup_amount,monthly_amount,currency) VALUES($1,$2,$3,'monitoring',$4,$5,'USD')",[id,owner,status,setup,monthly]);
  assert.equal((await send(event('unsigned','transaction.completed'),{signature:false})).status,401);
  assert.equal(await clientStatus(),'payment-review');

  // A previous unrelated paid invoice cannot activate this pending subscription.
  const early=await record(event('early','subscription.activated'));
  assert.equal(early.reason,'linked-payment-not-paid');
  assert.equal(await clientStatus(),'payment-review');
  const cross=await record(event('cross','subscription.canceled',{entity:'sub_cross',clientId:other,paymentId:payment}));
  assert.equal(cross.reason,'payment-not-found');
  assert.equal(await clientStatus(other),'payment-review');

  const missingCurrency=await record(event('nocurrency','transaction.completed',{currency:''}));
  assert.equal(missingCurrency.reason,'currency-mismatch');
  assert.equal((await query('SELECT status FROM payments WHERE id=$1',[payment])).rows[0].status,'pending');
  assert.equal((await record(event('failed','transaction.payment_failed'))).paymentStatus,'failed');
  assert.equal(await clientStatus(),'payment-review');
  const discounted=event('discount','transaction.completed');discounted.data.discount_id='dsc_fixture';
  assert.equal((await record(discounted)).reason,'discount-review-required');
  assert.equal(await clientStatus(),'payment-review');
  const paid=event('paid','transaction.completed');
  assert.equal((await record(paid)).paymentChanged,true);
  assert.equal(await clientStatus(),'active');
  assert.equal((await record(paid)).duplicate,true);

  // Renewal contains only 15.00, not the original 10.00 setup + 15.00.
  const renewal=event('renewal','transaction.completed',{origin:'subscription_recurring',amount:'1500'});
  assert.equal((await record(renewal)).renewalRecorded,true);
  assert.equal((await record({...renewal,event_id:'evt_renewalDelivery2'})).renewalRecorded,false);
  assert.equal((await query("SELECT COUNT(*)::int AS n FROM payments WHERE reference_code='PADDLE-TXN_RENEWAL'")).rows[0].n,1);
  assert.equal((await record(event('badrenewal','transaction.completed',{origin:'subscription_recurring',amount:'2500'}))).reason,'amount-mismatch');
  await query("UPDATE payments SET setup_amount=0.10,monthly_amount=0.20,status='pending' WHERE id=$1",[payment]);
  assert.equal((await record(event('fractional','transaction.completed',{amount:'30'}))).paymentChanged,true);
  await query('UPDATE payments SET setup_amount=10,monthly_amount=15 WHERE id=$1',[payment]);
  await record(event('pastdue','subscription.past_due',{time:'2026-10-27T11:30:00Z'}));
  assert.equal(await clientStatus(),'payment-review');

  await record(event('cancel','subscription.canceled',{time:'2026-10-27T12:00:00Z'}));
  assert.equal(await clientStatus(),'payment-review');
  await record(event('stale','subscription.activated',{time:'2026-10-27T11:00:00Z'}));
  assert.equal(await clientStatus(),'payment-review');
  await record(event('resume','subscription.resumed',{time:'2026-10-27T13:00:00Z',status:'active'}));
  assert.equal(await clientStatus(),'active');
  // An event cannot reassign an already-bound subscription to another customer.
  await query("UPDATE clients SET status='active' WHERE id=$1",[other]);
  await record(event('rebind','subscription.canceled',{time:'2026-10-27T14:00:00Z',clientId:other,paymentId:otherPayment}));
  assert.equal(await clientStatus(other),'active');
  assert.equal((await query("SELECT client_id FROM paddle_live_entities WHERE entity_id='sub_fixture'")).rows[0].client_id,client);

  await query("UPDATE payments SET status='refunded' WHERE id=$1",[payment]);
  await query("UPDATE clients SET status='payment-review' WHERE id=$1",[client]);
  assert.equal((await record(event('refunded','transaction.completed'))).reason,'payment-refunded');
  assert.equal(await clientStatus(),'payment-review');
  await db.close();db=new PGlite(dir);
  assert.equal((await record(paid)).duplicate,true);
  assert.equal(await clientStatus(),'payment-review');
 }finally{await new Promise(resolve=>server.close(resolve));await db.close();await rm(dir,{recursive:true,force:true})}
});
