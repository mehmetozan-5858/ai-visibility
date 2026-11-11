import test from "node:test";
import assert from "node:assert/strict";
import {evaluateApplicantAssessmentLink as evaluate} from "../lib/applicant-assessment-link-policy.mjs";
const lid="11111111-1111-4111-8111-111111111111",pid="22222222-2222-4222-8222-222222222222",rid="33333333-3333-4333-8333-333333333333";
const valid=()=>({
 lead:{id:lid,email:"applicant@example.test",website:"https://www.example.com/"},
 challenge:{leadId:lid,email:"applicant@example.test",verifiedAt:"2026-11-10T12:00:00Z",consumedAt:"2026-11-10T12:00:00Z"},
 prospect:{id:pid,domain:"example.com"},
 ownership:{leadId:lid,prospectId:pid,reviewId:rid,domain:"example.com",status:"verified",source:"trusted-server-review",verifiedAt:"2026-11-10T13:00:00Z"},
 existingLinks:[]
});
test("reviewed binding is only identity, never account/token or execution",()=>{
 const r=evaluate(valid());assert.equal(r.allowed,true);
 assert.equal(r.createsAccount,false);assert.equal(r.issuesToken,false);assert.equal(r.startsProvider,false);
});
test("unverified inbox or applicant email mismatches deny",()=>{
 for(const edit of [{challenge:null},{challenge:{leadId:lid,email:"other@example.test",verifiedAt:"now",consumedAt:"now"}},
   {challenge:{leadId:lid,email:"applicant@example.test",verifiedAt:null,consumedAt:null}}]){
  assert.equal(evaluate({...valid(),...edit}).allowed,false);
 }
});
test("matched website does not prove domain ownership",()=>{
 const a=valid();a.ownership=null;assert.equal(evaluate(a).reason,"business-ownership-unverified");
 const b=valid();b.ownership.source="applicant-claim";assert.equal(evaluate(b).allowed,false);
});
test("domain mismatch, revocation and conflicting prior claims deny",()=>{
 const a=valid();a.prospect.domain="different.example";assert.equal(evaluate(a).reason,"domain-mismatch");
 const b=valid();b.existingLinks=[{leadId:"44444444-4444-4444-8444-444444444444",prospectId:pid}];assert.equal(evaluate(b).reason,"conflicting-link");
 const c=valid();c.ownership.status="revoked";assert.equal(evaluate(c).allowed,false);
});
