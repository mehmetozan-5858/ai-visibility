import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
const clientId='550e8400-e29b-41d4-a716-446655440001';
const paymentId='550e8400-e29b-41d4-a716-446655440000';
const subscriptionId='sub_providerabc';
const transactionId='txn_providerabc';
function event(id,type,data,at){return {event_id:id,event_type:type,occurred_at:at,data};}
test('full live webhook processor: early subscription, activation, settlement, replay in isolated PostgreSQL',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE clients(id uuid primary key,status text,plan text);
   CREATE TABLE payments(id uuid primary key,client_id uuid,status text,currency text,plan text,
    setup_amount integer,monthly_amount integer,method text,paid_at timestamptz,
    service_start_consent_at timestamptz,terms_version text);`);
  await db.query("INSERT INTO clients(id,status,plan) VALUES($1,'pending','pilot')",[clientId]);
  await db.query("INSERT INTO payments(id,client_id,status,currency,plan,setup_amount,monthly_amount) VALUES($1,$2,'pending','EUR','pilot',0,49)",[paymentId,clientId]);
  const connection={query:(sql,args=[])=>db.query(sql,args),release(){}};
  const pool={query:(sql,args=[])=>db.query(sql,args),connect:async()=>connection};
  const record=new Function('databasePool','getDatabaseUrl','randomUUID',source+';return recordPaddleLiveEvent;')(
   ()=>pool,()=> 'postgres://isolated-only',randomUUID);
  const created=event('evt_createdabc','subscription.created',
   {id:subscriptionId,status:'active',transaction_id:transactionId},'2026-11-01T08:00:00Z');
  const activated=event('evt_activatedabc','subscription.activated',
   {id:subscriptionId,status:'active'},'2026-11-01T08:01:00Z');
  await record(created);await record(activated);
  assert.equal((await db.query('SELECT status FROM clients WHERE id=$1',[clientId])).rows[0].status,'pending');
  const completion=event('evt_completedabc','transaction.completed',
   {id:transactionId,status:'completed',origin:'api',currency_code:'EUR',subscription_id:subscriptionId,
    items:[{quantity:1,price:{unit_price:{amount:'4900'}}}],
    custom_data:{payment_id:paymentId,client_id:clientId}},'2026-11-01T08:02:00Z');
  const result=await record(completion);
  assert.equal(result.recorded,true);
  assert.equal((await db.query('SELECT status FROM payments WHERE id=$1',[paymentId])).rows[0].status,'paid');
  assert.equal((await db.query('SELECT status FROM clients WHERE id=$1',[clientId])).rows[0].status,'active');
  assert.equal((await record(completion)).duplicate,true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM paddle_live_events')).rows[0].n,3);
  assert.equal((await db.query('SELECT transaction_id FROM paddle_live_subscription_origins WHERE subscription_id=$1',[subscriptionId])).rows[0].transaction_id,transactionId);
 }finally{await db.close()}
});
