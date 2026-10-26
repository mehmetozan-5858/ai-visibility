import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedLaunchPlan} from "../lib/ai-visibility-launch-authorized-plan.mjs";
import {LAUNCH_SERVICES} from "../lib/ai-visibility-launch-services.mjs";

// Offline regression: all inputs are fixtures. No network, database, payment,
// external communication, model inference or agent execution.
const tenantId="tenant_capability_matrix_01";
const actor={id:"owner_capability_matrix_01",authenticated:true};
const membership={actorId:actor.id,tenantId,role:"owner",verified:true};
const now=Date.parse("2026-10-26T08:00:00.000Z");
const capabilities=LAUNCH_SERVICES.flatMap(service=>
  service.capabilities.map(capability=>({owner:service.id,capability})));

function entitlement(service) {
  return {
    source:"server",clientId:tenantId,serviceId:service.id,
    status:"active",revoked:false,expiresAt:"2026-11-26T00:00:00.000Z",
    ...(service.sensitive?{consentVerified:true,consentRevoked:false}:{}),
  };
}
function prepare(service,capability,overrides={}) {
  return prepareAuthorizedLaunchPlan({
    actor,membership,sessionClientId:tenantId,accountClientId:tenantId,
    serviceId:service.id,capability,entitlement:entitlement(service),
    featureEnabled:true,globallyEnabled:true,now,...overrides,
  });
}

test("each capability is isolated to its declared service; rejected requests never create audit events",()=>{
  assert.equal(LAUNCH_SERVICES.length,4);
  assert.equal(new Set(capabilities.map(x=>x.capability)).size,capabilities.length,
    "Capabilities must be unique across the four launch services");
  for (const service of LAUNCH_SERVICES) {
    for (const {owner,capability} of capabilities) {
      const result=prepare(service,capability);
      if (owner===service.id) {
        assert.equal(result.ok,true,`${service.id}: ${capability}`);
        assert.equal(result.executes,false);
        assert.equal(result.auditPersisted,false);
        assert.equal(result.auditEvent.serviceId,service.id);
        assert.equal(result.auditEvent.tenantId,tenantId);
        assert.equal(result.auditEvent.state,"prepared-not-persisted");
      } else {
        assert.deepEqual(result,{ok:false,reason:"unsupported-capability"},
          `${service.id} must not accept ${owner}'s ${capability}`);
        assert.equal("auditEvent" in result,false);
      }
    }
  }
});

test("every owner-scoped capability rejects non-owner planning roles before audit preparation",()=>{
  for (const service of LAUNCH_SERVICES.filter(x=>x.access==="tenant-owner")) {
    for (const capability of service.capabilities) {
      for (const role of ["manager","analyst","agent"]) {
        const result=prepare(service,capability,{
          membership:{...membership,role},
        });
        assert.deepEqual(result,{ok:false,reason:"owner-required"},
          `${role} must not plan ${service.id}/${capability}`);
        assert.equal("auditEvent" in result,false);
      }
    }
  }
});

test("all sensitive capabilities reject revoked or missing verified consent without audit preparation",()=>{
  for (const service of LAUNCH_SERVICES.filter(x=>x.sensitive)) {
    for (const capability of service.capabilities) {
      for (const change of [
        {consentVerified:false},{consentVerified:"true"},
        {consentRevoked:true},{consentRevoked:"false"},
      ]) {
        const result=prepare(service,capability,{
          entitlement:{...entitlement(service),...change},
        });
        assert.deepEqual(result,{ok:false,reason:"verified-consent-required"});
        assert.equal("auditEvent" in result,false);
      }
    }
  }
});
