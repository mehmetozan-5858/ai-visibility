import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
test('full webhook refuses refunded completion before creating subscription link',async()=>{
 const db=new PGlite();
 const client='550e8400-e29b-41d4-a716-446655440001';
 const payment='550e8400-e29b-41d4-a716-446655440000';
 try {
  await db.exec(`CREATE TABLE clients(id uuid PRIMARY KEY,status text,plan text);
   CREATE TABLE payments(id uuid PRIMARY KEY,client_id uuid,status text,currency text,plan text,
    setup_amount integer,monthly_amount integer,method text,paid_at timestamptz,
    service_start_consent_at timestamptz,terms_version text);`);
  await db.query("INSERT INTO clients(id,status,plan) VALUES($1,'payment-review','pilot')",[client]);
  await db.query("INSERT INTO payments(id,client_id,status,currency,plan,setup_amount,monthly_amount) VALUES($1,$2,'refunded','EUR','pilot',0,49)",[payment,client]);
  const connection={query:(sql,args=[])=>db.query(sql,args),release(){}};
  const pool={query:(sql,args=[])=>db.query(sql,args),connect:async()=>connection};
  const record=new Function('databasePool','getDatabaseUrl','randomUUID',source+';return recordPaddleLiveEvent;')(
    ()=>pool,()=> 'postgres://offline-test-only',randomUUID);
  const result=await record({
   event_id:'evt_refunded123',event_type:'transaction.completed',
   occurred_at:'2026-11-01T08:02:00Z',
   data:{id:'txn_refunded123',status:'completed',origin:'api',currency_code:'EUR',
    subscription_id:'sub_refunded123',items:[{quantity:1,price:{unit_price:{amount:'4900'}}}],
    custom_data:{payment_id:payment,client_id:client}}
  });
  assert.equal(result.paymentStatus,'refunded');
  assert.equal(result.linked,false);
  assert.equal(result.reason,'payment-refunded');
  assert.equal((await db.query('SELECT status FROM clients WHERE id=$1',[client])).rows[0].status,'payment-review');
  assert.equal((await db.query('SELECT status FROM payments WHERE id=$1',[payment])).rows[0].status,'refunded');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM paddle_live_subscription_links')).rows[0].n,0);
 } finally {await db.close()}
});
