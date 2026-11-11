import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {createClientToken,verifyClientToken} from "../lib/admin-auth.js";
import {readCustomerComparisonReport} from "../lib/customer-comparison-report.mjs";

const mine="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const paid="33333333-3333-4333-8333-333333333333";
const evidence={provider:"gemini",status:"source-supported-answer",verified:true,answer:"Documented evidence for customer A",
 evidence:{sourceUrl:"https://example.test/a",observation:"Synthetic source"}};
const unverified={provider:"openai",status:"answer-received-unverified",verified:false,answer:"Unverified model claim"};
function compile(text,name,names,values){
 const source=text.replace(/^import .*;\s*$/gm,"").replace(/^export /gm,"");
 return new Function(...names,source+";return "+name+";")(...values);
}
async function isolated(){
 const db=new PGlite();
 await db.exec(`
 CREATE TABLE clients(id UUID PRIMARY KEY,name TEXT NOT NULL,domain TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',plan TEXT NOT NULL DEFAULT 'Starter');
 CREATE TABLE payments(id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES clients(id),status TEXT NOT NULL,method TEXT NOT NULL DEFAULT 'bank-transfer');
 CREATE TABLE verified_customer_settlements(payment_id UUID PRIMARY KEY REFERENCES payments(id),client_id UUID NOT NULL REFERENCES clients(id),paddle_event_id TEXT UNIQUE NOT NULL,transaction_id TEXT UNIQUE NOT NULL);
 CREATE TABLE client_credentials(client_id UUID PRIMARY KEY REFERENCES clients(id),email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE ai_provider_comparisons(client_id UUID REFERENCES clients(id),query TEXT NOT NULL,results JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE client_pilot_access(client_id UUID PRIMARY KEY REFERENCES clients(id),email TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ);
 `);
 await db.query("INSERT INTO clients(id,name,domain,status) VALUES ($1,'Fixture Customer A','a.example','active'),($2,'Fixture Customer B','b.example','active')",[mine,other]);
 await db.query("INSERT INTO payments(id,client_id,status,method) VALUES($1,$2,'paid','paddle')",[paid,mine]);
 const password="Synthetic-Password-Only";
 const salt=crypto.randomBytes(16),hash=crypto.scryptSync(password,salt,64);
 await db.query("INSERT INTO client_credentials(client_id,email,password_hash) VALUES ($1,'a@example.test',$2)",[mine,"scrypt$"+salt.toString("hex")+"$"+hash.toString("hex")]);
 for(const [id,q,result] of [[mine,"Customer A query",[evidence,unverified]],[other,"PRIVATE: Customer B query",[evidence]]]){
  await db.query("INSERT INTO ai_provider_comparisons(client_id,query,results) VALUES ($1,$2,$3::jsonb)",[id,q,JSON.stringify(result)]);
 }
 const account=async id=>{
  const client=(await db.query("SELECT id,name,domain,status,plan FROM clients WHERE id=$1",[id])).rows[0];
  if(!client)return null;
  const payments=(await db.query("SELECT status,method FROM payments WHERE client_id=$1",[id])).rows;
  return {client,payments};
 };
 const settle=async id=>{
  const r=await db.query(`SELECT 1 FROM verified_customer_settlements s
   JOIN payments p ON p.id=s.payment_id AND p.client_id=s.client_id
   JOIN clients c ON c.id=s.client_id
   WHERE s.client_id=$1 AND p.status='paid' AND p.method='paddle'
    AND c.status<>'payment-review' LIMIT 1`,[id]);
  return r.rows.length>0;
 };
 const pilotSource=await readFile(new URL("../lib/pilot-access.js",import.meta.url),"utf8");
 const customerAccess=compile(pilotSource,"customerAccess",
  ["crypto","databasePool","getDatabaseUrl","initializeSchema","customerHasVerifiedSettlement"],
  [crypto,()=>db,()=>"fixture",async()=>{},settle]);
 const loginSource=await readFile(new URL("../app/api/client-auth/login/route.js",import.meta.url),"utf8");
 const verifyCredential=async(email,pass)=>{
  const r=(await db.query("SELECT client_id,email,password_hash FROM client_credentials WHERE lower(email)=lower($1)",[email])).rows[0];
  if(!r)return null;
  const [kind,saltHex,stored]=r.password_hash.split("$");
  const observed=crypto.scryptSync(pass,Buffer.from(saltHex,"hex"),64),expected=Buffer.from(stored,"hex");
  return kind==="scrypt"&&crypto.timingSafeEqual(observed,expected)?{clientId:r.client_id,email:r.email}:null;
 };
 const login=compile(loginSource,"POST",
  ["verifyClientCredential","createClientToken","checkRateLimit","clearRateLimit","enforceSameOrigin","resolveRequestLanguage","Response"],
  [verifyCredential,createClientToken,()=>null,()=>{},()=>null,()=>"tr",Response]);
 const portalSource=await readFile(new URL("../app/api/client-portal/route.js",import.meta.url),"utf8");
 let activeToken="";
 const cookies=async()=>({get:name=>name==="ai_client"&&activeToken?{value:activeToken}:undefined});
 const portal=compile(portalSource,"GET",
  ["readCustomerComparisonReport","databasePool","getDatabaseUrl","customerAccess","cookies","verifyClientToken",
   "getClientAccount","resolveRequestLanguage","getClientProfile","servicePrice","formatMoney","SERVICE_CODES","Response"],
  [readCustomerComparisonReport,()=>db,()=>"fixture",customerAccess,cookies,verifyClientToken,account,()=>"tr",
   async()=>null,()=>null,()=>"",[],Response]);
 return {db,login,portal,account,customerAccess,cookies,setSession:token=>{activeToken=token},password};
}
test("synthetic real login cookie and paid customer portal are denied before settlement, isolate reports after proof, revoked after cancellation",async()=>{
 const oldAuth=process.env.AUTH_SECRET,oldStrict=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 process.env.AUTH_SECRET="synthetic-auth-key-not-for-production-".repeat(2);
 process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED="true";
 const fixture=await isolated();
 try{
  const loginReq=async password=>fixture.login({json:async()=>({email:"a@example.test",password})});
  const denied=await loginReq("incorrect-password");assert.equal(denied.status,401);
  const ok=await loginReq(fixture.password);assert.equal(ok.status,200);
  const cookie=ok.headers.get("set-cookie");
  assert.match(cookie,/ai_client=/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  fixture.setSession(cookie.split("ai_client=")[1].split(";")[0]);
  const before=await fixture.portal({});assert.equal(before.status,403);
  await fixture.db.query("INSERT INTO verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES($1,$2,'evt_fixturepaid','txn_fixturepaid')",[paid,mine]);
  const permitted=await fixture.portal({});
  assert.equal(permitted.status,200);
  const body=await permitted.json();
  assert.equal(body.account.access.kind,"paid");
  assert.equal(body.account.reportEvidence.comparisonCount,1);
  assert.equal(JSON.stringify(body).includes("PRIVATE: Customer B"),false);
  assert.equal(permitted.headers.get("cache-control").includes("no-store"),true);
  await fixture.db.query("UPDATE clients SET status='payment-review' WHERE id=$1",[mine]);
  const revoked=await fixture.portal({});assert.equal(revoked.status,403);
  fixture.setSession(await createClientToken(other));
  const cross=await fixture.portal({});assert.equal(cross.status,403);
  fixture.setSession("invalid-token");
  const anonymous=await fixture.portal({});assert.equal(anonymous.status,401);
 }finally{
  await fixture.db.close();
  if(oldAuth===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=oldAuth;
  if(oldStrict===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=oldStrict;
 }
});

test("authenticated paid PDF report uses only the session tenant and becomes unavailable after cancellation",async()=>{
 const oldAuth=process.env.AUTH_SECRET,oldStrict=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 process.env.AUTH_SECRET="synthetic-auth-key-not-for-production-".repeat(2);
 process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED="true";
 const fixture=await isolated();
 try{
  await fixture.db.query("INSERT INTO verified_customer_settlements(payment_id,client_id,paddle_event_id,transaction_id) VALUES ($1,$2,'evt_fixturepdftest','txn_fixturepdftest')",[paid,mine]);
  fixture.setSession(await createClientToken(mine));
  let requested=null;
  const pdfSource=await readFile(new URL("../app/api/client-portal/report/route.js",import.meta.url),"utf8");
  const generate=async payload=>{
   requested=payload;
   return new Response("synthetic-pdf-byte-placeholder",{
    headers:{"content-type":"application/pdf","content-disposition":'attachment; filename="customer-fixture.pdf"'}
   });
  };
  const handler=compile(pdfSource,"GET",
   ["readCustomerComparisonReport","databasePool","getDatabaseUrl","customerAccess","cookies",
    "verifyClientToken","getClientAccount","buildReportResponse","Response"],
   [readCustomerComparisonReport,()=>fixture.db,()=>"fixture",fixture.customerAccess,
    fixture.cookies,verifyClientToken,async id=>{
     const account=await fixture.account(id);
     return account?{...account,scans:[]}:null;
    },generate,Response]);
  const file=await handler({url:"https://example.test/api/client-portal/report?download=1"});
  assert.equal(file.status,200);assert.equal(file.headers.get("content-type"),"application/pdf");
  assert.equal(file.headers.get("cache-control").includes("no-store"),true);
  assert.equal(requested.clientId,mine);
  assert.equal(requested.comparisons.length,1);
  assert.equal(requested.comparisons[0].query,"Customer A query");
  assert.equal(JSON.stringify(requested).includes("PRIVATE: Customer B"),false);
  requested=null;
  fixture.setSession(await createClientToken(other));
  assert.equal((await handler({url:"https://example.test/api/client-portal/report"})).status,403);
  assert.equal(requested,null);
  await fixture.db.query("UPDATE clients SET status='payment-review' WHERE id=$1",[mine]);
  fixture.setSession(await createClientToken(mine));
  assert.equal((await handler({url:"https://example.test/api/client-portal/report"})).status,403);
  assert.equal(requested,null);
  fixture.setSession("invalid");
  assert.equal((await handler({url:"https://example.test/api/client-portal/report"})).status,401);
 }finally{
  await fixture.db.close();
  if(oldAuth===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=oldAuth;
  if(oldStrict===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=oldStrict;
 }
});
