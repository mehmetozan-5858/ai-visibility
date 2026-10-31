import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL engine in WASM; fully isolated, no account or customer database.
test('PostgreSQL refuses delayed completion of refunded payment',async()=>{
 const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 const query=source.match(/UPDATE payments SET status='paid',method='paddle',paid_at=COALESCE\(paid_at,NOW\(\)\)\s+WHERE id=\$1 AND client_id=\$2 AND status NOT IN \('paid','refunded'\)\s+RETURNING id,client_id,plan,status/);
 assert.ok(query,'Production completion SQL must retain the refund guard');
 const db=new PGlite();
 try{
  await db.exec("CREATE TABLE payments(id text PRIMARY KEY,client_id text,status text,method text,paid_at timestamptz,plan text);");
  await db.query("INSERT INTO payments(id,client_id,status,plan) VALUES ($1,$2,'refunded','basic')",['payment-fixture','client-fixture']);
  const result=await db.query(query[0],['payment-fixture','client-fixture']);
  assert.equal(result.rows.length,0,'refunded payment must not be updated to paid');
  const current=await db.query('SELECT status FROM payments WHERE id=$1',['payment-fixture']);
  assert.equal(current.rows[0].status,'refunded');
  await db.query("INSERT INTO payments(id,client_id,status,plan) VALUES ($1,$2,'pending','basic')",['pending-fixture','client-fixture']);
  const allowed=await db.query(query[0],['pending-fixture','client-fixture']);
  assert.equal(allowed.rows[0].status,'paid','valid pending first payment must still work');
 }finally{await db.close()}
});
