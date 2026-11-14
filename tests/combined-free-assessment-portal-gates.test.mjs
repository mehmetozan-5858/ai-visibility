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
 assert.doesNotMatch(route,/\bFROM\s+(?:public\.)?answer_evidence_runs\b|\baccountHasPaidAccess\s*\(|\bCUSTOMER_SETTLEMENT_PROOF_ENABLED\b/);
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

test('customer account read does not trigger schema changes through repository wrapper',async()=>{
 const repository=await read('lib/repository.js');
 assert.match(repository,/async function withDb\(fn,\{ensureSchema=true\}=\{\}\)/);
 assert.match(repository,/if\(ensureSchema\)\{await initializeSchema\(pool,"repository",ensure\);await ensureWorkEvidence\(pool\)\}/);
 const start=repository.indexOf('export async function getClientAccount(clientId){');
 const end=repository.indexOf('export async function getPaymentByMerchantOid(',start);
 assert.ok(start>=0&&end>start);
 const method=repository.slice(start,end);
 assert.match(method,/\},\{ensureSchema:false\}\)\|\|null/);
 assert.doesNotMatch(method,/\bINSERT\b|\bUPDATE\b|\bCREATE\b|\bALTER\b|\bDELETE\b/i);
});

test('customer profile reads do not create or alter schema',async()=>{
 const src=await read('lib/client-profile.js');
 assert.match(src,/async function withDb\(fn,\{ensureSchema=true\}=\{\}\)/);
 assert.match(src,/if\(ensureSchema\)\{await pool\.query/);
 for(const [start,end] of [
  ['export async function getClientProfile(clientId){','export async function listClientProfiles(){'],
  ['export async function listClientProfiles(){',null]
 ]){
  const a=src.indexOf(start),b=end?src.indexOf(end,a):src.length;
  assert.ok(a>=0&&b>a);
  const body=src.slice(a,b);
  assert.match(body,/ensureSchema:false/);
  assert.doesNotMatch(body,/\bCREATE\b|\bALTER\b|\bUPDATE\b|\bINSERT\b|\bDELETE\b/i);
 }
 const writer=src.slice(src.indexOf('export async function upsertClientProfile('),src.indexOf('export async function getClientProfile('));
 assert.match(writer,/INSERT INTO client_profiles/);
 assert.doesNotMatch(writer,/ensureSchema:false/);
});
