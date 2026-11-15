import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Review-only cross-check: isolated Neon trial function is NOT the migration
// candidate and must never be used as evidence that pilot lock/revoke races pass.
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('proposed pilot-locked one-time report differs materially from existing Neon trial',async()=>{
 const [migration,gateway]=await Promise.all([
  load('migrations/portal-one-time-signed-report-review.sql'),
  load('lib/one-time-db-report-review.mjs')
 ]);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.portal_verified_one_time_report\(/i);
 assert.match(migration,/FROM public\.clients[\s\S]*?FOR SHARE/i);
 assert.match(migration,/FROM public\.client_pilot_access[\s\S]*?FOR SHARE/i);
 assert.match(migration,/revoked_at IS NULL/i);
 assert.match(migration,/expires_at>clock_timestamp\(\)/i);
 assert.match(migration,/portal_authz\.consumed_claims/i);
 assert.match(gateway,/portal_trial_one_time_report/);
 assert.doesNotMatch(gateway,/portal_verified_one_time_report/);
 // This explicitly detects migration/gateway mismatch as a HOLD condition.
});

test('test-branch SQL owner privileges cannot establish FOR SHARE acceptance yet',async()=>{
 const [helper,testDoc]=await Promise.all([
  load('lib/one-time-lock-privilege-review.mjs'),
  load('docs/neon-signed-claim-db-boundary-trial-20261115.md')
 ]);
 assert.match(helper,/clientLockUpdate/);
 assert.match(helper,/pilotLockUpdate/);
 assert.match(helper,/readerClientUpdate/);
 assert.match(helper,/readerPilotUpdate/);
 assert.match(testDoc,/FOR SHARE/);
 assert.match(testDoc,/HOLD|BLOCKED/);
});

test('review migrations never silently grant gateway role payment or credential access',async()=>{
 const migration=await load('migrations/portal-one-time-signed-report-review.sql');
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.portal_verified_one_time_report/i);
 assert.match(migration,/no reader role or EXECUTE GRANT/i);
 assert.doesNotMatch(migration,/GRANT\s+(ALL|UPDATE|INSERT|DELETE)\s+ON\s+(TABLE\s+)?public\.(clients|client_pilot_access|payments|client_credentials)/i);
});
