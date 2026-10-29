import test from "node:test";
import assert from "node:assert/strict";
import {resolveLaunchServiceAvailability as resolve} from "../lib/ai-visibility-launch-entitlements.mjs";
const base={sessionClientId:"client_1",accountClientId:"client_1",serviceId:"agent-audit-control",globallyEnabled:true,
 entitlement:{source:"server",clientId:"client_1",serviceId:"agent-audit-control",status:"active"}};
test("existing customer access does not bypass disabled flag",()=>{
 assert.equal(resolve({...base,globallyEnabled:false}).reason,"service-disabled");
});
test("no entitlement or browser-supplied entitlement is denied",()=>{
 assert.equal(resolve({...base,entitlement:null}).reason,"service-entitlement-required");
 assert.equal(resolve({...base,entitlement:{...base.entitlement,source:"client"}}).reason,"service-entitlement-required");
});
test("a customer cannot use another customer's entitlement",()=>{
 assert.equal(resolve({...base,accountClientId:"client_2"}).reason,"account-session-mismatch");
 assert.equal(resolve({...base,entitlement:{...base.entitlement,clientId:"client_2"}}).reason,"service-entitlement-required");
});
test("one service entitlement does not unlock another",()=>{
 assert.equal(resolve({...base,serviceId:"agent-commerce-intelligence"}).reason,"service-entitlement-required");
});
test("revoked service denied",()=>{
 assert.equal(resolve({...base,entitlement:{...base.entitlement,revoked:true}}).reason,"service-entitlement-required");
});
test("sensitive services need trusted consent record",()=>{
 const sensitive={...base,serviceId:"candidate-rediscovery",entitlement:{...base.entitlement,serviceId:"candidate-rediscovery"}};
 assert.equal(resolve(sensitive).reason,"verified-consent-required");
 assert.equal(resolve({...sensitive,entitlement:{...sensitive.entitlement,consentVerified:true}}).allowed,true);
});
test("correct active service entitlement permits only selected service",()=>{
 assert.deepEqual(resolve(base),{allowed:true,reason:"authorized-service",serviceId:"agent-audit-control",clientId:"client_1"});
});
