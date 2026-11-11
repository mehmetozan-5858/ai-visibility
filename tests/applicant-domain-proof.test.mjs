import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {domainProofRecord,checkDomainTxtProof,matchingApplicantDomain,newDomainProofNonce,domainProofEnabled} from "../lib/applicant-domain-proof.mjs";

const nonce="a".repeat(48);
test("proof uses cryptographically random 24-byte challenge and exact DNS TXT record",async()=>{
 assert.match(newDomainProofNonce(),/^[0-9a-f]{48}$/);
 const expected=domainProofRecord("https://www.example.com",nonce);
 assert.deepEqual(expected,{record:"_aiv-verify.example.com",value:"aiv-lead="+nonce});
 assert.equal(await checkDomainTxtProof("example.com",nonce,{lookup:async()=>[["aiv-lead="+nonce]]}),true);
 assert.equal(await checkDomainTxtProof("example.com",nonce,{lookup:async()=>[["aiv-lead=other"]]}),false);
 assert.equal(await checkDomainTxtProof("example.com",nonce,{lookup:async()=>{throw Error("ENOTFOUND")}}),false);
});
test("domain ownership proof cannot be substituted with another domain or a user claim",()=>{
 assert.equal(matchingApplicantDomain({website:"https://example.com"},{domain:"www.example.com"}),"example.com");
 assert.equal(matchingApplicantDomain({website:"https://example.com"},{domain:"other.example"}),null);
 assert.throws(()=>domainProofRecord("http://127.0.0.1",nonce),/invalid-domain-proof|./);
});
test("feature disabled unless explicitly enabled",()=>{
 const old=process.env.APPLICANT_DOMAIN_PROOF_ENABLED;delete process.env.APPLICANT_DOMAIN_PROOF_ENABLED;
 try{assert.equal(domainProofEnabled(),false)}finally{if(old===undefined)delete process.env.APPLICANT_DOMAIN_PROOF_ENABLED;else process.env.APPLICANT_DOMAIN_PROOF_ENABLED=old}
});
test("admin proof route is protected, rechecks verified email and persisted DNS, no automatic access or email",async()=>{
 const source=await readFile(new URL("../app/api/admin/applicant-domain-proof/route.js",import.meta.url),"utf8");
 assert.match(source,/await requireAdmin\(req\)/);
 assert.match(source,/enforceSameOrigin\(req\)/);
 assert.match(source,/domainProofEnabled\(\)/);
 assert.match(source,/checkDomainTxtProof\(challenge\.domain,challenge\.nonce\)/);
 assert.match(source,/verified_at IS NOT NULL AND c\.consumed_at IS NOT NULL/);
 assert.match(source,/matchingApplicantDomain\(current,/);
 assert.match(source,/ON CONFLICT DO NOTHING RETURNING lead_id/);
 assert.match(source,/accessGranted:false,tokenIssued:false,providerCalled:false/);
 assert.doesNotMatch(source,/sendVerificationEmail|sendLeadVerificationEmail|Paddle\.Checkout|createApplicantAssessmentGrant/);
});
test("challenge schema is one per lead and expiry-bounded",async()=>{
 const sql=await readFile(new URL("../migrations/applicant-domain-challenges-review.sql",import.meta.url),"utf8");
 assert.match(sql,/lead_id UUID PRIMARY KEY/);
 assert.match(sql,/applicant_domain_nonce_format/);
 assert.match(sql,/applicant_domain_expiry_order/);
});
