import assert from 'node:assert/strict';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {buildZeraChannelReport,hasZeraChannelReportAccess,zeraInstagram} from '../lib/zera-channel-report.mjs';

test('only the ZERA profile generates eight dated findings without inferring ranking', () => {
  const report = buildZeraChannelReport(zeraInstagram);
  assert.equal(report.findings.length, 8);
  assert.equal(new Set(report.findings.map(item => item.id)).size, 8);
  assert.match(report.findings.find(item => item.id === 'google').observation, /sıralaması ölçülmedi/);
  assert.ok(report.findings.every(item => item.date && item.source && item.request && item.next));
  assert.equal(buildZeraChannelReport('https://www.instagram.com/another/'), null);
  assert.equal(buildZeraChannelReport('https://example.com/zeraclothing.official/'), null);
});

test('ZERA report requires the configured tenant and an active pilot grant in a read-only transaction', async () => {
  const db = new PGlite();
  const zera = '35fea806-03fa-4dbb-8058-c07e88d53622';
  const other = '15fea806-03fa-4dbb-8058-c07e88d53622';
  try {
    await db.exec(`
      CREATE TABLE clients (id uuid PRIMARY KEY, name text, plan text, status text);
      CREATE TABLE client_pilot_access (client_id uuid, expires_at timestamptz, revoked_at timestamptz);
      INSERT INTO clients VALUES ('${zera}', 'ZERA Clothing', 'Pilot', 'active'), ('${other}', 'Other', 'Pilot', 'active');
      INSERT INTO client_pilot_access VALUES ('${zera}', NOW() + INTERVAL '1 day', NULL), ('${other}', NOW() + INTERVAL '1 day', NULL);
      BEGIN READ ONLY;
    `);
    assert.equal(await hasZeraChannelReportAccess(db, '', zera), false);
    assert.equal(await hasZeraChannelReportAccess(db, other, zera), false);
    assert.equal(await hasZeraChannelReportAccess(db, other, other), false);
    assert.equal(await hasZeraChannelReportAccess(db, zera, zera), true);
    await db.exec('COMMIT; UPDATE client_pilot_access SET revoked_at=NOW()');
    assert.equal(await hasZeraChannelReportAccess(db, zera, zera), false);
    await db.exec("UPDATE client_pilot_access SET revoked_at=NULL, expires_at=NOW() - INTERVAL '1 day'");
    assert.equal(await hasZeraChannelReportAccess(db, zera, zera), false);
  } finally {
    await db.close();
  }
});

test('customer trial packages follow selected findings and preserve implementation order', async () => {
  const {selectZeraWork} = await import('../lib/zera-first-customer-plan.mjs');
  const ids = buildZeraChannelReport(zeraInstagram).findings.map(item => item.id);
  assert.equal(selectZeraWork(ids, ids).length, 8);
  const plan = selectZeraWork(ids, ['seo', 'website', 'conversion', 'conversion', 'unlisted']);
  assert.deepEqual(plan.map(item => item.id), ['conversion', 'website', 'seo']);
  assert.ok(plan.every(item => item.requires && item.draft && item.accept));
  assert.deepEqual(selectZeraWork(['website'], ['seo']), []);
});

test('trial delivery remains open without evidence and ignores results outside the chosen scope', async () => {
  const {selectZeraWork,summarizeZeraTrial} = await import('../lib/zera-first-customer-plan.mjs');
  const plan = selectZeraWork(['conversion', 'seo'], ['conversion']);
  const outside = {seo: {status: 'passed', note: 'Example outside the selected scope.'}};
  assert.equal(summarizeZeraTrial([], outside).ready, false);
  assert.equal(summarizeZeraTrial(plan, {...outside, conversion:{status:'passed',note:'  '}}).ready, false);
  assert.equal(summarizeZeraTrial(plan, {...outside, conversion:{status:'needsRevision',note:'Wrong target.'}}).pending, 1);
  const complete = summarizeZeraTrial(plan, {...outside, conversion:{status:'passed',note:'Test product code appeared in the expected target.'}});
  assert.equal(complete.ready, true);
  assert.equal(complete.passed, 1);
  assert.equal(complete.pending, 0);
});
