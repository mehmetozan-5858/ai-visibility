import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: compile-time/source release guard, not production verification.
// The existing password/session path is real, but the signed one-time envelope
// and independently verified paid entitlement are NOT accepted live releases.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('existing-password customer login never substitutes reset or caller tenant',async()=>{
 const [route,credentials]=await Promise.all([
  read('app/api/client-auth/login/route.js'),
  read('lib/client-credentials.js')
 ]);
 const verification=route.indexOf('verifyClientCredential(body?.email||"",body?.password||"")');
 const token=route.indexOf('createClientToken(credential.clientId)');
 assert.ok(verification>=0&&token>verification,
  'customer cookie must be created only after existing-password verification');
 assert.match(route,/HttpOnly; Secure; SameSite=Strict/);
 assert.match(route,/enforceSameOrigin\(req\)/);
 assert.doesNotMatch(route,/resetClientPassword|createClientCredential|body\?\.clientId/);
 assert.match(credentials,/export async function verifyClientCredential\(email,password\)/);
 assert.match(credentials,/verifyHash\(password,row\.passwordHash\)/);
});

test('panel and PDF retain an explicit strict-mode gate and cannot silently downgrade',async()=>{
 for(const path of ['app/api/client-portal/route.js','app/api/client-portal/report/route.js']){
  const route=await read(path);
  const auth=route.indexOf('verifyClientToken(');
  const entitlement=route.indexOf('customerAccess(account)');
  const strict=route.indexOf("process.env.PORTAL_TENANT_RLS_ENABLED==='true'");
  const reader=route.indexOf('portalReadDatabaseEnabled()',strict);
  const policy=route.indexOf('inspectComparisonRlsPolicy(reader)',reader);
  const denial=route.indexOf('if(!rls.ready)return privateJson',policy);
  const tenant=route.indexOf('withVerifiedClientTenantRead(reader',denial);
  assert.ok(auth>=0&&entitlement>auth&&strict>entitlement&&
    reader>strict&&policy>reader&&denial>policy&&tenant>denial,
    path+' must retain signed session, entitlement and fail-closed reader checks');
  assert.match(route,/private, no-store, max-age=0/);
  assert.doesNotMatch(route,/createEnvelopeGatewayReview|portal_verified_one_time_envelope_review/);
 }
});

test('review-only envelope cannot be mistaken for currently deployed customer report',async()=>{
 const [panel,pdf,gateway,rls]=await Promise.all([
  read('app/api/client-portal/route.js'),
  read('app/api/client-portal/report/route.js'),
  read('lib/portal-envelope-gateway-review.mjs'),
  read('lib/portal-report-rls-readiness.mjs')
 ]);
 assert.match(gateway,/REVIEW ONLY/);
 assert.match(rls,/comparison-tenant-setting-forgeable/);
 assert.match(rls,/return \{ready:false,reason:'comparison-tenant-setting-forgeable'\}/);
 assert.match(panel,/evidenceClass:'historical',verifiedProviderEvidence:false/);
 assert.match(panel,/readCustomerComparisonReport\(databasePool\(getDatabaseUrl\(\)\),session\.clientId\)/);
 assert.match(pdf,/readCustomerComparisonReport\(databasePool\(getDatabaseUrl\(\)\),session\.clientId\)/);
});

test('review branch requires independent proof for paid labels; production release still gated',async()=>{
 const [pilot,strict]=await Promise.all([
  read('lib/pilot-access.js'),
  read('lib/portal-report-entitlement.mjs')
 ]);
 assert.doesNotMatch(pilot,/CUSTOMER_SETTLEMENT_PROOF_ENABLED/);
 assert.match(pilot,/return \{allowed:true,kind:'paid'\}/);
 assert.match(pilot,/customerHasVerifiedSettlement\(account\.client\.id\)/);
 assert.match(strict,/strictReportEntitlementReady/);
 // The fallback is intentionally detected, not authorized by this test.
 // Do not release until a separately verified settlement path replaces it.
});
