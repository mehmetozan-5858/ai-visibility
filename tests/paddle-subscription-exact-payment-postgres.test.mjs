import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const src=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
test('subscription activation is gated by its exact paid payment, not another payment of same client',async()=>{
 const match=src.match(/UPDATE clients SET status='active' WHERE id=\$1 AND EXISTS\([\s\S]*?\) AND status IS DISTINCT FROM 'active' RETURNING id/);
 assert.ok(match,'actual production access SQL must be present');
 const db=new PGlite();
 const client='550e8400-e29b-41d4-a716-446655440001',refunded='550e8400-e29b-41d4-a716-446655440002',unrelatedPaid='550e8400-e29b-41d4-a716-446655440003';
 try{
  await db.exec('CREATE TABLE clients(id uuid primary key,status text); CREATE TABLE payments(id uuid primary key, client_id uuid,status text);');
  await db.query("INSERT INTO clients VALUES($1,'payment-review')",[client]);
  await db.query("INSERT INTO payments VALUES($1,$2,'refunded'),($3,$2,'paid')",[refunded,client,unrelatedPaid]);
  const denied=await db.query(match[0],[client,refunded]);
  assert.equal(denied.rows.length,0,'another paid payment must never reactivate refunded subscription');
  assert.equal((await db.query('SELECT status FROM clients WHERE id=$1',[client])).rows[0].status,'payment-review');
  const allowed=await db.query(match[0],[client,unrelatedPaid]);
  assert.equal(allowed.rows.length,1,'linked paid subscription may activate');
  assert.equal((await db.query('SELECT status FROM clients WHERE id=$1',[client])).rows[0].status,'active');
 }finally{await db.close()}
});
