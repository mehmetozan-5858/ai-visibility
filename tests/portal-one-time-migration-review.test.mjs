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

test('pilot read holds tenant row locks across nonce consumption',async()=>{
 const s=await read();
 const fn=s.slice(s.indexOf('CREATE OR REPLACE FUNCTION public.portal_verified_one_time_report'));
 const clientLock=fn.indexOf("PERFORM 1 FROM public.clients c");
 const pilotLock=fn.indexOf("PERFORM 1 FROM public.client_pilot_access pilot");
 const nonceWrite=fn.indexOf("INSERT INTO portal_authz.consumed_claims");
 assert.ok(clientLock>=0&&pilotLock>clientLock&&nonceWrite>pilotLock,
  'client then pilot locks must precede nonce write');
 assert.match(fn,/c\\.status='active' FOR SHARE/);
 assert.match(fn,/pilot\\.expires_at>clock_timestamp\\(\\) FOR SHARE/);
 assert.match(fn,/IF NOT FOUND THEN RETURN; END IF;/);
 assert.ok(fn.indexOf("pilot.revoked_at IS NULL")<nonceWrite);
 assert.match(fn,/Recheck expiration after any lock wait/);
 assert.match(fn,/explicit pinned-connection transaction/);
});

test('one-time function requires active customer, signature and atomic nonce consumption',async()=>{
 const s=await read();
 assert.match(s,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(s,/portal-one-time-report-v1\|/);
 assert.match(s,/portal_authz\.hmac/);
 assert.match(s,/p_expires<v_now OR p_expires>v_now\+90/);
 assert.match(s,/c\.status='active'/);
 assert.match(s,/public\.client_pilot_access pilot/);
 assert.match(s,/pilot\.client_id=p_tenant/);
 assert.match(s,/pilot\.revoked_at IS NULL/);
 assert.match(s,/pilot\.expires_at>clock_timestamp\(\)/);
 assert.ok(s.indexOf('pilot.revoked_at IS NULL')<s.indexOf('INSERT INTO portal_authz.consumed_claims'),
  'revoked pilot is checked before nonce consumption');
 assert.doesNotMatch(s,/p\.status='paid'|legacy_paid|bank_transfer/i);
 assert.match(s,/ON CONFLICT\(claim_id\) DO NOTHING RETURNING claim_id INTO v_consumed/);
 assert.match(s,/IF v_consumed IS NULL THEN RETURN/);
 assert.match(s,/WHERE c\.client_id=p_tenant ORDER BY c\.created_at DESC LIMIT 20/);
 assert.doesNotMatch(s,/current_setting\('app\.tenant_id'/);
});
