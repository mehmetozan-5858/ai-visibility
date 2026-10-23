import test from "node:test";
import assert from "node:assert/strict";
import {
  OBSERVABILITY_MODULES,
  getObservabilityModule,
  listObservabilityModules,
  prepareObservabilityAction,
} from "../lib/observability-module-registry.mjs";

test("all seven modules have unique stable ids and no standalone compliance products", () => {
  assert.equal(OBSERVABILITY_MODULES.length, 7);
  assert.equal(new Set(OBSERVABILITY_MODULES.map((m) => m.id)).size, 7);
  assert.ok(!OBSERVABILITY_MODULES.some((m) => /eudr|cbam|ppwr|tax|invoice/.test(m.id)));
});

test("submodules stay under audit control rather than separate apps", () => {
  for (const id of ["release-assurance", "agent-identity-permissions", "revenue-leakage-monitor"]) {
    assert.equal(getObservabilityModule(id).group, "agent-audit-control");
  }
});

test("catalog copies cannot mutate the internal definitions", () => {
  const copy = listObservabilityModules();
  copy[0].capabilities.push("send-email");
  assert.ok(!getObservabilityModule("agent-audit-control").capabilities.includes("send-email"));
});

test("missing tenant and unknown module fail closed", () => {
  assert.equal(prepareObservabilityAction({ moduleId: "agent-audit-control", operation: "run-audit" }).reason, "missing-tenant");
  assert.equal(prepareObservabilityAction({ tenantId: "t1", moduleId: "nope", operation: "run-audit" }).reason, "unknown-module");
});

test("unsupported operation cannot trigger billing or outreach", () => {
  for (const operation of ["send-email", "charge-card", "deploy", "reject-candidate"]) {
    const result = prepareObservabilityAction({ tenantId: "t1", moduleId: "candidate-rediscovery", operation });
    assert.equal(result.status, "blocked");
  }
});

test("valid request is a dry-run plan, never running", () => {
  const r = prepareObservabilityAction({
    tenantId: "customer-1", moduleId: "agent-commerce-intelligence",
    operation: "commerce-readiness", evidence: ["sample://test-only"],
  });
  assert.equal(r.ok, true);
  assert.equal(r.status, "prepared-not-running");
  assert.equal(r.externalActionsEnabled, false);
  assert.ok(r.requiredControls.includes("tenant-isolation"));
});

test("invalid evidence is rejected", () => {
  const r = prepareObservabilityAction({ tenantId: "t", moduleId: "agent-audit-control", operation: "run-audit", evidence: [null] });
  assert.equal(r.reason, "invalid-evidence");
});
