import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const marker = "portal-pilot-lock-v1:";

test('pilot, payment reversal and report SQL use exactly one tenant lock namespace', async () => {
  const paths = [
    'lib/pilot-access.js',
    'lib/payment-reversal.js',
    'docs/security/neon-pilot-revocation-review.sql',
  ];
  for (const path of paths) {
    const text = await read(path);
    const lockExpressions = [...text.matchAll(/pg_catalog\.hashtextextended\('([^']+)'/g)];
    assert.equal(lockExpressions.length, 1, path + ': expected one canonical lock expression');
    assert.equal(lockExpressions[0][1], marker, path + ': lock namespace mismatch');
    assert.match(text, /pg_catalog\.pg_advisory_xact_lock\(/, path + ': transaction lock missing');
  }
});

test('draft report revalidates signed TTL after advisory lock wait and before claim consumption', async () => {
  const sql = await read('docs/security/neon-pilot-revocation-review.sql');
  const lock = sql.indexOf('PERFORM pg_catalog.pg_advisory_xact_lock(');
  const afterLock = sql.indexOf('v_now := floor(extract(epoch FROM clock_timestamp()))::bigint;', lock);
  const claim = sql.indexOf('INSERT INTO portal_authz_trial.consumed_claims');
  assert.ok(lock > 0, 'expected lock after signature validation');
  assert.ok(afterLock > lock && afterLock < claim, 'expiry must be rechecked after lock and before claim insert');
  assert.match(sql.slice(afterLock, claim), /IF p_expires < v_now OR p_expires > v_now \+ 300 THEN RETURN; END IF;/);
});
