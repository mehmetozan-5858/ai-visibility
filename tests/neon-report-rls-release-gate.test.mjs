import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('review SQL blocks unrestricted report owner RLS before GRANT or function replacement',async()=>{
 const sql=await readFile(new URL('../docs/security/neon-pilot-revocation-review.sql',import.meta.url),'utf8');
 const guard=sql.indexOf('DO $rls_guard$');
 const unrestricted=sql.indexOf("pg_catalog.pg_get_expr(pol.polqual,pol.polrelid)='true'");
 const raise=sql.indexOf("RAISE EXCEPTION 'blocked: unrestricted report-owner comparison RLS policy'");
 const grant=sql.indexOf('GRANT SELECT (client_id, revoked_at, expires_at)');
 const replace=sql.indexOf('CREATE OR REPLACE FUNCTION public.portal_trial_one_time_report');
 assert.ok(guard>=0&&unrestricted>guard&&raise>unrestricted,'RLS fail-closed guard missing');
 assert.ok(grant>raise&&replace>grant,'RLS guard must run before proposed privilege or function mutations');
 assert.match(sql,/pol\.polpermissive AND pol\.polcmd IN \('r','\*'\)/);
 assert.match(sql,/portal_report_fn_owner_trial_20261115/);
});

test('read-only Neon preflight reports unsafe unrestricted definer policy',async()=>{
 const sql=await readFile(new URL('../docs/security/neon-pilot-readonly-preflight.sql',import.meta.url),'utf8');
 assert.match(sql,/definer_has_permissive_true_policy/);
 assert.match(sql,/safe_for_release/);
 assert.match(sql,/c\.relforcerowsecurity/);
});

test('preflight inventories legacy SECURITY DEFINER owner RLS bypass and execute exposure',async()=>{
 const sql=await readFile(new URL('../docs/security/neon-pilot-readonly-preflight.sql',import.meta.url),'utf8');
 assert.match(sql,/portal_trial_verified_report/);
 assert.match(sql,/portal_trial_one_time_report/);
 assert.match(sql,/owner_bypasses_rls/);
 assert.match(sql,/gateway_can_execute/);
 assert.match(sql,/public_can_execute/);
 assert.match(sql,/explicit_acl/);
});

test('gateway acceptance requires a real independent authenticated connection',async()=>{
 const sql=await readFile(new URL('../docs/security/neon-pilot-readonly-preflight.sql',import.meta.url),'utf8');
 assert.match(sql,/current_user='portal_gateway_reader_trial_20261114' AS authenticated_gateway_identity/);
 assert.match(sql,/session_user AS session_as/);
 assert.match(sql,/current_role_can_execute/);
 assert.match(sql,/raw_comparisons_blocked/);
 assert.match(sql,/signing_key_read_blocked/);
 assert.match(sql,/Do not run SET ROLE from owner/);
});

test('preflight audits raw reader role membership and mutable tenant context',async()=>{
 const sql=await readFile(new URL('../docs/security/neon-pilot-readonly-preflight.sql',import.meta.url),'utf8');
 assert.match(sql,/RAW COMPARISON READER ROLE REACHABILITY/);
 assert.match(sql,/portal_reader_isolated_20261114/);
 assert.match(sql,/pg_auth_members/);
 assert.match(sql,/comparison_select/);
 assert.match(sql,/isolated_reader_member/);
 assert.match(sql,/customer-reachable login/);
});

test('preflight keeps gateway membership escalation and legacy RPC access closed',async()=>{
 const sql=await readFile(new URL('../docs/security/neon-pilot-readonly-preflight.sql',import.meta.url),'utf8');
 for(const marker of [
  'gateway_raw_comparisons_denied',
  'gateway_not_reader_member',
  'gateway_not_function_owner_member',
  'gateway_new_rpc_granted',
  'gateway_legacy_rpc_denied'
 ])assert.ok(sql.includes(marker),marker);
 assert.match(sql,/pg_has_role\('portal_gateway_reader_trial_20261114'::regrole/);
});
