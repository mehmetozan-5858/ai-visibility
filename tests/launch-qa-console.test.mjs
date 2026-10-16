import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('launch QA page is admin-only by remaining outside proxy public routes',()=>{
  const proxy=fs.readFileSync(new URL('../proxy.js',import.meta.url),'utf8');
  assert.doesNotMatch(proxy,/\/admin\/lansman-kontrol/);
  assert.match(proxy,/verifyAdminToken/);
});

test('launch QA console calls only the synthetic admin test flow and never Paddle checkout',()=>{
  const source=fs.readFileSync(new URL('../components/LaunchQAConsole.js',import.meta.url),'utf8');
  assert.match(source,/fetch\("\/api\/admin-test-flow"/);
  assert.match(source,/action:"start"/);
  assert.match(source,/action:"finish"/);
  assert.doesNotMatch(source,/\/api\/payment\/paddle/);
  assert.match(source,/gerçek tahsilat veya gerçek kart işlemi başlatmaz/);
});
