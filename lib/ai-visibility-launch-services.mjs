/**
 * AI Visibility Works - next launch service catalog.
 * Offline-only until the existing customer authorization and billing flows are integrated.
 * No external actions, purchases, deployments or scheduled work occur here.
 */
export const LAUNCH_SERVICES = Object.freeze([
  {
    id: "agent-audit-control", name: "AI Agent Audit & Control",
    capabilities: ["agent-run-review", "error-cost-report", "release-evidence", "permission-review", "revenue-leakage-review"],
    access: "tenant-owner", sensitive: false,
  },
  {
    id: "agent-commerce-intelligence", name: "AI Agent Commerce Intelligence",
    capabilities: ["catalog-readiness", "commerce-opportunities", "visibility-comparison"],
    access: "tenant-owner", sensitive: false,
  },
  {
    id: "candidate-rediscovery", name: "AI Candidate Rediscovery",
    capabilities: ["candidate-match-preview", "human-reviewed-shortlist"],
    access: "explicit-consent", sensitive: true,
  },
  {
    id: "voice-revenue-agent", name: "AI Voice Revenue Agent",
    capabilities: ["inbound-call-plan", "appointment-draft", "human-handoff"],
    access: "explicit-consent", sensitive: true,
  },
].map(service => Object.freeze({
  ...service,
  capabilities: Object.freeze([...service.capabilities]),
})));
const serviceMap = new Map(LAUNCH_SERVICES.map(s => [s.id, s]));
export function listLaunchServices() {
  return LAUNCH_SERVICES.map(s => ({ ...s, capabilities: [...s.capabilities], status: "planned-disabled" }));
}
export function planLaunchService({serviceId, capability, tenantId, consent = false} = {}) {
  const service = serviceMap.get(serviceId);
  if (!service) return {ok:false, reason:"unknown-service"};
  if (typeof tenantId !== "string" || !tenantId.trim()) return {ok:false, reason:"missing-tenant"};
  if (!service.capabilities.includes(capability)) return {ok:false, reason:"unsupported-capability"};
  if (service.sensitive && consent !== true) return {ok:false, reason:"consent-required"};
  return {
    ok:true, state:"prepared-not-running", serviceId, capability, tenantId:tenantId.trim(),
    executes:false, requiresAuthenticatedSession:true, requiresAuthorization:true,
    requiresAuditTrail:true, requiresBudgetGuard:true, requiresProductionEnablement:true,
  };
}
