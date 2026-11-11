import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createApplicantAssessmentGrant,verifyApplicantAssessmentGrant,linkedApplicantAssessmentEnabled} from "../lib/applicant-assessment-grant.mjs";
const lead="11111111-1111-4111-8111-111111111111",prospect="22222222-2222-4222-8222-222222222222",secret="s".repeat(64),now=1794370000000;
test("short-lived grant is bound to lead, prospect, purpose and signing secret",()=>{
 const token=createApplicantAssessmentGrant({leadId:lead,prospectId:prospect,secret,now});
 assert.deepEqual(verifyApplicantAssessmentGrant(token,{secret,now}),{leadId:lead,prospectId:prospect,expiresAt:Math.floor(now/1000)+900});
 assert.equal(verifyApplicantAssessmentGrant(token,{secret:"x".repeat(64),now}),null);
 assert.equal(verifyApplicantAssessmentGrant(token,{secret,now:now+901000}),null);
 const parts=token.split(".");parts[2]=lead;
 assert.equal(verifyApplicantAssessmentGrant(parts.join("."),{secret,now}),null);
});
test("grant never exceeds fifteen minutes",()=>{
 const token=createApplicantAssessmentGrant({leadId:lead,prospectId:prospect,secret,now,ttlSeconds:999999});
 assert.equal(verifyApplicantAssessmentGrant(token,{secret,now})?.expiresAt,Math.floor(now/1000)+900);
});
test("feature disabled by default",()=>{
 const old=process.env.APPLICANT_ASSESSMENT_PREVIEW_ENABLED;
 delete process.env.APPLICANT_ASSESSMENT_PREVIEW_ENABLED;
 try{assert.equal(linkedApplicantAssessmentEnabled(),false)}finally{
  if(old===undefined)delete process.env.APPLICANT_ASSESSMENT_PREVIEW_ENABLED;else process.env.APPLICANT_ASSESSMENT_PREVIEW_ENABLED=old;
 }
});
test("grant issuer requires admin, verified email, reviewed active link and never sends or starts a provider",async()=>{
 const src=await readFile(new URL("../app/api/admin/applicant-assessment-grant/route.js",import.meta.url),"utf8");
 assert.match(src,/await requireAdmin\(req\)/);
 assert.match(src,/a\.revoked_at IS NULL/);
 assert.match(src,/c\.email=lower\(l\.email\)/);
 assert.match(src,/row\.emailVerifiedAt/);
 assert.match(src,/row\.emailConsumedAt/);
 assert.match(src,/validDomain!==row\.verifiedDomain/);
 assert.doesNotMatch(src,/sendVerificationEmail|startScan|grantPilot|createClientCredential/);
});
test("preview rechecks the active exact link and exposes only aggregate evidence",async()=>{
 const src=await readFile(new URL("../app/api/applicant-assessment/route.js",import.meta.url),"utf8");
 assert.match(src,/verifyApplicantAssessmentGrant/);
 assert.match(src,/a\.lead_id=\$1 AND a\.prospect_id=\$2 AND a\.revoked_at IS NULL/);
 assert.match(src,/freeAssessmentEvidence\(row,runs\)/);
 assert.match(src,/paidAccess:false,providerCallStarted:false/);
 assert.doesNotMatch(src,/createFreeAssessmentToken|Paddle|startScan|sendVerificationEmail/);
 const component=await readFile(new URL("../components/ApplicantAssessment.js",import.meta.url),"utf8");
 assert.match(component,/window\.location\.hash/);
 assert.match(component,/a\?\.status==="ready"/);
 assert.match(component,/Number\.isInteger\(a\.score\)/);
 assert.match(component,/a\.samples>=6/);
 assert.match(component,/a\.providers>=2/);
 assert.match(component,/a\.queries>=2/);
});
