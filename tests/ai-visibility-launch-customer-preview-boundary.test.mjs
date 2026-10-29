import test from "node:test";
import assert from "node:assert/strict";
import {listLaunchServices} from "../lib/ai-visibility-launch-services.mjs";
import {resolveClientLaunchReadAccess} from "../lib/ai-visibility-client-launch-access.mjs";
import {resolveLaunchServiceAvailability} from "../lib/ai-visibility-launch-entitlements.mjs";
import {authorizeLaunchAction} from "../lib/ai-visibility-launch-access.mjs";

// Offline contract test: synthetic identities and grants only. No HTTP, DB, provider or execution.
const clientId = "client_preview_01";
const actorId = "actor_preview_01";
const session = {clientId};
const account = {client: {id: clientId}};
const now = Date.parse("2026-10-27T12:00:00.000Z");
const preview = kind => resolveClientLaunchReadAccess({
  session, account, access: {allowed: true, kind},
});
const entitlement = service => ({
  source: "server", clientId, serviceId: service.id,
  status: "active", expiresAt: "2026-10-29T12:00:00.000Z",
  ...(service.sensitive ? {consentVerified: true} : {}),
});
const availability = (service, overrides = {}) => resolveLaunchServiceAvailability({
  sessionClientId: clientId, accountClientId: clientId,
  serviceId: service.id, entitlement: null,
  globallyEnabled: true, now, ...overrides,
});
const viewerAction = action => authorizeLaunchAction({
  actor: {id: actorId, authenticated: true},
  membership: {actorId, tenantId: clientId, role: "viewer", verified: true},
  resourceTenantId: clientId, action, featureEnabled: true,
});

test("paid and pilot customer portal preview never grant any of the four new services", () => {
  const services = listLaunchServices();
  assert.equal(services.length, 4, "review any added launch service");
  for (const kind of ["paid", "pilot"]) {
    const access = preview(kind);
    assert.equal(access.allowed, true, kind);
    assert.equal(access.previewOnly, true, kind);
    assert.equal(access.productionEnabled, false, kind);
    assert.equal(Object.hasOwn(access, "actorId"), false, kind);
    assert.equal(Object.hasOwn(access, "action"), false, kind);
    for (const service of services) {
      const label = `${kind}/${service.id}`;
      assert.equal(service.status, "planned-disabled", label);
      assert.equal(availability(service).reason, "service-entitlement-required", label);
      assert.equal(availability(service, {
        entitlement: {...entitlement(service), source: "client"},
      }).allowed, false, label);
      assert.equal(availability(service, {
        entitlement: entitlement(service), globallyEnabled: false,
      }).reason, "service-disabled", label);
      assert.equal(viewerAction("agent:plan").allowed, false, label);
      assert.equal(viewerAction("agent:execute").allowed, false, label);
    }
  }
});

test("a valid service-specific grant does not turn a customer viewer into an agent", () => {
  for (const service of listLaunchServices()) {
    assert.equal(availability(service, {entitlement: entitlement(service)}).allowed, true, service.id);
    assert.equal(viewerAction("service:read").allowed, true, service.id);
    assert.equal(viewerAction("agent:plan").reason, "insufficient-permission", service.id);
    assert.equal(viewerAction("agent:execute").allowed, false, service.id);
  }
});
