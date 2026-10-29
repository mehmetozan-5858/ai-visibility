import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_SERVICES, listLaunchServices, planLaunchService,
} from "../lib/ai-visibility-launch-services.mjs";

// Launch scope is deliberately fixed: legal/regulatory compliance modules
// and customer-facing execution are outside this release.
const expected = new Map([
  ["agent-audit-control", [
    "agent-run-review", "error-cost-report", "release-evidence",
    "permission-review", "revenue-leakage-review",
  ]],
  ["agent-commerce-intelligence", [
    "catalog-readiness", "commerce-opportunities", "visibility-comparison",
  ]],
  ["candidate-rediscovery", [
    "candidate-match-preview", "human-reviewed-shortlist",
  ]],
  ["voice-revenue-agent", [
    "inbound-call-plan", "appointment-draft", "human-handoff",
  ]],
]);
const sensitiveIds = new Set(["candidate-rediscovery", "voice-revenue-agent"]);

test("launch scope has exactly four unique services and thirteen unique capabilities", () => {
  assert.deepEqual(new Set(LAUNCH_SERVICES.map(s => s.id)), new Set(expected.keys()));
  assert.equal(LAUNCH_SERVICES.length, 4);
  const all = LAUNCH_SERVICES.flatMap(s => s.capabilities);
  assert.equal(all.length, 13);
  assert.equal(new Set(all).size, 13);
  for (const service of LAUNCH_SERVICES) {
    assert.deepEqual(service.capabilities, expected.get(service.id), service.id);
    assert.equal(service.sensitive, sensitiveIds.has(service.id), service.id);
  }
});

test("all thirteen capabilities remain non-executing and require production approval", () => {
  for (const service of LAUNCH_SERVICES) {
    for (const capability of service.capabilities) {
      const args = {serviceId:service.id, capability, tenantId:"tenant_01"};
      if (service.sensitive) {
        assert.deepEqual(planLaunchService(args),
          {ok:false, reason:"consent-required"}, capability);
      }
      const plan = planLaunchService({...args, consent:service.sensitive});
      assert.equal(plan.ok, true, capability);
      assert.equal(plan.state, "prepared-not-running", capability);
      assert.equal(plan.executes, false, capability);
      assert.equal(plan.tenantId, "tenant_01", capability);
      assert.equal(plan.serviceId, service.id, capability);
      assert.equal(plan.capability, capability, capability);
      for (const gate of [
        "requiresAuthenticatedSession", "requiresAuthorization",
        "requiresAuditTrail", "requiresBudgetGuard",
        "requiresProductionEnablement",
      ]) assert.equal(plan[gate], true, `${service.id}/${capability}: ${gate}`);
    }
  }
});

test("every customer catalog item stays disabled and cannot grant new capabilities", () => {
  const catalog = listLaunchServices();
  assert.equal(catalog.length, 4);
  for (const item of catalog) {
    assert.equal(item.status, "planned-disabled", item.id);
    assert.equal(Object.hasOwn(item, "productionEnabled"), false, item.id);
    assert.equal(Object.hasOwn(item, "executes"), false, item.id);
    const unsupported = "unapproved-external-action";
    assert.equal(planLaunchService({
      serviceId:item.id, capability:unsupported, tenantId:"tenant_01", consent:true,
    }).reason, "unsupported-capability", item.id);
  }
});
