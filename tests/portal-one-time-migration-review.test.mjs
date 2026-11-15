import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=()=>readFile(new URL('../migrations/portal-one-time-signed-report-review.sql',import.meta.url),'utf8');

test('review migration is non-operative until separate secret and role approvals',async()=>{
 const s=await read();
 assert.match(s,/REVIEW ONLY/);
 assert.match(s,/BEGIN;[\s\S]*COMMIT;/);
 assert.match(s,/REVOKE ALL ON SCHEMA portal_authz FROM PUBLIC/);
 assert.match(s,/REVOKE ALL ON TABLE portal_authz\.signing_keys FROM PUBLIC/);
 assert.match(s,/REVOKE ALL ON TABLE portal_authz\.consumed_claims FROM PUBLIC/);
 assert.match(s,/REVOKE ALL ON FUNCTION public\.portal_verified_one_time_report\(UUID,BIGINT,UUID,TEXT\) FROM PUBLIC/);
 assert.doesNotMatch(s,/^\s*GRANT\s+EXECUTE/mi);
 assert.doesNotMatch(s,/^\s*INSERT\s+INTO\s+portal_authz\.signing_keys/mi);
 assert.doesNotMatch(s,/^\s*CREATE\s+ROLE|^\s*ALTER\s+ROLE|^\s*CREATE\s+EXTENSION/mi);
});

test('one-time function requires active customer, signature and atomic nonce consumption',async()=>{
 const s=await read();
 assert.match(s,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(s,/portal-one-time-report-v1\|/);
 assert.match(s,/portal_authz\.hmac/);
 assert.match(s,/p_expires<v_now OR p_expires>v_now\+90/);
 assert.match(s,/c\.status='active'/);
 assert.match(s,/ON CONFLICT\(claim_id\) DO NOTHING RETURNING claim_id INTO v_consumed/);
 assert.match(s,/IF v_consumed IS NULL THEN RETURN/);
 assert.match(s,/WHERE c\.client_id=p_tenant ORDER BY c\.created_at DESC LIMIT 20/);
 assert.doesNotMatch(s,/current_setting\('app\.tenant_id'/);
});
