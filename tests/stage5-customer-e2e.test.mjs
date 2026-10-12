import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const route=await fs.readFile(new URL("../app/api/admin-test-flow/route.js",import.meta.url),"utf8");
const ui=await fs.readFile(new URL("../components/TestCenter.js",import.meta.url),"utf8");

test("stage 5 harness remains admin-only, same-origin and synthetic",()=>{
  assert.match(route,/requireAdmin\(req\)/);
  assert.match(route,/enforceSameOrigin\(req\)/);
  assert.match(route,/checkRateLimit\(req/);
  assert.match(route,/test\.ai-visibility\.local/);
  assert.match(route,/test-flow-2026-10-13/);
  assert.doesNotMatch(route,/paytr\.com|shopier\.com|merchant_ok_url|merchant_oid/);
});

test("stage 5 harness requires email verification before temporary test credential",()=>{
  assert.match(route,/createVerificationCode/);
  assert.match(route,/sendVerificationEmail/);
  assert.match(route,/verifyEmailCode/);
  assert.match(route,/resetClientPassword|createClientCredential/);
});

test("stage 5 UI exercises actual login, protected portal and PDF report",()=>{
  assert.match(ui,/\/api\/client-auth\/login/);
  assert.match(ui,/\/api\/client-portal/);
  assert.match(ui,/\/musteri-panel/);
  assert.match(ui,/\/api\/client-portal\/report\?download=1/);
  assert.match(ui,/application\/pdf/);
  assert.match(ui,/Number\(x\.score\)===42/);
});
