import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessZeraOperatorRelease} from '../lib/zera-operator-release-hold.mjs';
import {compareCustomerProviders} from '../lib/customer-provider-comparison.mjs';

test('combined release guards block both operator and shared provider execution', async () => {
  assert.equal(assessZeraOperatorRelease().allowed, false);
  let calls = 0;
  const result = await compareCustomerProviders({
    client: {id:'test-tenant',name:'Test Brand'}, query:'Test query',
    providers:['gemini','openai','perplexity'],
    keys:{gemini:'test-only',openai:'test-only',perplexity:'test-only'},
    fetchImpl:async () => {calls++;throw Error('network must remain disabled')},
  });
  assert.equal(calls, 0);
  assert.deepEqual(result.results.map(r => r.status), Array(3).fill('provider-execution-paused'));
  assert.equal(result.visibilityScore, null);
});

test('PR #131 one-shot attempt and failure summary survive guard integration', () => {
  const source = readFileSync(new URL('../app/api/clients/zera-ai-runner/route.js',import.meta.url),'utf8');
  assert.match(source,/Previous attempt exists; automatic further calls blocked/);
  assert.match(source,/summary:results\.find\(/);
  const post = source.slice(source.indexOf('export async function POST('));
  assert.ok(post.indexOf('if(!release.allowed)') < post.indexOf('await context()'));
});
