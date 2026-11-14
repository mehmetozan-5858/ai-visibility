import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('free assessment requires a signed preview and receipt-linked evidence, never a client paid label',async()=>{
 const route=await read('app/api/free-assessment/route.js');
 assert.match(route,/verifyFreeAssessmentToken\(req\.headers\.get\('x-preview-token'\)\)/);
 assert.match(route,/readVerifiedFreeApplicantAssessment\(pool,entity\)/);
 assert.match(route,/assessment=proof\.status==='ready'\?proof/);
 assert.match(route,/score:null,status:'insufficient'/);
 assert.doesNotMatch(route,/answer_evidence_runs|accountHasPaidAccess|CUSTOMER_SETTLEMENT_PROOF_ENABLED/);
});

test('verified applicant link authorizes scope but not paid portal access, for both JSON and PDF',async()=>{
 const route=await read('app/api/applicant-assessment/route.js');
 assert.match(route,/verifyApplicantAssessmentGrant/);
 assert.match(route,/emailVerifiedAt/);
 assert.match(route,/emailConsumedAt/);
 assert.match(route,/readVerifiedFreeApplicantAssessment\(pool,row\)/);
 assert.match(route,/buildApplicantAssessmentPdf\(\{business,assessment,language\}\)/);
 assert.match(route,/paidAccess:false,providerCallStarted:false/);
 assert.doesNotMatch(route,/grantPilot|createClientToken|INSERT INTO payments/);
});

test('password session does not by itself authorize a paid customer report',async()=>{
 const login=await read('app/api/client-auth/login/route.js');
 const portal=await read('app/api/client-portal/route.js');
 assert.match(login,/verifyClientCredential/);
 assert.match(login,/createClientToken/);
 assert.doesNotMatch(login,/grantPilot|verified_customer_settlements|customerHasVerifiedSettlement/);
 assert.match(portal,/verifyClientToken/);
 assert.match(portal,/customerAccess\(account\)/);
 assert.match(portal,/if\(!access\.allowed\)return privateJson/);
 assert.match(portal,/readCustomerComparisonReport/);
});

test('free applicant verified proof read is scoped, recent and non-mutating',async()=>{
 const source=await read('lib/free-applicant-verified-db-read.mjs');
 assert.match(source,/WHERE o\.tenant_id=\$1 AND o\.domain=\$2/);
 assert.match(source,/INTERVAL '14 days'/);
 assert.match(source,/free_applicant_verified_receipts/);
 assert.match(source,/free_applicant_verified_observations/);
 assert.doesNotMatch(source,/pool\.query\(\s*[`'"]\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i);
 assert.match(source,/catch\s*\{\s*return unavailable;/);
});
