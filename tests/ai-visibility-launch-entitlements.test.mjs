import test from "node:test";
import assert from "node:assert/strict";
import {resolveLaunchServiceAvailability as resolve} from "../lib/ai-visibility-launch-entitlements.mjs";
const now=Date.parse("2026-10-24T12:00:00.000Z");
const base={sessionClientId:"client_1",accountClientId:"client_1",serviceId:"agent-audit-control",globallyEnabled:true,now,
 entitlement:{source:"server",clientId:"client_1",serviceId:"agent-audit-control",status:"active",expiresAt:"2026-10-25T12:00:00.000Z"}};
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
test("sensitive services need trusted non-revoked consent",()=>{
 const sensitive={...base,serviceId:"candidate-rediscovery",entitlement:{...base.entitlement,serviceId:"candidate-rediscovery"}};
 assert.equal(resolve(sensitive).reason,"verified-consent-required");
 assert.equal(resolve({...sensitive,entitlement:{...sensitive.entitlement,consentVerified:true,consentRevoked:true}}).reason,"verified-consent-required");
 assert.equal(resolve({...sensitive,entitlement:{...sensitive.entitlement,consentVerified:true}}).allowed,true);
});
test("correct active service entitlement permits only selected service",()=>{
 assert.deepEqual(resolve(base),{allowed:true,reason:"authorized-service",serviceId:"agent-audit-control",clientId:"client_1"});
});
test("missing, invalid and elapsed expiries fail closed",()=>{
 for (const expiresAt of [undefined,null,"bad-date","2026-10-24T12:00:00.000Z","2026-10-24T11:59:59.999Z","2026-10-25"]) {
   assert.equal(resolve({...base,entitlement:{...base.entitlement,expiresAt}}).reason,"entitlement-expired-or-unverifiable");
 }
});
test("not-before boundary prevents premature access",()=>{
 const entitlement={...base.entitlement,notBefore:"2026-10-24T13:00:00.000Z"};
 assert.equal(resolve({...base,entitlement}).reason,"entitlement-not-yet-valid");
 assert.equal(resolve({...base,entitlement,now:Date.parse("2026-10-24T13:00:00.000Z")}).allowed,true);
});
test("malformed or inverted not-before window fails closed",()=>{
 for (const notBefore of ["bad-date","2026-10-25T12:00:00.000Z","2026-10-26T12:00:00.000Z"]) {
   assert.equal(resolve({...base,entitlement:{...base.entitlement,notBefore}}).reason,"entitlement-not-yet-valid");
 }
});
test("invalid server evaluation time cannot grant access",()=>{
 for (const invalidNow of [NaN,Infinity,"2026-10-24T12:00:00Z"]) {
   assert.equal(resolve({...base,now:invalidNow}).reason,"entitlement-expired-or-unverifiable");
 }
});

test("malformed revocation fields never grant active service access",()=>{
 for (const revoked of ["true","false",null,0,1,{},[]]) {
  assert.equal(resolve({...base,entitlement:{...base.entitlement,revoked}}).reason,"service-entitlement-required");
 }
 assert.equal(resolve({...base,entitlement:{...base.entitlement,revoked:false}}).allowed,true);
});
test("malformed consent revocation fields cannot unlock sensitive services",()=>{
 for (const serviceId of ["candidate-rediscovery","voice-revenue-agent"]) {
  const entitlement={...base.entitlement,serviceId,consentVerified:true};
  for (const consentRevoked of ["true","false",null,0,1,{},[]]) {
   assert.equal(resolve({...base,serviceId,entitlement:{...entitlement,consentRevoked}}).reason,"verified-consent-required");
  }
  assert.equal(resolve({...base,serviceId,entitlement:{...entitlement,consentRevoked:false}}).allowed,true);
 }
});

// The entitlement resolver is also a public pure policy boundary. It must not
// approve malformed tenant IDs even when the session, account and grant match.
test("malformed tenant IDs cannot pass direct service entitlement checks",()=>{
 const invalidIds=["../other","tenant\nother"," tenant_1 ","tenant/1","üser","a".repeat(129)];
 for(const serviceId of ["agent-audit-control","agent-commerce-intelligence","candidate-rediscovery","voice-revenue-agent"]){
  for(const clientId of invalidIds){
   const entitlement={...base.entitlement,clientId,serviceId,
    consentVerified:true,consentRevoked:false};
   const result=resolve({...base,sessionClientId:clientId,accountClientId:clientId,serviceId,entitlement});
   assert.deepEqual(result,{allowed:false,reason:"account-session-mismatch"},
    `${serviceId} must reject malformed client ID ${JSON.stringify(clientId)}`);
  }
 }
});

test("canonical 128-character tenant ID remains valid",()=>{
 const clientId="a".repeat(128);
 const result=resolve({...base,sessionClientId:clientId,accountClientId:clientId,
  entitlement:{...base.entitlement,clientId}});
 assert.equal(result.allowed,true);
});
