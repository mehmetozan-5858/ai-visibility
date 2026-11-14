import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const file=new URL('../migrations/verified-customer-settlements-review.sql',import.meta.url);
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const pay='33333333-3333-4333-8333-333333333333';

test('review settlement schema rejects cross-customer payment linkage and duplicate provider identities',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE TABLE public.clients(id UUID PRIMARY KEY); CREATE TABLE public.payments(id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES public.clients(id));');
  await db.query('INSERT INTO public.clients(id) VALUES($1),($2)',[a,b]);
  await db.query('INSERT INTO public.payments(id,client_id) VALUES($1,$2)',[pay,a]);
  const migration=await readFile(file,'utf8');
  assert.match(migration,/UNIQUE \(id,client_id\)/);
  assert.match(migration,/FOREIGN KEY \(payment_id,client_id\)/);
  await db.exec(migration);
  const add=(id,client,event,txn)=>db.query(
    'INSERT INTO public.verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,$3,$4)',
    [id,client,event,txn]);
  await assert.rejects(add(pay,b,'evt_wrong1','txn_wrong1'),/foreign key|violates/i);
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM public.verified_customer_settlements')).rows[0].count,0);
  await add(pay,a,'evt_valid1','txn_valid1');
  assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM public.verified_customer_settlements')).rows[0].count,1);
  await assert.rejects(add(pay,a,'evt_reused2','txn_reused2'),/duplicate key|unique/i);
 }finally{await db.close()}
});

test('review settlement migration does not perform automatic payment status updates',async()=>{
 const migration=await readFile(file,'utf8');
 assert.doesNotMatch(migration,/UPDATE\s+(?:public\.)?payments\s+SET/i);
 assert.doesNotMatch(migration,/INSERT\s+INTO\s+(?:public\.)?verified_customer_settlements/i);
});
