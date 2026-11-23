import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('free pilot invitation is signed before any pilot grant write', () => {
  const route=readFileSync(new URL('../app/api/admin-pilots/route.js', import.meta.url),'utf8');
  const start=route.indexOf('export async function POST');
  const sign=route.indexOf('const token=await createPaymentAccessToken(',start);
  const grant=route.indexOf('await grantPilot(',start);
  assert.ok(start>=0 && sign>start && grant>sign,
    'pilot entitlement must never be written before link signing succeeds');
});
