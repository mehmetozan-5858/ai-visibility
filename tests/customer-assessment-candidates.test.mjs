import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {findAssessmentCandidates,normalizedBusinessDomain} from "../lib/customer-assessment-candidates.mjs";

test("normalizes only safe bare domains and site roots",()=>{
 assert.equal(normalizedBusinessDomain("https://www.Example.COM/"),"example.com");
 assert.equal(normalizedBusinessDomain("example.com"),"example.com");
 for(const url of ["","http://user:pass@example.com","https://example.com/path","https://example.com?key=secret","javascript:alert(1)","http://localhost"]){
  assert.equal(normalizedBusinessDomain(url),null,url);
 }
});
test("no website or no exact match never grants a prospect",()=>{
 const rows=findAssessmentCandidates([{id:"l1",status:"new",website:""},{id:"l2",status:"new",website:"https://unknown.example"}],[{id:"p1",domain:"example.com"}]);
 assert.equal(rows[0].state,"missing-verifiable-domain");
 assert.equal(rows[1].state,"no-exact-match");
 assert.equal(rows[1].candidateProspectId,null);
});
test("exact domain generates only manual review and no access",()=>{
 const result=findAssessmentCandidates([{id:"l1",status:"qualified",website:"https://www.example.com/"}],[{id:"p1",domain:"example.com"}])[0];
 assert.equal(result.candidateProspectId,"p1");
 assert.equal(result.state,"manual-ownership-verification-required");
 assert.equal(result.verifiedOwnership,false);
 assert.equal(result.accessGranted,false);
 assert.equal(result.assessmentReady,false);
});
test("duplicate domain candidates fail closed",()=>{
 const result=findAssessmentCandidates([{id:"l1",status:"new",website:"example.com"}],[{id:"p1",domain:"https://example.com"},{id:"p2",domain:"www.example.com"}])[0];
 assert.equal(result.state,"ambiguous-match");
 assert.equal(result.candidateProspectId,null);
});
test("route requires admin and never creates an account, grant, scan or token",async()=>{
 const source=await readFile(new URL("../app/api/admin/customer-assessment-review/route.js",import.meta.url),"utf8");
 assert.match(source,/await requireAdmin\(req\)/);
 assert.match(source,/export async function GET/);
 assert.doesNotMatch(source,/export async function POST/);
 assert.doesNotMatch(source,/createFreeAssessmentToken|grantPilot|createClientCredential|addProspect|sendVerificationEmail/);
 assert.match(source,/tokenIssued:false,analysisStarted:false/);
});


test("verified inbox is necessary but never enough to grant domain ownership",()=>{
 const original={id:"l1",status:"qualified",website:"example.com"};
 const prospect={id:"p1",domain:"example.com"};
 const pending=findAssessmentCandidates([original],[prospect])[0];
 assert.equal(pending.emailVerified,false);
 assert.equal(pending.readyForOwnershipReview,false);
 const verified=findAssessmentCandidates([{...original,emailVerified:true}],[prospect])[0];
 assert.equal(verified.emailVerified,true);
 assert.equal(verified.readyForOwnershipReview,true);
 assert.equal(verified.verifiedOwnership,false);
 assert.equal(verified.accessGranted,false);
 assert.equal(verified.assessmentReady,false);
});
test("admin review reads verified marker only from server-side challenge and fails closed if no table",async()=>{
 const source=await readFile(new URL("../app/api/admin/customer-assessment-review/route.js",import.meta.url),"utf8");
 assert.match(source,/to_regclass\('public\.lead_email_challenges'\)/);
 assert.match(source,/c\.verified_at IS NOT NULL AND c\.consumed_at IS NOT NULL/);
 assert.match(source,/c\.email=lower\(l\.email\)/);
 assert.match(source,/false AS "emailVerified"/);
});
