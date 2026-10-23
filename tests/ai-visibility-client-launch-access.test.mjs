import test from "node:test";
import assert from "node:assert/strict";
import {resolveClientLaunchReadAccess} from "../lib/ai-visibility-client-launch-access.mjs";
const session={clientId:"customer_01"};
const account={client:{id:"customer_01"}};
const access={allowed:true,kind:"pilot"};
const decide=(patch={})=>resolveClientLaunchReadAccess({session,account,access,...patch});

test("signed customer with server-confirmed pilot access sees read-only preview",()=>{
  const result=decide();assert.equal(result.allowed,true);assert.equal(result.action,"service:read");
});
test("paid customer can see the preview",()=>{
  assert.equal(decide({access:{allowed:true,kind:"paid"}}).allowed,true);
});
test("missing or tampered session cannot access preview",()=>{
  assert.equal(decide({session:null}).reason,"unauthenticated");
  assert.equal(decide({session:{clientId:""}}).reason,"unauthenticated");
});
test("cross-customer session is rejected before policy assignment",()=>{
  assert.equal(decide({account:{client:{id:"another_customer"}}}).reason,"account-session-mismatch");
});
test("inactive, missing or unrecognized access does not grant preview",()=>{
  assert.equal(decide({access:{allowed:false}}).reason,"customer-access-inactive");
  assert.equal(decide({access:{allowed:true,kind:"unknown"}}).reason,"customer-access-inactive");
});
test("same-session identity maps only to customer viewer rights",()=>{
  const result=decide();assert.equal(result.tenantId,"customer_01");
  assert.equal(result.actorId,"customer_01");
});
