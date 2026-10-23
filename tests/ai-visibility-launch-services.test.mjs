import test from "node:test";
import assert from "node:assert/strict";
import {LAUNCH_SERVICES, listLaunchServices, planLaunchService} from "../lib/ai-visibility-launch-services.mjs";

test("exactly four launch services live under AI Visibility", () => {
  assert.deepEqual(LAUNCH_SERVICES.map(s => s.id), [
    "agent-audit-control", "agent-commerce-intelligence", "candidate-rediscovery", "voice-revenue-agent",
  ]);
});
test("planned catalogue exposes disabled state", () => {
  assert.ok(listLaunchServices().every(s => s.status === "planned-disabled"));
});
test("unknown service, tenant or capability is denied", () => {
  assert.equal(planLaunchService({tenantId:"t",serviceId:"missing",capability:"x"}).reason,"unknown-service");
  assert.equal(planLaunchService({serviceId:"agent-audit-control",capability:"agent-run-review"}).reason,"missing-tenant");
  assert.equal(planLaunchService({tenantId:"t",serviceId:"agent-audit-control",capability:"charge-card"}).reason,"unsupported-capability");
});
test("candidate and voice require consent", () => {
  for (const [serviceId,capability] of [["candidate-rediscovery","candidate-match-preview"],["voice-revenue-agent","inbound-call-plan"]]) {
    assert.equal(planLaunchService({serviceId,capability,tenantId:"t"}).reason,"consent-required");
  }
});
test("valid operation creates a plan without executing", () => {
  const plan=planLaunchService({serviceId:"agent-commerce-intelligence",capability:"catalog-readiness",tenantId:"t"});
  assert.equal(plan.state,"prepared-not-running");
  assert.equal(plan.executes,false);
  assert.equal(plan.requiresAuthenticatedSession,true);
  assert.equal(plan.requiresProductionEnablement,true);
});
