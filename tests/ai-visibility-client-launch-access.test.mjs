import test from "node:test";
import assert from "node:assert/strict";
import {resolveClientLaunchReadAccess} from "../lib/ai-visibility-client-launch-access.mjs";
const session={clientId:"customer_01"};
const account={client:{id:"customer_01"}};
const access={allowed:true,kind:"pilot"};
const decide=(patch={})=>resolveClientLaunchReadAccess({session,account,access,...patch});

test("signed pilot customer sees only non-executing catalog preview",()=>{
  const result=decide();
  assert.equal(result.allowed,true);
  assert.equal(result.reason,"catalog-preview-only");
  assert.equal(result.previewOnly,true);
  assert.equal(result.productionEnabled,false);
});
test("paid customer can see the same non-executing preview",()=>{
  assert.equal(decide({access:{allowed:true,kind:"paid"}}).previewOnly,true);
});
test("missing or malformed session is denied",()=>{
  for(const bad of [null,{clientId:""},{clientId:5},{}]) {
    assert.equal(decide({session:bad}).reason,"unauthenticated");
  }
});
test("cross-customer session is rejected before catalog access",()=>{
  assert.equal(decide({account:{client:{id:"another_customer"}}}).reason,"account-session-mismatch");
});
test("inactive, missing or unrecognized access does not grant preview",()=>{
  for(const bad of [undefined,{allowed:false},{allowed:true,kind:"unknown"}]) {
    assert.equal(decide({access:bad}).reason,"customer-access-inactive");
  }
});
test("tenant-scoped preview never fabricates an authenticated actor or membership",()=>{
  const result=decide();
  assert.equal(result.tenantId,"customer_01");
  for(const key of ["actorId","actor","membership","role","authenticated","verified","action","featureEnabled"]){
    assert.equal(Object.hasOwn(result,key),false,key+" must not be present");
  }
});

test("matching malformed tenant IDs cannot grant catalog preview",()=>{
  for(const clientId of ["../other","tenant\\nother"," tenant_1 ","tenant/1","üser","a".repeat(129)]){
    const result=decide({session:{clientId},account:{client:{id:clientId}}});
    assert.deepEqual(result,{allowed:false,reason:"unauthenticated"},JSON.stringify(clientId));
  }
});
test("canonical 128-character tenant ID remains preview eligible",()=>{
  const clientId="a".repeat(128);
  const result=decide({session:{clientId},account:{client:{id:clientId}}});
  assert.equal(result.previewOnly,true);
  assert.equal(result.productionEnabled,false);
});
