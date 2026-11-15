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
