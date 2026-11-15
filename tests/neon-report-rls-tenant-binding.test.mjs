import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('report tenant GUC derives from authenticated scoped tenant after lock and eligibility checks',async()=>{
 const sql=await read('docs/security/neon-pilot-revocation-review.sql');
 const mac=sql.indexOf('IF p_mac <> v_expected THEN RETURN; END IF;');
 const lock=sql.indexOf('PERFORM pg_catalog.pg_advisory_xact_lock(');
 const pilot=sql.indexOf('FROM public.client_pilot_access a');
 const set=sql.indexOf("set_config('app.tenant_id', p_tenant::text, true)");
 const query=sql.indexOf('FROM public.ai_provider_comparisons c');
 const reset=sql.indexOf("set_config('app.tenant_id', '', true)");
 assert.ok(mac>0&&lock>mac&&pilot>lock&&set>pilot&&query>set&&reset>query);
 assert.match(sql,/WHERE c\.client_id = p_tenant/);
});

test('RLS owner policy change is fail-closed and has rollback rather than standalone commit',async()=>{
 const sql=await read('docs/security/neon-pilot-rls-owner-policy-replacement-review.sql');
 const pre=sql.indexOf('DO $preflight$');
 const drop=sql.indexOf('DROP POLICY portal_fn_owner_read_synthetic');
 const rollback=sql.lastIndexOf('ROLLBACK;');
 assert.ok(pre>=0&&drop>pre&&rollback>drop);
 assert.match(sql,/relforcerowsecurity/);
 assert.match(sql,/portal_verified_tenant_comparison_select/);
 assert.match(sql,/rolbypassrls OR rolcanlogin/);
 const statementLines=sql.split('\n').filter(l=>/^\s*COMMIT\s*;/i.test(l));
 assert.equal(statementLines.length,0,'review script must not allow standalone committed policy change');
});
