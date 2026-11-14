import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Ephemeral in-memory PostgreSQL; never touches Neon or actual customers.
const paymentA='11111111-1111-4111-8111-111111111111';
const paymentB='33333333-3333-4333-8333-333333333333';
const clientA='22222222-2222-4222-8222-222222222222';
const clientB='44444444-4444-4444-8444-444444444444';
const source=(await readFile(new URL('../lib/customer-settlement-proof.mjs',import.meta.url),'utf8'))
 .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
function verifier(db){
 return new Function('getDatabaseUrl','databasePool','process',source+'\nreturn customerHasVerifiedSettlement;')(
  ()=>'memory-only-test',()=>db,{env:{CUSTOMER_SETTLEMENT_PROOF_ENABLED:'true'}});
}
test('isolated SQL acceptance rejects paid labels, cross-tenant proof, and frozen customer',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   CREATE TABLE clients(id UUID PRIMARY KEY,status TEXT NOT NULL);
   CREATE TABLE payments(id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES clients(id),status TEXT NOT NULL,method TEXT NOT NULL);
   CREATE TABLE verified_customer_settlements(
     payment_id UUID PRIMARY KEY REFERENCES payments(id),client_id UUID NOT NULL REFERENCES clients(id),
     paddle_event_id TEXT NOT NULL UNIQUE,transaction_id TEXT NOT NULL UNIQUE);
   CREATE TABLE client_pilot_access(client_id UUID PRIMARY KEY REFERENCES clients(id),expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ);
  `);
  await db.query("INSERT INTO clients VALUES ($1,'active'),($2,'active')",[clientA,clientB]);
  await db.query("INSERT INTO payments VALUES ($1,$2,'paid','bank-transfer'),($3,$4,'paid','paddle')",[paymentA,clientA,paymentB,clientB]);
  const has=verifier(db);
  assert.equal(await has(clientA),false,'bank paid label alone never supplies Paddle proof');
  assert.equal(await has(clientB),false,'Paddle paid label alone never supplies signed settlement proof');
  await db.query('INSERT INTO verified_customer_settlements VALUES ($1,$2,$3,$4)',[paymentB,clientA,'evt_abc123','txn_abc123']);
  assert.equal(await has(clientA),false,'tenant A cannot unlock using tenant B payment');
  assert.equal(await has(clientB),false,'tenant B cannot unlock tenant A proof');
  await db.query('UPDATE verified_customer_settlements SET client_id=$1 WHERE payment_id=$2',[clientB,paymentB]);
  assert.equal(await has(clientB),true,'exact verified tenant/payment can unlock');
  assert.equal(await has(clientA),false,'other tenant never unlocked');
  await db.query("UPDATE clients SET status='payment-review' WHERE id=$1",[clientB]);
  assert.equal(await has(clientB),false,'payment-review customer denied despite signed settlement row');
 }finally{await db.close()}
});
test('missing settlement table fails closed without writing any schema',async()=>{
 const db=new PGlite();
 try{
  await db.exec("CREATE TABLE clients(id UUID PRIMARY KEY,status TEXT NOT NULL)");
  const has=verifier(db);
  assert.equal(await has(clientA),false);
  const r=await db.query("SELECT to_regclass('public.verified_customer_settlements') AS name");
  assert.equal(r.rows[0].name,null);
 }finally{await db.close()}
});
