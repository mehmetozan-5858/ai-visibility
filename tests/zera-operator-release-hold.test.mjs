import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessZeraOperatorRelease} from '../lib/zera-operator-release-hold.mjs';

test('operator provider release is fail-closed and not configurable', () => {
  for (const flags of [
    {},
    {VERCEL_ENV:'production', ZERA_SINGLE_SCAN_ENABLED:'true'},
    {GEMINI_API_KEY:'test-only', ZERA_GEMINI_FREE_TIER_CONFIRMED:'true'},
    {confirmTwoFreeGeminiTasks:true, confirmOneFreeGeminiAttempt:true},
  ]) {
    assert.equal(assessZeraOperatorRelease(flags).allowed, false);
  }
});

for (const route of ['zera-ai-runner', 'zera-single-scan']) {
  test(route + ' denies provider execution before reading request or touching database', () => {
    const source=readFileSync(new URL('../app/api/clients/'+route+'/route.js',import.meta.url),'utf8');
    const post=source.slice(source.indexOf('export async function POST('));
    const hold=post.indexOf('const release=assessZeraOperatorRelease()');
    const denied=post.indexOf('if(!release.allowed)');
    assert.ok(hold>=0 && denied>hold,'release hold must be enforced in POST');
    for (const operation of ['req.json()', 'compareCustomerProviders(']) {
      assert.ok(post.indexOf(operation)>denied,operation+' must occur after release hold');
    }
  });
}

test('operator readiness does not report live scans ready while held', () => {
  const source=readFileSync(new URL('../app/api/clients/zera-scan-readiness/route.js',import.meta.url),'utf8');
  assert.match(source,/providerExecutionReleased:assessZeraOperatorRelease\(\)\.allowed/);
});
