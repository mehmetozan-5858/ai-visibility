import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_SERVICES, listLaunchServices, planLaunchService,
} from "../lib/ai-visibility-launch-services.mjs";

const expectedIds = [
  "agent-audit-control",
  "agent-commerce-intelligence",
  "candidate-rediscovery",
  "voice-revenue-agent",
];

test("launch catalog contains four unique non-regulatory service IDs", () => {
  assert.deepEqual(LAUNCH_SERVICES.map(service => service.id), expectedIds);
  assert.equal(new Set(LAUNCH_SERVICES.map(service => service.id)).size, 4);
  for (const service of LAUNCH_SERVICES) {
    assert.ok(service.capabilities.length > 0);
    assert.equal(new Set(service.capabilities).size, service.capabilities.length);
  }
});

test("every advertised capability prepares a gated plan, never execution", () => {
  let checked = 0;
  for (const service of LAUNCH_SERVICES) {
    for (const capability of service.capabilities) {
      const input = {serviceId: service.id, capability, tenantId: "tenant_01"};
      if (service.sensitive) {
        assert.deepEqual(
          planLaunchService(input),
          {ok: false, reason: "consent-required"},
          `${service.id}/${capability} must require explicit consent`,
        );
      }
      const plan = planLaunchService({...input, consent: true});
      assert.equal(plan.ok, true, `${service.id}/${capability}`);
      assert.equal(plan.state, "prepared-not-running");
      assert.equal(plan.executes, false);
      assert.equal(plan.tenantId, "tenant_01");
      assert.equal(plan.serviceId, service.id);
      assert.equal(plan.capability, capability);
      for (const gate of [
        "requiresAuthenticatedSession",
        "requiresAuthorization",
        "requiresAuditTrail",
        "requiresBudgetGuard",
        "requiresProductionEnablement",
      ]) assert.equal(plan[gate], true, `${service.id}/${capability}: ${gate}`);
      checked++;
    }
  }
  assert.equal(checked, 13, "review new capabilities before expanding launch scope");
});

test("planning cannot activate or mutate the customer-facing catalog", () => {
  const exposed = listLaunchServices();
  assert.equal(exposed.length, 4);
  for (const service of exposed) {
    assert.equal(service.status, "planned-disabled");
    assert.equal(Object.hasOwn(service, "executes"), false);
    const source = LAUNCH_SERVICES.find(item => item.id === service.id);
    assert.notStrictEqual(service, source);
    assert.notStrictEqual(service.capabilities, source.capabilities);
    service.status = "active";
    service.capabilities.push("unapproved-action");
  }
  for (const service of listLaunchServices()) {
    assert.equal(service.status, "planned-disabled");
    assert.equal(service.capabilities.includes("unapproved-action"), false);
  }
});

test("all services reject unscoped tenants and unsupported capabilities", () => {
  for (const service of LAUNCH_SERVICES) {
    const capability = service.capabilities[0];
    assert.equal(
      planLaunchService({serviceId: service.id, capability, tenantId: "../other", consent: true}).reason,
      "invalid-tenant",
    );
    assert.equal(
      planLaunchService({serviceId: service.id, capability: "send-external-message", tenantId: "tenant_01", consent: true}).reason,
      "unsupported-capability",
    );
  }
});
