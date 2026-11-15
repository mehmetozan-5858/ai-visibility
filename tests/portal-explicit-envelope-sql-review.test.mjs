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
