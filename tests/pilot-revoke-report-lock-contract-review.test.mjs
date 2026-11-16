import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('review report locks exactly the same pilot row that revokePilot updates',async()=>{
 const [migration,pilot,reader]=await Promise.all([
  load('migrations/portal-one-time-signed-report-review.sql'),
  load('lib/pilot-access.js'),
  load('lib/one-time-db-report-review.mjs')
 ]);
 const lock= migration.indexOf('PERFORM 1 FROM public.client_pilot_access pilot');
 const consume=migration.indexOf('INSERT INTO portal_authz.consumed_claims');
 assert.ok(lock>=0 && consume>lock,'pilot lock must precede nonce consumption');
 const query=migration.slice(lock,consume);
 assert.match(query,/pilot\.client_id=p_tenant/);
 assert.match(query,/pilot\.revoked_at IS NULL/);
 assert.match(query,/pilot\.expires_at>clock_timestamp\(\) FOR SHARE/);
 assert.match(query,/IF NOT FOUND THEN RETURN; END IF;/);
 // FOR SHARE is an alternative uninstalled draft. The current pilot writer
 // uses advisory locks; the two designs must not be considered compatible
 // or production ready until a matching report function is installed.
 assert.match(pilot,/grantPilotWithLockReview\(pool\(\),clientId,email,days,reason\)/);
 assert.match(pilot,/revokePilotWithLockReview\(pool\(\),clientId\)/);
 assert.match(reader,/BEGIN ISOLATION LEVEL READ COMMITTED/);
 assert.match(reader,/SET LOCAL lock_timeout = '2500ms'/);
 assert.match(reader,/SET LOCAL statement_timeout = '10000ms'/);
 assert.match(reader,/await tx\.query\('ROLLBACK'\)/);
 assert.match(reader,/tx\.release\(\)/);
});

test('pilot-only report migration never falls back to historical paid labels',async()=>{
 const [migration,reader]=await Promise.all([
  load('migrations/portal-one-time-signed-report-review.sql'),
  load('lib/one-time-db-report-review.mjs')
 ]);
 assert.match(reader,/proof\.source!=='verified-pilot'/);
 const functionBody=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION'));
 assert.doesNotMatch(functionBody,/\bFROM\s+public\.payments\b/i);
 assert.doesNotMatch(functionBody,/\bFROM\s+public\.verified_customer_settlements\b/i);
 assert.match(functionBody,/IF NOT FOUND THEN RETURN; END IF/);
});

// Static contract check only: not evidence of actual two-connection contention,
// committed revocation timing, or post-owner-transfer PostgreSQL execution.
