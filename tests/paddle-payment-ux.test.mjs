import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('payment API exposes Paddle readiness and does not claim international payments are unavailable when Paddle is ready',()=>{
  const source=fs.readFileSync(new URL('../app/api/payment/route.js',import.meta.url),'utf8');
  assert.match(source,/const paddleReady=paddleLiveReadiness\(/);
  assert.match(source,/internationalPaymentPending:!tryRail&&!bank&&!hostedReady&&!paddleReady/);
  assert.match(source,/paddleReady:false/);
});

test('Paddle launcher checks server eligibility and never renders for paid or pilot access',()=>{
  const source=fs.readFileSync(new URL('../components/PaddleLiveCheckout.js',import.meta.url),'utf8');
  assert.match(source,/data\?\.paddleReady===true/);
  assert.match(source,/data\?\.payment\?\.status!=="paid"/);
  assert.match(source,/!data\?\.pilot/);
  assert.match(source,/if\(!CLIENT_TOKEN\|\|!token\|\|!checked\|\|!eligible\)return null/);
});
