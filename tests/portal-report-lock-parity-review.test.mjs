import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PILOT_LOCK_SQL,REPORT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// REVIEW ONLY. Prevent future drift between cooperative writer and report lock.
// This is a source contract, NOT a substitute for PostgreSQL race acceptance.
const migration=await readFile(new URL('../migrations/portal-one-time-explicit-envelope-review.sql',import.meta.url),'utf8');
const writerKey='portal-pilot-lock-v1:';
const reportFn=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.portal_verified_one_time_envelope_review('));

test('report and writer use identical advisory lock namespace and hash seed',()=>{
 assert.ok(PILOT_LOCK_SQL.includes(writerKey));
 assert.ok(REPORT_LOCK_SQL.includes(writerKey));
 assert.ok(reportFn.includes(REPORT_LOCK_SQL.trim()),
  'real review report RPC must take same tenant advisory lock');
 assert.match(PILOT_LOCK_SQL,/hashtextextended\([\s\S]*?,0\)/);
 assert.match(REPORT_LOCK_SQL,/hashtextextended\([\s\S]*?,0\)/);
 assert.match(PILOT_LOCK_SQL,/\$1::uuid::text/);
 assert.match(REPORT_LOCK_SQL,/p_tenant::text/);
});

test('report locks before tenant and pilot reads and uses fresh expiration clock',()=>{
 const lock=reportFn.indexOf(REPORT_LOCK_SQL.trim());
 const clientRead=reportFn.indexOf('FROM public.clients c');
 const pilotRead=reportFn.indexOf('FROM public.client_pilot_access pilot');
 const reportRead=reportFn.indexOf('FROM public.ai_provider_comparisons');
 assert.ok(lock>=0 && clientRead>lock && pilotRead>clientRead && reportRead>pilotRead,
  'report must check current client/pilot entitlement after acquiring lock');
 assert.match(reportFn,/pilot\.expires_at>clock_timestamp\(\)/,
  'pilot expiry must be compared using a fresh database timestamp');
 assert.match(reportFn,/pilot\.revoked_at IS NULL/);
 assert.match(reportFn,/c\.status='active'/);
 assert.match(reportFn,/RETURN QUERY SELECT true,p_tenant/,
  'report must return authorized envelope only after entitlement checks');
});

test('no false evidence of paid entitlement from legacy account labels',()=>{
 assert.match(reportFn,/Paid Paddle entitlement is intentionally/);
 assert.doesNotMatch(reportFn,/FROM public\.payments\b/);
 assert.doesNotMatch(reportFn,/FROM public\.verified_customer_settlements\b/);
});
