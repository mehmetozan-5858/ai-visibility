import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const src=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
const originSQL=src.match(/INSERT INTO paddle_live_subscription_origins\(subscription_id,transaction_id\)[\s\S]*?RETURNING subscription_id/);
const linkSQL=src.match(/INSERT INTO paddle_live_subscription_links\(subscription_id,payment_id,client_id,transaction_id\)[\s\S]*?RETURNING subscription_id/);
assert.ok(originSQL&&linkSQL,'Use the real production origin/link SQL, not a mocked query');
const sub='sub_provider123',txid='txn_provider123',payment='550e8400-e29b-41d4-a716-446655440000',client='550e8400-e29b-41d4-a716-446655440001';
test('isolated PostgreSQL: early origin, duplicate, conflicting origin and tenant binding',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE paddle_live_subscription_origins(subscription_id text primary key,transaction_id text not null);
    CREATE TABLE paddle_live_subscription_links(subscription_id text primary key,payment_id uuid not null,client_id uuid not null,transaction_id text not null);`);
  // Early subscription.created records provider-origin evidence, without any client access update.
  assert.equal((await db.query(originSQL[0],[sub,txid])).rows.length,1);
  assert.equal((await db.query(originSQL[0],[sub,txid])).rows.length,1);
  assert.equal((await db.query(originSQL[0],[sub,'txn_wrong'])).rows.length,0);
  assert.equal((await db.query('SELECT transaction_id FROM paddle_live_subscription_origins WHERE subscription_id=$1',[sub])).rows[0].transaction_id,txid);
  // Later transaction.completed may bind only the actual tenant payment.
  assert.equal((await db.query(linkSQL[0],[sub,payment,client,txid])).rows.length,1);
  assert.equal((await db.query(linkSQL[0],[sub,payment,'550e8400-e29b-41d4-a716-446655440002',txid])).rows.length,0);
  assert.equal((await db.query('SELECT transaction_id FROM paddle_live_subscription_origins WHERE subscription_id=$1 AND transaction_id=$2',[sub,txid])).rows.length,1);
  assert.equal((await db.query('SELECT transaction_id FROM paddle_live_subscription_origins WHERE subscription_id=$1 AND transaction_id=$2',[sub,'txn_wrong'])).rows.length,0);
  const owner=await db.query('SELECT client_id FROM paddle_live_subscription_links WHERE subscription_id=$1',[sub]);
  assert.equal(owner.rows[0].client_id,client);
 }finally{await db.close()}
});
