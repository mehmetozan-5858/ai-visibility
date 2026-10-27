import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_SERVICES, planLaunchService} from "../lib/ai-visibility-launch-services.mjs";
import {authorizeLaunchAction} from "../lib/ai-visibility-launch-access.mjs";
import {resolveLaunchServiceAvailability} from "../lib/ai-visibility-launch-entitlements.mjs";
import {prepareLaunchAuditEvent} from "../lib/ai-visibility-launch-audit.mjs";

// Cross-module acceptance only: no database, provider, customer or execution calls.
const tenantId = "tenant_01";
const actorId = "owner_01";
const now = Date.parse("2026-10-27T12:00:00.000Z");
const entitlementFor = service => ({
  source: "server", clientId: tenantId, serviceId: service.id,
  status: "active", expiresAt: "2026-10-28T12:00:00.000Z",
  ...(service.sensitive ? {consentVerified: true} : {}),
});
const availabilityFor = (service, overrides = {}) =>
  resolveLaunchServiceAvailability({
    sessionClientId: tenantId, accountClientId: tenantId,
    serviceId: service.id, entitlement: entitlementFor(service),
    globallyEnabled: true, now, ...overrides,
  });
const authorizationFor = (action, overrides = {}) =>
  authorizeLaunchAction({
    actor: {id: actorId, authenticated: true},
    membership: {actorId, tenantId, role: "owner", verified: true},
    resourceTenantId: tenantId, action, featureEnabled: true, ...overrides,
  });

test("all 13 capabilities remain plans even when separate policy gates allow a preview", () => {
  let checked = 0;
  for (const service of LAUNCH_SERVICES) {
    assert.equal(availabilityFor(service, {globallyEnabled: false}).allowed, false, service.id);
    assert.equal(availabilityFor(service).allowed, true, service.id);
    for (const capability of service.capabilities) {
      const label = `${service.id}/${capability}`;
      assert.equal(authorizationFor("agent:plan").allowed, true, label);
      assert.equal(authorizationFor("agent:execute").allowed, false, label);
      const plan = planLaunchService({
        tenantId, serviceId: service.id, capability, consent: true,
      });
      assert.equal(plan.ok, true, label);
      assert.equal(plan.executes, false, label);
      assert.equal(plan.state, "prepared-not-running", label);
      const audit = prepareLaunchAuditEvent({
        tenantId, actorId, serviceId: service.id, eventType: "agent-plan-prepared",
      });
      assert.equal(audit.ok, true, label);
      assert.equal(audit.event.state, "prepared-not-persisted", label);
      assert.equal(audit.event.tenantId, tenantId, label);
      checked++;
    }
  }
  assert.equal(checked, 13, "review any new capability before expanding the launch");
});

test("a prepared plan cannot substitute for an entitlement, tenant match or verified consent", () => {
  for (const service of LAUNCH_SERVICES) {
    const label = service.id;
    const capability = service.capabilities[0];
    // Planning is a pure preparation function, not an entitlement decision.
    assert.equal(planLaunchService({tenantId, serviceId: service.id, capability, consent: true}).ok, true, label);
    assert.equal(availabilityFor(service, {entitlement: null}).allowed, false, label);
    assert.equal(availabilityFor(service, {accountClientId: "other_tenant"}).allowed, false, label);
    assert.equal(availabilityFor(service, {
      entitlement: {...entitlementFor(service), revoked: true},
    }).allowed, false, label);
    assert.equal(authorizationFor("agent:plan", {
      membership: {actorId, tenantId: "other_tenant", role: "owner", verified: true},
    }).allowed, false, label);
    assert.equal(authorizationFor("agent:plan", {
      membership: {actorId, tenantId, role: "viewer", verified: true},
    }).allowed, false, label);
    if (service.sensitive) {
      assert.equal(planLaunchService({tenantId, serviceId: service.id, capability}).reason, "consent-required", label);
      assert.equal(availabilityFor(service, {
        entitlement: {...entitlementFor(service), consentVerified: false},
      }).allowed, false, label);
    }
  }
});
