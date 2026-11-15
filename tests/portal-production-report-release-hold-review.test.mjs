import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: repository source guard, NOT an HTTP request, Neon inspection,
// deployed configuration check, customer session acceptance or release approval.
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('production customer portal remains unconnected to signed report review gateway',async()=>{
 const [live,gateway,sql]=await Promise.all([
  source('app/api/client-portal/route.js'),
  source('lib/portal-envelope-gateway-review.mjs'),
  source('migrations/portal-one-time-explicit-envelope-review.sql')
 ]);
 assert.match(gateway,/REVIEW ONLY/);
 assert.match(sql,/NEVER AUTO-APPLY/);
 assert.match(gateway,/portal_verified_one_time_envelope_review/);
 assert.doesNotMatch(live,/createEnvelopeGatewayReview|readEnvelopeFromVerifiedSession|portal_verified_one_time_envelope_review|PORTAL_REPORT_CLAIM_SECRET/);
 // Keep any future integration as a separate reviewed rollout; source-only
 // evidence must never label a real customer's report as accepted.
 assert.match(live,/PORTAL_TENANT_RLS_ENABLED/);
});

test('strict report path fails closed when RLS identity is forgeable',async()=>{
 const [live,policy]=await Promise.all([
  source('app/api/client-portal/route.js'),
  source('lib/portal-report-rls-readiness.mjs')
 ]);
 assert.match(policy,/comparison-tenant-setting-forgeable/);
 assert.match(policy,/return \{ready:false,reason:'comparison-tenant-setting-forgeable'\}/);
 const strict=live.indexOf("if(process.env.PORTAL_TENANT_RLS_ENABLED==='true')");
 const permission=live.indexOf('inspectPortalReaderPrivileges(reader)',strict);
 const rls=live.indexOf('inspectComparisonRlsPolicy(reader)',permission);
 const refusal=live.indexOf("if(!rls.ready)return privateJson",rls);
 const report=live.indexOf('withVerifiedClientTenantRead(reader',refusal);
 assert.ok(strict>=0&&permission>strict&&rls>permission&&refusal>rls&&report>refusal,
  'strict portal cannot query reports after a failed reader/RLS preflight');
 const branchEnd=live.indexOf('}else{',report);
 assert.ok(branchEnd>report,'legacy branch must remain separate from strict path');
 assert.doesNotMatch(live.slice(strict,branchEnd),/readCustomerComparisonReport\(databasePool\(getDatabaseUrl\(\)\)/,
  'strict path must not fall back to broad app DB on denial');
});
