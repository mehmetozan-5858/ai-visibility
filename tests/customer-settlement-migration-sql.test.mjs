import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const client='22222222-2222-4222-8222-222222222222';
const payment='11111111-1111-4111-8111-111111111111';
const payment2='33333333-3333-4333-8333-333333333333';
const reviewSql=await readFile(new URL('../migrations/verified-customer-settlements-review.sql',import.meta.url),'utf8');

test('real reviewed settlement SQL migration works on ephemeral PostgreSQL and enforces exact evidence uniqueness',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   CREATE SCHEMA IF NOT EXISTS public;
   CREATE TABLE public.clients(id UUID PRIMARY KEY,status TEXT NOT NULL);
   CREATE TABLE public.payments(id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES public.clients(id),method TEXT NOT NULL,status TEXT NOT NULL);
  `);
  await db.query("INSERT INTO public.clients VALUES ($1,'active')",[client]);
  await db.query("INSERT INTO public.payments VALUES ($1,$3,'paddle','paid'),($2,$3,'paddle','pending')",[payment,payment2,client]);
  await db.exec(reviewSql);
  await db.exec(reviewSql); // Existing environments may apply the reviewed idempotent migration twice.
  const inserted=await db.query('INSERT INTO public.verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,$3,$4) RETURNING payment_id',[payment,client,'evt_signed123','txn_good123']);
  assert.equal(inserted.rows[0].payment_id,payment);
  await assert.rejects(db.query('INSERT INTO public.verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,$3,$4)',[payment2,client,'evt_signed123','txn_other123']),/unique|duplicate/i);
  await assert.rejects(db.query('INSERT INTO public.verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,$3,$4)',[payment2,client,'evt_other123','txn_good123']),/unique|duplicate/i);
  await assert.rejects(db.query('INSERT INTO public.verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,$3,$4)',[payment2,client,'invalid-event','txn_other123']),/check constraint/i);
  await assert.rejects(db.query('INSERT INTO public.verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,$3,$4)',[payment2,client,'evt_other123','invalid-transaction']),/check constraint/i);
  await assert.rejects(db.query('INSERT INTO public.verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,$3,$4)',[payment2,'44444444-4444-4444-8444-444444444444','evt_other123','txn_other123']),/foreign key/i);
  const rows=await db.query('SELECT count(*)::int AS n FROM public.verified_customer_settlements');
  assert.equal(rows.rows[0].n,1);
 }finally{await db.close()}
});
