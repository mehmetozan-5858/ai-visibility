import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../review/sql/portal-pilot-report-revocation-gate.sql',import.meta.url),'utf8');

test('pilot-only RPC requires signed, bounded, one-time claim',()=>{
 assert.match(sql,/p_mac !~ '\^\[0-9a-f\]\{64\}\$'/);
 assert.match(sql,/p_expires<v_now OR p_expires>v_now\+300/);
 assert.match(sql,/portal_authz_trial\.hmac\(/);
 assert.match(sql,/p_mac<>v_expected/);
 assert.match(sql,/ON CONFLICT\(claim_id\) DO NOTHING/);
 assert.match(sql,/IF v_consumed IS NULL THEN RETURN/);
});
test('pilot report refuses revoked, expired and suspended tenants',()=>{
 assert.match(sql,/JOIN public\.client_pilot_access a ON a\.client_id=c\.id/);
 assert.match(sql,/c\.status='active'/);
 assert.match(sql,/a\.revoked_at IS NULL/);
 assert.match(sql,/a\.expires_at>clock_timestamp\(\)/);
 assert.ok(sql.indexOf('a.revoked_at IS NULL')<sql.indexOf('INSERT INTO portal_authz_trial.consumed_claims'));
});
test('pilot read participates in the shared tenant advisory lock',()=>{
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/portal-pilot-lock-v1:/);
 assert.ok(sql.indexOf('pg_advisory_xact_lock')<sql.indexOf('a.revoked_at IS NULL'));
});
test('review candidate does not overwrite production RPC or grant execute',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.portal_trial_one_time_report_pilot_review\(/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.portal_trial_one_time_report\(/);
 assert.doesNotMatch(sql,/^\s*GRANT\s+EXECUTE\b/im);
 assert.match(sql,/REVIEW ONLY/);
});
test('tenant-scoped bounded report query',()=>{
 assert.match(sql,/WHERE r\.client_id=p_tenant/);
 assert.match(sql,/ORDER BY r\.created_at DESC LIMIT 20/);
});

test('review RPC explicitly revokes PostgreSQL default PUBLIC execute privilege',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.portal_trial_one_time_report_pilot_review\(uuid,bigint,uuid,text\) FROM PUBLIC;/);
 assert.match(sql,/CREATE and REVOKE atomically/);
});
