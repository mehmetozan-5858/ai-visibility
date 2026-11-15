import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=()=>readFile(new URL('../migrations/portal-one-time-explicit-envelope-review.sql',import.meta.url),'utf8');
test('review-only signed report returns one explicit success envelope even for zero comparisons',async()=>{
 const s=await load();
 assert.match(s,/REVIEW ONLY/);
 assert.match(s,/NEVER AUTO-APPLY/);
 assert.match(s,/RETURNS TABLE\("authorized" BOOLEAN,"tenantId" UUID,"reports" JSONB\)/);
 assert.match(s,/RETURN QUERY SELECT true,p_tenant,COALESCE/);
 assert.match(s,/\[\]'::jsonb/);
 assert.match(s,/client_id=p_tenant ORDER BY created_at DESC LIMIT 20/);
});
test('authorization, tenant lock and one-use claim precede successful report envelope',async()=>{
 const s=await load();
 const lock=s.indexOf("hashtextextended('portal-pilot-lock-v1:'");
 const active=s.indexOf("c.status='active'");
 const pilot=s.indexOf('pilot.revoked_at IS NULL');
 const nonce=s.indexOf('INSERT INTO portal_authz.consumed_claims');
 const verdict=s.indexOf('RETURN QUERY SELECT true,p_tenant,COALESCE');
 assert.ok(lock>0&&active>lock&&pilot>active&&nonce>pilot&&verdict>nonce);
 assert.match(s,/p_mac<>v_expected THEN RETURN/);
 assert.match(s,/v_consumed IS NULL THEN RETURN/);
 assert.match(s,/expires_at>clock_timestamp\(\)/);
});
test('envelope remains uninstalled, no public EXECUTE or broad role grant',async()=>{
 const s=await load();
 assert.match(s,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(s,/REVOKE ALL ON FUNCTION public\.portal_verified_one_time_envelope_review/);
 assert.doesNotMatch(s,/^\s*GRANT\s+EXECUTE/mi);
 assert.doesNotMatch(s,/^\s*CREATE\s+ROLE|^\s*ALTER\s+ROLE|^\s*CREATE\s+EXTENSION/mi);
});

test('SECURITY DEFINER migration cannot commit under privileged migration runner',async()=>{
 const s=await load();
 const create=s.indexOf('CREATE OR REPLACE FUNCTION public.portal_verified_one_time_envelope_review');
 const roleGate=s.indexOf("rolname='portal_report_fn_owner'");
 const alter=s.indexOf('OWNER TO portal_report_fn_owner;');
 const commit=s.lastIndexOf('COMMIT;');
 const firstDdl=s.indexOf('CREATE SCHEMA IF NOT EXISTS portal_authz');
 assert.ok(roleGate>0&&roleGate<firstDdl&&firstDdl<create&&create<alter&&alter<commit,
  'narrow owner preflight must run before ANY DDL; transfer must precede COMMIT');
 for(const flag of ['rolcanlogin','rolsuper','rolbypassrls',
  'rolcreatedb','rolcreaterole','rolreplication'])
  assert.ok(s.includes('r.'+flag+'=false'),'owner privilege guard missing: '+flag);
 assert.match(s,/NOT EXISTS \(SELECT 1 FROM pg_catalog\.pg_auth_members m WHERE m\.member=r\.oid\)/);
 assert.match(s,/NOT has_database_privilege\(r\.oid,current_database\(\),'CREATE'\)/);
 assert.match(s,/NOT has_schema_privilege\(r\.oid,'public','CREATE'\)/);
 assert.match(s,/NOT has_table_privilege\(r\.oid,'public\.client_credentials','SELECT'\)/);
 assert.match(s,/NOT has_table_privilege\(r\.oid,'public\.payments','SELECT'\)/);
 assert.match(s,/RAISE EXCEPTION 'review-report-function-owner-unverified'/);
 assert.match(s,/ALTER FUNCTION public\.portal_verified_one_time_envelope_review\(UUID,BIGINT,UUID,TEXT\)/);
 assert.doesNotMatch(s,/^\s*(?:CREATE|ALTER)\s+ROLE\s+portal_report_fn_owner/mi);
});

test('migration refuses missing private HMAC placement before changing schema',async()=>{
 const s=await load();
 const hmacCheck=s.indexOf("to_regprocedure('portal_authz.hmac(bytea,bytea,text)')");
 const firstDdl=s.indexOf('CREATE SCHEMA IF NOT EXISTS portal_authz');
 const ownerCheck=s.indexOf("rolname='portal_report_fn_owner'");
 assert.ok(ownerCheck>0&&hmacCheck>ownerCheck&&hmacCheck<firstDdl);
 assert.match(s,/RAISE EXCEPTION 'review-report-hmac-placement-unverified'/);
 assert.match(s,/e\.extname='pgcrypto'/);
 assert.match(s,/has_schema_privilege\(r\.oid,'portal_authz','USAGE'\)/);
 assert.match(s,/has_function_privilege\(r\.oid,p\.oid,'EXECUTE'\)/);
 assert.doesNotMatch(s,/^\s*CREATE\s+EXTENSION|^\s*ALTER\s+EXTENSION/mi);
 assert.doesNotMatch(s,/to_regprocedure\('portal_authz_trial\.hmac/,
  'trial-only HMAC cannot masquerade as proposed private function placement');
});
