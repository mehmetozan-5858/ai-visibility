import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("public lead intake is same-origin protected and rate limited",()=>{
  const route=read("app/api/leads/route.js");
  assert.match(route,/checkRateLimit/);
  assert.match(route,/enforceSameOrigin/);
  assert.match(route,/bucket:"public-lead"/);
  assert.match(route,/export async function PATCH\(req\).*enforceSameOrigin/s);
  assert.match(route,/export async function PUT\(req\).*enforceSameOrigin/s);
});

test("payment reporting requires same-origin request rate limit secure token and consent",()=>{
  const route=read("app/api/payment/route.js");
  assert.match(route,/bucket:"payment-report"/);
  assert.match(route,/enforceSameOrigin\(req\)/);
  assert.match(route,/verifyPaymentAccessToken/);
  assert.match(route,/body\?\.consent!==true/);
  assert.match(route,/current\.clientId!==access\.clientId/);
  assert.match(route,/paymentMatchesPlan/);
});
