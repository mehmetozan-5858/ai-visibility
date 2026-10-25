import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedLaunchPlan} from "../lib/ai-visibility-launch-authorized-plan.mjs";

const now=Date.parse("2026-10-25T07:00:00.000Z");
const actor={id:"user_01",authenticated:true};
const membership={actorId:"user_01",tenantId:"tenant_01",role:"owner",verified:true};
const entitlement={
  source:"server",clientId:"tenant_01",serviceId:"agent-audit-control",
  status:"active",revoked:false,expiresAt:"2026-11-25T00:00:00.000Z",
};
const base={
  actor,membership,sessionClientId:"tenant_01",accountClientId:"tenant_01",
  serviceId:"agent-audit-control",capability:"agent-run-review",
  entitlement,featureEnabled:true,globallyEnabled:true,now,
};
const prepare=patch=>prepareAuthorizedLaunchPlan({...base,...patch});

test("valid server-scoped grant produces only an offline plan and unpersisted audit envelope",()=>{
  const result=prepare({});
  assert.equal(result.ok,true);
  assert.equal(result.executes,false);
  assert.equal(result.state,"prepared-not-running");
  assert.equal(result.plan.requiresAuthorization,true);
  assert.equal(result.plan.requiresProductionEnablement,true);
  assert.equal(result.auditPersisted,false);
  assert.equal(result.requiresAuditPersistence,true);
  assert.equal(result.requiresProductionApproval,true);
  assert.equal(result.auditEvent.tenantId,"tenant_01");
  assert.equal(result.auditEvent.actorId,"user_01");
  assert.equal(result.auditEvent.eventType,"agent-plan-prepared");
  assert.equal(result.auditEvent.state,"prepared-not-persisted");
  assert.equal("candidateData" in result.auditEvent,false);
});

test("both independent feature gates fail closed",()=>{
  assert.equal(prepare({featureEnabled:false}).reason,"feature-disabled");
  assert.equal(prepare({globallyEnabled:false}).reason,"service-disabled");
  assert.equal(prepare({featureEnabled:"true"}).reason,"feature-disabled");
  assert.equal(prepare({globallyEnabled:"true"}).reason,"service-disabled");
});

test("cross-tenant, unauthenticated and read-only roles cannot prepare plans",()=>{
  assert.equal(prepare({accountClientId:"other_tenant"}).reason,"cross-tenant-denied");
  assert.equal(prepare({sessionClientId:"other_tenant"}).reason,"account-session-mismatch");
  assert.equal(prepare({actor:{...actor,authenticated:false}}).reason,"unauthenticated");
  assert.equal(prepare({membership:{...membership,role:"viewer"}}).reason,"insufficient-permission");
  assert.equal(prepare({membership:{...membership,verified:false}}).reason,"unverified-membership");
});

test("missing, mismatched, expired and revoked entitlements are rejected",()=>{
  assert.equal(prepare({entitlement:null}).reason,"service-entitlement-required");
  assert.equal(prepare({entitlement:{...entitlement,source:"request"}}).reason,"service-entitlement-required");
  assert.equal(prepare({entitlement:{...entitlement,clientId:"other_tenant"}}).reason,"service-entitlement-required");
  assert.equal(prepare({entitlement:{...entitlement,revoked:true}}).reason,"service-entitlement-required");
  assert.equal(prepare({now:Date.parse(entitlement.expiresAt)}).reason,"entitlement-expired-or-unverifiable");
});

test("sensitive services require valid server entitlement consent, never a request boolean",()=>{
  for(const [serviceId,capability] of [
    ["candidate-rediscovery","candidate-match-preview"],
    ["voice-revenue-agent","inbound-call-plan"],
  ]){
    const grant={...entitlement,serviceId,consentVerified:true,consentRevoked:false};
    assert.equal(prepare({serviceId,capability,entitlement:grant}).ok,true);
    assert.equal(prepare({serviceId,capability,entitlement:{...grant,consentVerified:false},consent:true}).reason,
      "verified-consent-required");
    assert.equal(prepare({serviceId,capability,entitlement:{...grant,consentRevoked:true},consent:true}).reason,
      "verified-consent-required");
    assert.equal(prepare({serviceId,capability,entitlement:{...grant,consentRevoked:"false"}}).reason,
      "verified-consent-required");
  }
});

test("unsupported capabilities and unknown services never create audit success envelopes",()=>{
  const invalid=prepare({capability:"send-outbound-call"});
  assert.deepEqual(invalid,{ok:false,reason:"unsupported-capability"});
  const unknown=prepare({serviceId:"unknown-service"});
  assert.deepEqual(unknown,{ok:false,reason:"unknown-service"});
});

test("missing or invalid tenant identity never produces a plan",()=>{
  assert.equal(prepare({accountClientId:"tenant_01\nother"}).ok,false);
  assert.equal(prepare({membership:{...membership,tenantId:"tenant_01\nother"}}).ok,false);
});
