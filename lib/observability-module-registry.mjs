/**
 * Observability business-module catalog.
 * Offline-safe preparation layer: no billing, outreach, deployment or AI calls.
 * Module identifiers are stable for future tenant-scoped integrations.
 */
export const OBSERVABILITY_MODULES = Object.freeze([
  {
    id: "agent-audit-control",
    title: "AI Agent Audit & Control",
    group: "observability",
    capabilities: ["run-audit", "cost-and-error-tracking", "agent-activity-review"],
    requires: ["tenant-isolation", "consent", "audit-log"],
  },
  {
    id: "release-assurance",
    title: "Release Assurance",
    group: "agent-audit-control",
    capabilities: ["release-risk-review", "test-evidence", "rollback-readiness"],
    requires: ["read-only-source-access", "audit-log"],
  },
  {
    id: "agent-identity-permissions",
    title: "Agent Identity & Permissions",
    group: "agent-audit-control",
    capabilities: ["scoped-agent-identity", "least-privilege", "access-audit"],
    requires: ["tenant-isolation", "deny-by-default", "audit-log"],
  },
  {
    id: "revenue-leakage-monitor",
    title: "Revenue Leakage Monitor",
    group: "agent-audit-control",
    capabilities: ["reconciliation-read-only", "revenue-anomalies", "evidence"],
    requires: ["financial-data-consent", "tenant-isolation", "audit-log"],
  },
  {
    id: "agent-commerce-intelligence",
    title: "Agent Commerce Intelligence",
    group: "ai-visibility-commerce",
    capabilities: ["catalog-observation", "commerce-readiness", "sales-opportunity-reports"],
    requires: ["tenant-isolation", "source-provenance", "audit-log"],
  },
  {
    id: "candidate-rediscovery",
    title: "Candidate Rediscovery",
    group: "isolated-talent",
    capabilities: ["consented-candidate-matching", "human-reviewed-shortlists"],
    requires: ["documented-lawful-basis", "tenant-isolation", "no-automated-rejection", "audit-log"],
  },
  {
    id: "voice-revenue-agent",
    title: "Voice Revenue Agent",
    group: "isolated-voice",
    capabilities: ["consented-inbound-routing", "appointment-draft", "human-handoff"],
    requires: ["recording-consent-where-required", "tenant-isolation", "human-handoff", "audit-log"],
  },
]);

const byId = new Map(OBSERVABILITY_MODULES.map((module) => [module.id, module]));
export const listObservabilityModules = () => OBSERVABILITY_MODULES.map((module) => ({
  ...module,
  capabilities: [...module.capabilities],
  requires: [...module.requires],
}));
export const getObservabilityModule = (id) => {
  const module = byId.get(id);
  return module ? { ...module, capabilities: [...module.capabilities], requires: [...module.requires] } : null;
};

/**
 * All modules stay disabled until explicit production integration, testing and approval.
 * This function never executes a requested operation.
 */
export function prepareObservabilityAction({ tenantId, moduleId, operation, evidence = [] } = {}) {
  if (typeof tenantId !== "string" || !tenantId.trim()) {
    return { ok: false, status: "blocked", reason: "missing-tenant" };
  }
  const module = getObservabilityModule(moduleId);
  if (!module) return { ok: false, status: "blocked", reason: "unknown-module" };
  if (typeof operation !== "string" || !module.capabilities.includes(operation)) {
    return { ok: false, status: "blocked", reason: "unsupported-operation" };
  }
  if (!Array.isArray(evidence) || evidence.some((item) => typeof item !== "string")) {
    return { ok: false, status: "blocked", reason: "invalid-evidence" };
  }
  return {
    ok: true,
    status: "prepared-not-running",
    tenantId: tenantId.trim(),
    moduleId: module.id,
    operation,
    requiredControls: [...module.requires],
    evidence: [...evidence],
    externalActionsEnabled: false,
  };
}
