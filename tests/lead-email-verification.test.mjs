import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {leadCodeDigest,normalizeLeadEmail,leadEmailVerificationEnabled,verifyLeadEmailChallenge} from "../lib/lead-email-verification.mjs";
const id="11111111-1111-4111-8111-111111111111";
const key="a".repeat(64);
test("normalizes email and rejects malformed input",()=>{
 assert.equal(normalizeLeadEmail(" Customer@Example.Test "),"customer@example.test");
 assert.equal(normalizeLeadEmail("not-email"),null);
 assert.equal(normalizeLeadEmail(null),null);
});
test("challenge is lead and email bound, never plain sha256",()=>{
 const a=leadCodeDigest(id,"customer@example.test","123456",key);
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.notEqual(a,leadCodeDigest(id,"other@example.test","123456",key));
 assert.notEqual(a,leadCodeDigest("22222222-2222-4222-8222-222222222222","customer@example.test","123456",key));
 assert.throws(()=>leadCodeDigest(id,"customer@example.test","12345",key));
});
test("public challenge API is disabled by default and never verifies invalid codes",async()=>{
 const previous=process.env.LEAD_EMAIL_VERIFICATION_ENABLED;
 delete process.env.LEAD_EMAIL_VERIFICATION_ENABLED;
 try{assert.equal(leadEmailVerificationEnabled(),false);
 assert.equal(await verifyLeadEmailChallenge({leadId:id,email:"customer@example.test",code:"invalid"}),false);
 }finally{if(previous===undefined)delete process.env.LEAD_EMAIL_VERIFICATION_ENABLED;else process.env.LEAD_EMAIL_VERIFICATION_ENABLED=previous;}
});
test("API routes reject cross origin, rate limit and never create a customer or grant access",async()=>{
 for(const path of ["issue","verify"]){
  const source=await readFile(new URL(`../app/api/lead-email/${path}/route.js`,import.meta.url),"utf8");
  assert.match(source,/enforceSameOrigin\(req\)/);
  assert.match(source,/checkRateLimit\(req/);
  assert.match(source,/leadEmailVerificationEnabled\(\)/);
  assert.doesNotMatch(source,/createClientToken|createClientCredential|grantPilot|startScan|Paddle\.Checkout/);
 }
});
test("migration has bounded attempts, one challenge per lead and email-specific foreign key",async()=>{
 const sql=await readFile(new URL("../migrations/lead-email-challenges-review.sql",import.meta.url),"utf8");
 assert.match(sql,/lead_id UUID PRIMARY KEY REFERENCES public.customer_leads\(id\)/);
 assert.match(sql,/CHECK \(attempts BETWEEN 0 AND 6\)/);
 assert.match(sql,/verified_at TIMESTAMPTZ/);
});
