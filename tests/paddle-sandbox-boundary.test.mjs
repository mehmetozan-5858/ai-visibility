import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/paddle/sandbox-webhook/route.js';

const names = [
  'VERCEL_ENV', 'PADDLE_SANDBOX_ENABLED', 'PADDLE_SANDBOX_WEBHOOK_SECRET',
  'PADDLE_LIVE_WEBHOOK_SECRET', 'PADDLE_SANDBOX_DATABASE_URL', 'DATABASE_URL', 'STORAGE_URL',
];
function isolate(callback) {
  return async () => {
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    try { await callback(); } finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  };
}
const request = () => new Request('https://preview.example.test/api/paddle/sandbox-webhook', {
  method: 'POST', body: '{}', headers: {'content-type': 'application/json'},
});
test('sandbox webhook is unavailable outside a preview deployment', isolate(async () => {
  process.env.VERCEL_ENV = 'production';
  process.env.PADDLE_SANDBOX_ENABLED = 'true';
  assert.equal((await POST(request())).status, 404);
  process.env.VERCEL_ENV = 'preview';
  process.env.PADDLE_SANDBOX_ENABLED = 'false';
  assert.equal((await POST(request())).status, 404);
}));
test('sandbox webhook fails closed when isolation or separate signing key is absent', isolate(async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PADDLE_SANDBOX_ENABLED = 'true';
  process.env.DATABASE_URL = 'postgresql://app:secret@live.example.test/app';
  process.env.PADDLE_SANDBOX_DATABASE_URL = 'postgresql://sandbox:secret@live.example.test/other';
  process.env.PADDLE_LIVE_WEBHOOK_SECRET = 'live-signing-secret';
  process.env.PADDLE_SANDBOX_WEBHOOK_SECRET = 'sandbox-signing-secret';
  assert.equal((await POST(request())).status, 503);
  process.env.PADDLE_SANDBOX_DATABASE_URL = 'postgresql://sandbox:secret@isolated.example.test/app';
  process.env.PADDLE_SANDBOX_WEBHOOK_SECRET = process.env.PADDLE_LIVE_WEBHOOK_SECRET;
  assert.equal((await POST(request())).status, 503);
}));
test('sandbox webhook rejects unsigned payload before database operations', isolate(async () => {
  process.env.VERCEL_ENV = 'preview';
  process.env.PADDLE_SANDBOX_ENABLED = 'true';
  process.env.DATABASE_URL = 'postgresql://app:secret@live.example.test/app';
  process.env.PADDLE_SANDBOX_DATABASE_URL = 'postgresql://sandbox:secret@isolated.example.test/app';
  process.env.PADDLE_LIVE_WEBHOOK_SECRET = 'live-signing-secret';
  process.env.PADDLE_SANDBOX_WEBHOOK_SECRET = 'sandbox-signing-secret';
  assert.equal((await POST(request())).status, 401);
}));
