import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedLaunchPlan} from "../lib/ai-visibility-launch-authorized-plan.mjs";
import {LAUNCH_SERVICES} from "../lib/ai-visibility-launch-services.mjs";

// This is an offline contract test. No tenant database, external model,
// communications, payment, service execution or production flag is touched.
const now=Date.parse("2026-10-25T07:00:00.000Z");
const tenantId="tenant_matrix_01";
const actor={id:"owner_matrix_01",authenticated:true};
const membership={actorId:actor.id,tenantId,role:"owner",verified:true};
const cases=[
  ["agent-audit-control","agent-run-review",false],
  ["agent-commerce-intelligence","catalog-readiness",false],
  ["candidate-rediscovery","candidate-match-preview",true],
  ["voice-revenue-agent","inbound-call-plan",true],
];
function grant(serviceId,sensitive) {
  return {
    source:"server",clientId:tenantId,serviceId,status:"active",
    revoked:false,expiresAt:"2026-11-25T00:00:00.000Z",
    ...(sensitive?{consentVerified:true,consentRevoked:false}:{}),
  };
}
function plan(serviceId,capability,entitlement,overrides={}) {
  return prepareAuthorizedLaunchPlan({
    actor,membership,sessionClientId:tenantId,accountClientId:tenantId,
    serviceId,capability,entitlement,featureEnabled:true,globallyEnabled:true,
    now,...overrides,
  });
}

test("four launch services have distinct catalog identities and capabilities",()=>{
  assert.equal(LAUNCH_SERVICES.length,4);
  assert.equal(new Set(LAUNCH_SERVICES.map(s=>s.id)).size,4);
  for (const [id,capability,sensitive] of cases) {
    const service=LAUNCH_SERVICES.find(s=>s.id===id);
    assert.ok(service);
    assert.equal(service.sensitive,sensitive);
    assert.ok(service.capabilities.includes(capability));
  }
});

test("all four service plans remain non-executing with unpersisted audit records",()=>{
  for (const [serviceId,capability,sensitive] of cases) {
    const result=plan(serviceId,capability,grant(serviceId,sensitive));
    assert.equal(result.ok,true,serviceId);
    assert.equal(result.executes,false,serviceId);
    assert.equal(result.state,"prepared-not-running",serviceId);
    assert.equal(result.auditPersisted,false,serviceId);
    assert.equal(result.auditEvent.state,"prepared-not-persisted",serviceId);
    assert.equal(result.auditEvent.serviceId,serviceId);
    assert.equal(result.auditEvent.tenantId,tenantId);
    assert.equal(result.plan.requiresProductionEnablement,true);
  }
});

test("entitlement for any one service cannot authorize another of the four",()=>{
  for (const [serviceId,capability] of cases) {
    for (const [grantedService,,sensitive] of cases) {
      if (grantedService===serviceId) continue;
      const result=plan(serviceId,capability,grant(grantedService,sensitive));
      assert.deepEqual(result,{ok:false,reason:"service-entitlement-required"},
        `${grantedService} must not authorize ${serviceId}`);
    }
  }
});

test("each service rejects cross-tenant sessions, disabled gates and revoked grants",()=>{
  for (const [serviceId,capability,sensitive] of cases) {
    const entitlement=grant(serviceId,sensitive);
    assert.equal(plan(serviceId,capability,entitlement,{sessionClientId:"another_tenant"}).ok,false);
    assert.equal(plan(serviceId,capability,entitlement,{membership:{...membership,tenantId:"another_tenant"}}).ok,false);
    assert.equal(plan(serviceId,capability,entitlement,{featureEnabled:false}).reason,"feature-disabled");
    assert.equal(plan(serviceId,capability,entitlement,{globallyEnabled:false}).reason,"service-disabled");
    assert.equal(plan(serviceId,capability,{...entitlement,revoked:true}).reason,"service-entitlement-required");
  }
});

test("both sensitive services require explicitly verified non-revoked consent",()=>{
  for (const [serviceId,capability,sensitive] of cases) {
    if (!sensitive) continue;
    const entitlement=grant(serviceId,true);
    assert.equal(plan(serviceId,capability,{...entitlement,consentVerified:false}).reason,"verified-consent-required");
    assert.equal(plan(serviceId,capability,{...entitlement,consentRevoked:true}).reason,"verified-consent-required");
    assert.equal(plan(serviceId,capability,{...entitlement,consentRevoked:"false"}).reason,"verified-consent-required");
  }
});

test("all four services reject expired and future-dated grants before planning",()=>{
  for (const [serviceId,capability,sensitive] of cases) {
    const entitlement=grant(serviceId,sensitive);
    const rejected=[
      [{...entitlement,expiresAt:"2026-10-25T07:00:00.000Z"},"entitlement-expired-or-unverifiable"],
      [{...entitlement,expiresAt:"2026-10-24T07:00:00.000Z"},"entitlement-expired-or-unverifiable"],
      [{...entitlement,expiresAt:"invalid"},"entitlement-expired-or-unverifiable"],
      [{...entitlement,notBefore:"2026-10-25T07:00:01.000Z"},"entitlement-not-yet-valid"],
      [{...entitlement,notBefore:"invalid"},"entitlement-not-yet-valid"],
      [{...entitlement,notBefore:"2026-11-25T00:00:00.000Z"},"entitlement-not-yet-valid"],
    ];
    for (const [invalid,reason] of rejected) {
      assert.deepEqual(plan(serviceId,capability,invalid),{ok:false,reason},
        `${serviceId} must reject ${reason}`);
    }
    const valid={...entitlement,notBefore:"2026-10-25T07:00:00.000Z"};
    const prepared=plan(serviceId,capability,valid);
    assert.equal(prepared.ok,true,serviceId);
    assert.equal(prepared.executes,false,serviceId);
    assert.equal(prepared.auditPersisted,false,serviceId);
  }
});
