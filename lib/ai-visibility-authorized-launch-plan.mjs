/**
 * Compatibility entry point for offline-only, non-executing launch plans.
 *
 * IMPORTANT: a server caller MUST resolve actor and tenant membership from a
 * verified session and trusted storage. Entitlements and flags must likewise
 * come from trusted server-side records, never request JSON.
 *
 * This wrapper uses the same full authorization + audit-preparation chain as
 * prepareAuthorizedLaunchPlan. A matching entitlement alone is NOT enough.
 * No agents, messages, payments, model calls, or persistence occur here.
 */
import {prepareAuthorizedLaunchPlan} from "./ai-visibility-launch-authorized-plan.mjs";

export function prepareAuthorizedLaunchServicePlan({
  actor, membership, sessionClientId, accountClientId,
  serviceId, capability, entitlement,
  featureEnabled=false, globallyEnabled=false, now=Date.now(),
}={}) {
  const result=prepareAuthorizedLaunchPlan({
    actor, membership, sessionClientId, accountClientId,
    serviceId, capability, entitlement, featureEnabled, globallyEnabled, now,
  });
  if (result.ok!==true) return {...result,executes:false};

  // Preserve the legacy non-executing plan shape, while exposing the explicit
  // audit persistence and release gates from the trusted authorization chain.
  return {
    ...result.plan,
    entitlementChecked:true,
    externalActionsEnabled:false,
    auditEvent:result.auditEvent,
    auditPersisted:false,
    requiresAuditPersistence:true,
    requiresProductionApproval:true,
  };
}
