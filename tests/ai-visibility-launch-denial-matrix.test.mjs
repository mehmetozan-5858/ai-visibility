import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_SERVICES, planLaunchService} from "../lib/ai-visibility-launch-services.mjs";

// Negative-path matrix: the positive 13-capability catalog tests live in
// ai-visibility-launch-capability-matrix.test.mjs. These inputs must not
// become executable or grant cross-service scope during future integration.
const malformedTenants = [
  "../other", " tenant_01", "tenant_01 ", "tenant/other",
  "tenant\nother", "tenant@other", "a".repeat(129),
];

test("all 13 capability plans reject malformed tenant IDs before consent", () => {
  for (const service of LAUNCH_SERVICES) {
    for (const capability of service.capabilities) {
      for (const tenantId of malformedTenants) {
        assert.deepEqual(
          planLaunchService({serviceId: service.id, capability, tenantId, consent: true}),
          {ok: false, reason: "invalid-tenant"},
          `${service.id}/${capability}: ${JSON.stringify(tenantId)}`,
        );
      }
    }
  }
});

test("all sensitive capabilities require literal boolean consent, not truthy payloads", () => {
  const unsafeConsent = ["true", "false", 1, -1, {}, [], ["true"], null, undefined];
  for (const service of LAUNCH_SERVICES.filter(item => item.sensitive)) {
    for (const capability of service.capabilities) {
      for (const consent of unsafeConsent) {
        assert.deepEqual(
          planLaunchService({serviceId: service.id, capability, tenantId: "tenant_01", consent}),
          {ok: false, reason: "consent-required"},
          `${service.id}/${capability}: ${String(consent)}`,
        );
      }
    }
  }
});

test("a capability from another service never inherits the caller service's scope", () => {
  for (const service of LAUNCH_SERVICES) {
    for (const other of LAUNCH_SERVICES) {
      if (service.id === other.id) continue;
      for (const capability of other.capabilities) {
        assert.deepEqual(
          planLaunchService({serviceId: service.id, capability, tenantId: "tenant_01", consent: true}),
          {ok: false, reason: "unsupported-capability"},
          `${service.id} must not accept ${other.id}/${capability}`,
        );
      }
    }
  }
});
