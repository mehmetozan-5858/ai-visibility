import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8");

test("pilot payment API returns zero-cost activation before any normal payment intent", async () => {
  const route = await read("../app/api/payment/route.js");
  const pilot = route.indexOf('if(tokenService==="pilot-diagnosis")');
  const intent = route.indexOf("getOrCreatePaymentIntent(client.id");
  assert.ok(pilot >= 0 && intent > pilot, "pilot branch must precede payment intent creation");
  const branch = route.slice(pilot, intent);
  assert.match(branch, /getPilotAccess\(client.id\)/);
  assert.match(branch, /amount:0,setupAmount:0,monthlyAmount:0/);
  assert.match(branch, /payment:null/);
  assert.match(branch, /paddleReady:false/);
  assert.match(branch, /cardReady:false/);
  assert.match(branch, /transferReady:false/);
});

test("payment UI hides all paid channels for pilot and offers verification-based setup", async () => {
  const payment = await read("../components/PaymentManager.js");
  const paddle = await read("../components/PaddleLiveCheckout.js");
  assert.match(payment, /\(d.payment\?\.status==="paid"\|\|d.pilot\)/);
  assert.match(payment, /!d.pilot&&<section className="grid reports-grid"/);
  assert.match(payment, /sendCode/);
  assert.match(payment, /verifyCode/);
  assert.match(paddle, /!data\?\.pilot/);
});
