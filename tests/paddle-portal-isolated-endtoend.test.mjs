import test from "node:test";
import assert from "node:assert/strict";
import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";

/** Unprivileged isolated PostgreSQL emulator; never calls Paddle or Neon. */
async function harness(){
 const db=new PGlite();
 await db.exec(`
  CREATE TABLE clients (
   id UUID PRIMARY KEY,name TEXT NOT NULL,domain TEXT NOT NULL,
   plan TEXT NOT NULL DEFAULT 'Starter',status TEXT NOT NULL DEFAULT 'active');
  CREATE TABLE payments (
   id UUID PRIMARY KEY,client_id UUID REFERENCES clients(id),reference_code TEXT UNIQUE,
   method TEXT NOT NULL DEFAULT 'bank-transfer',status TEXT NOT NULL DEFAULT 'pending',
   plan TEXT NOT NULL DEFAULT 'Starter',setup_amount INTEGER NOT NULL DEFAULT 0,
   monthly_amount INTEGER NOT NULL DEFAULT 0,currency TEXT NOT NULL DEFAULT '',
   service_start_consent_at TIMESTAMPTZ,terms_version TEXT,paid_at TIMESTAMPTZ);
  CREATE TABLE verified_customer_settlements(
   payment_id UUID PRIMARY KEY REFERENCES payments(id),client_id UUID NOT NULL REFERENCES clients(id),
   paddle_event_id TEXT NOT NULL UNIQUE,transaction_id TEXT NOT NULL UNIQUE,
   verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 `);
 // One shared in-memory transaction connection: read/write consistency and rollback
 // are provided by PGlite (not mocked SQL results).
 const pool={
  query:(...args)=>db.query(...args),
  connect:async()=>({query:(...args)=>db.query(...args),release:()=>{}})
 };
 const source=(await readFile(new URL("../lib/paddle-live.js",import.meta.url),"utf8"))
  .replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
 const functions=new Function("createHmac","timingSafeEqual","randomUUID","databasePool","getDatabaseUrl",
  source+";return {verifyPaddleLiveSignature,recordPaddleLiveEvent};")(
  createHmac,timingSafeEqual,randomUUID,()=>pool,()=>"isolated-pglite");
 return {db,...functions};
}
const client="11111111-1111-4111-8111-111111111111",payment="22222222-2222-4222-8222-222222222222";
const other="33333333-3333-4333-8333-333333333333";
function event({id="evt_synthcompletea",type="transaction.completed",tx="txn_synthetica",clientId=client,paymentId=payment,amount="16900",currency="TRY",subscriptionId="sub_synthetica"}={}){
 return {
  event_id:id,event_type:type,occurred_at:new Date().toISOString(),
  data:{id:tx,status:"completed",currency_code:currency,origin:"api",
   subscription_id:subscriptionId,items:[{quantity:1,price:{unit_price:{amount}}}],
   custom_data:{payment_id:paymentId,client_id:clientId}}
 };
}
async function allowed(db,clientId){
 const result=await db.query(`SELECT 1 FROM verified_customer_settlements s
  JOIN payments p ON p.id=s.payment_id AND p.client_id=s.client_id
  JOIN clients c ON c.id=s.client_id
  WHERE s.client_id=$1 AND p.status='paid' AND p.method='paddle'
    AND c.status<>'payment-review' LIMIT 1`,[clientId]);
 return result.rows.length>0;
}
test("signed synthetic Paddle completion grants only own tenant, replay does not mint proof, cancellation suspends access",async()=>{
 const previous=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED="true";
 const {db,verifyPaddleLiveSignature,recordPaddleLiveEvent}=await harness();
 try{
  await db.query("INSERT INTO clients(id,name,domain,status) VALUES($1,'Synthetic A','example.invalid','active'),($2,'Synthetic B','other.invalid','active')",[client,other]);
  await db.query(`INSERT INTO payments(id,client_id,reference_code,status,plan,setup_amount,monthly_amount,currency)
    VALUES($1,$2,'SYNTH-PADDLE-1','pending','Starter',120,49,'TRY')`,[payment,client]);
  assert.equal(await allowed(db,client),false);
  const e=event(),raw=JSON.stringify(e),ts=Math.floor(Date.now()/1000),secret="only-a-synthetic-webhook-secret";
  const sig=createHmac("sha256",secret).update(ts+":"+raw).digest("hex");
  assert.equal(verifyPaddleLiveSignature(raw,`ts=${ts};h1=${sig}`,secret),true);
  assert.equal(verifyPaddleLiveSignature(raw+"x",`ts=${ts};h1=${sig}`,secret),false);
  // The handler is deliberately called only after the signature check above.
  const receipt=await recordPaddleLiveEvent(e);
  assert.equal(receipt.linked,true);assert.equal(receipt.paymentChanged,true);
  assert.equal(await allowed(db,client),true);
  assert.equal(await allowed(db,other),false);
  const replay=await recordPaddleLiveEvent(e);
  assert.equal(replay.duplicate,true);
  const evidence=(await db.query("SELECT COUNT(*)::int AS count FROM verified_customer_settlements")).rows[0];
  assert.equal(evidence.count,1);
  const cancelled=event({id:"evt_synthcancelled",type:"subscription.canceled",tx:"sub_synthetica"});
  cancelled.data.items=[];cancelled.data.status="canceled";
  const cancellation=await recordPaddleLiveEvent(cancelled);
  assert.equal(cancellation.linked,true);
  assert.equal(await allowed(db,client),false);
  const state=(await db.query("SELECT status FROM clients WHERE id=$1",[client])).rows[0].status;
  assert.equal(state,"payment-review");
 }finally{
  await db.close();
  if(previous===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
  else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=previous;
 }
});
test("wrong currency and tenant, preexisting paid label and missing proof table never grant settlement",async()=>{
 const previous=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED="true";
 const {db,recordPaddleLiveEvent}=await harness();
 try{
  await db.query("INSERT INTO clients(id,name,domain,status) VALUES($1,'Synthetic A','example.invalid','active'),($2,'Synthetic B','other.invalid','active')",[client,other]);
  await db.query("INSERT INTO payments(id,client_id,reference_code,status,plan,setup_amount,monthly_amount,currency) VALUES($1,$2,'SYNTH-PADDLE-2','pending','Starter',120,49,'TRY')",[payment,client]);
  const wrong=await recordPaddleLiveEvent(event({id:"evt_wrongcurrency",currency:"USD"}));
  assert.equal(wrong.linked,false);assert.equal(await allowed(db,client),false);
  const cross=await recordPaddleLiveEvent(event({id:"evt_wrongtenant",clientId:other}));
  assert.equal(cross.linked,false);assert.equal(await allowed(db,other),false);
  await db.query("UPDATE payments SET status='paid',method='bank-transfer' WHERE id=$1",[payment]);
  const preexisting=await recordPaddleLiveEvent(event({id:"evt_prelabeled"}));
  assert.equal(preexisting.paymentChanged,false);
  assert.equal(await allowed(db,client),false);
  const count=(await db.query("SELECT COUNT(*)::int AS count FROM verified_customer_settlements")).rows[0].count;
  assert.equal(count,0);
 }finally{
  await db.close();
  if(previous===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
  else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=previous;
 }
});
