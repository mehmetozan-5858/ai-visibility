import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Review-only contract. Static checks do NOT prove execution, role permissions,
// two-backend transaction ordering, or safe deployment to isolated/production Neon.
const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const canonical='portal-pilot-lock-v1:';
const stale='portal-pilot-v1:';

test('pilot grant/revoke, candidate report SQL, and design use one lock namespace',async()=>{
  const [pilot,sql,design]=await Promise.all([
    load('lib/pilot-access.js'),
    load('docs/security/neon-pilot-revocation-review.sql'),
    load('docs/security/neon-pilot-coordinated-revocation-design.md')
  ]);
  for(const [label,body] of [['pilot writer',pilot],['candidate RPC',sql],['design',design]]){
    assert.ok(body.includes(canonical),label+' lacks canonical lock namespace');
    assert.ok(!body.includes(stale),label+' still references stale lock namespace');
  }
  assert.match(pilot,/pg_advisory_xact_lock/);
  assert.match(sql,/pg_advisory_xact_lock/);
  const lock=sql.indexOf('PERFORM pg_catalog.pg_advisory_xact_lock');
  const account=sql.indexOf('SELECT 1 FROM public.clients c');
  const grant=sql.indexOf('SELECT 1 FROM public.client_pilot_access a');
  const consume=sql.indexOf('INSERT INTO portal_authz_trial.consumed_claims');
  assert.ok(lock>=0&&account>lock&&grant>account&&consume>grant,
    'candidate RPC must lock before authority checks and nonce consumption');
  assert.match(sql,/a\.revoked_at IS NULL/);
  assert.match(sql,/a\.expires_at\s*>\s*clock_timestamp\(\)/);
});

test('unsafe row trigger is still explicitly blocked from execution',async()=>{
  const sql=await load('docs/security/neon-pilot-mutation-trigger-review.sql');
  assert.match(sql,/BLOCKED DESIGN SKETCH \/ NOT A MIGRATION \/ DO NOT EXECUTE/);
  // Do not accidentally treat this uninstalled sketch as coordination proof.
});

test('claim expiry is checked again after an advisory lock wait and before nonce use',async()=>{
  const sql=await load('docs/security/neon-pilot-revocation-review.sql');
  const lock=sql.indexOf('PERFORM pg_catalog.pg_advisory_xact_lock');
  const afterLock=sql.slice(lock);
  const ttl=afterLock.indexOf('v_now := floor(extract(epoch FROM clock_timestamp()))::bigint;');
  const reject=afterLock.indexOf('IF p_expires < v_now OR p_expires > v_now + 300 THEN RETURN; END IF;',ttl);
  const client=afterLock.indexOf('SELECT 1 FROM public.clients c');
  const nonce=afterLock.indexOf('INSERT INTO portal_authz_trial.consumed_claims');
  assert.ok(lock>=0&&ttl>=0&&reject>ttl&&client>reject&&nonce>client,
    'claim must expire closed after lock wait, before authority checks and nonce insertion');
});

test('candidate report replacement blocks permissive TRUE owner RLS before any grant',async()=>{
  const sql=await load('docs/security/neon-pilot-revocation-review.sql');
  const guard=sql.indexOf('DO $rls_guard$');
  const broad=sql.indexOf('pol.polpermissive',guard);
  const raise=sql.indexOf("RAISE EXCEPTION 'blocked: unrestricted report-owner comparison RLS policy'",guard);
  const grant=sql.indexOf('GRANT SELECT (client_id, revoked_at, expires_at)');
  const replace=sql.indexOf('CREATE OR REPLACE FUNCTION public.portal_trial_one_time_report');
  assert.ok(guard>=0&&broad>guard&&raise>broad&&grant>raise&&replace>grant,
    'fail-closed RLS guard must precede any authorization or RPC changes');
  assert.match(sql,/pol\.polroles=ARRAY\[0::oid\]/);
  assert.match(sql,/portal_report_fn_owner_trial_20261115/);
});
