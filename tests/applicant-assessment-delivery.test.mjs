import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {applicantAssessmentLink,applicantDeliveryEnabled,sendApplicantAssessmentLink} from "../lib/applicant-assessment-delivery.mjs";
import {createApplicantAssessmentGrant} from "../lib/applicant-assessment-grant.mjs";
const leadId="11111111-1111-4111-8111-111111111111",prospectId="22222222-2222-4222-8222-222222222222";
test("verified preview link uses URL fragment and HTTPS only",()=>{
 const token=createApplicantAssessmentGrant({leadId,prospectId,secret:"s".repeat(64),now:1794370000000});
 const url=applicantAssessmentLink(token,{base:"https://www.aivisibilityworks.com"});
 assert.ok(url.startsWith("https://www.aivisibilityworks.com/basvuru-analiz#token="));
 assert.equal(url.includes("?token="),false);
 assert.throws(()=>applicantAssessmentLink(token,{base:"http://localhost"}),/invalid-public-app-url/);
});
test("provider send error is redacted and never logged or exposed",async()=>{
 const oldKey=process.env.RESEND_API_KEY,oldFrom=process.env.EMAIL_FROM;
 process.env.RESEND_API_KEY="test-only-key";process.env.EMAIL_FROM="noreply@example.test";
 try{
  const link=applicantAssessmentLink(createApplicantAssessmentGrant({leadId,prospectId,secret:"s".repeat(64)}));
  await assert.rejects(sendApplicantAssessmentLink({email:"applicant@example.test",link,send:async()=>({ok:false,status:403,text:async()=>"secret-provider-error"})}),e=>e.message==="delivery-provider-unconfirmed");
  let observed=null;
  await sendApplicantAssessmentLink({email:"applicant@example.test",link,send:async(url,args)=>{observed={url,args};return {ok:true}}});
  assert.equal(observed.url,"https://api.resend.com/emails");
  assert.equal(JSON.parse(observed.args.body).to[0],"applicant@example.test");
 }finally{
  if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;
  if(oldFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=oldFrom;
 }
});
test("delivery disabled by default",()=>{
 const old=process.env.APPLICANT_ASSESSMENT_DELIVERY_ENABLED;
 delete process.env.APPLICANT_ASSESSMENT_DELIVERY_ENABLED;
 try{assert.equal(applicantDeliveryEnabled(),false)}finally{
  if(old===undefined)delete process.env.APPLICANT_ASSESSMENT_DELIVERY_ENABLED;else process.env.APPLICANT_ASSESSMENT_DELIVERY_ENABLED=old;
 }
});
test("only admin with explicit confirmation can request single delivery; access is rechecked",async()=>{
 const src=await readFile(new URL("../app/api/admin/applicant-assessment-deliver/route.js",import.meta.url),"utf8");
 assert.match(src,/await requireAdmin\(req\)/);
 assert.match(src,/enforceSameOrigin\(req\)/);
 assert.match(src,/body\?\.confirm!=="send-one-applicant-assessment-email"/);
 assert.match(src,/a\.revoked_at IS NULL/);
 assert.match(src,/d\.review_id=a\.review_id/);
 assert.match(src,/emailVerifiedAt/);
 assert.match(src,/dnsVerifiedAt/);
 assert.match(src,/ON CONFLICT\(lead_id\) DO NOTHING/);
 assert.match(src,/automaticRetry:false/);
});
test("audit ledger forbids implicit retry and never stores token",async()=>{
 const sql=await readFile(new URL("../migrations/applicant-assessment-deliveries-review.sql",import.meta.url),"utf8");
 assert.match(sql,/lead_id UUID NOT NULL UNIQUE/);
 assert.match(sql,/status IN \('reserved','sent','failed'\)/);
 assert.doesNotMatch(sql,/token TEXT|token_hash|bearer_token|link_url/);
});
