import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static security regression: protects against accidental removal of the
// authenticated tenant binding. Real two-tenant DB integration remains required.
const source = readFileSync(new URL('../app/api/client-portal/route.js', import.meta.url), 'utf8');

test('portal rejects missing or invalid client session before account lookup', () => {
  assert.match(source, /verifyClientToken\(store\.get\("ai_client"\)\?\.value\|\|""\)/);
  assert.match(source, /if\(!session\)return privateJson\([^\n]*,401\)/);
  assert.ok(source.indexOf('if(!session)') < source.indexOf('getClientAccount(session.clientId)'));
});

test('account, report and profile are scoped to the authenticated client', () => {
  assert.match(source, /getClientAccount\(session\.clientId\)/);
  assert.match(source, /readCustomerComparisonReport\(databasePool\(getDatabaseUrl\(\)\),session\.clientId\)/);
  assert.match(source, /getClientProfile\(session\.clientId\)/);
  assert.doesNotMatch(source, /searchParams\.get\(['"]clientId['"]\)/);
});

test('portal denies inactive access before reading comparison evidence', () => {
  assert.match(source, /if\(!access\.allowed\)return privateJson\([^\n]*,403\)/);
  assert.ok(source.indexOf('if(!access.allowed)') < source.indexOf('readCustomerComparisonReport('));
});

test('portal responses disable shared caching', () => {
  assert.match(source, /"Cache-Control":"private, no-store, max-age=0"/);
  assert.match(source, /"Vary":"Cookie, Accept-Language"/);
});
