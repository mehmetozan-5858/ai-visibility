/**
 * Offline, non-executing launch-plan authorization chain.
 *
 * IMPORTANT: inputs must be loaded by a trusted server handler from a verified
 * session, server-side tenant membership, and persisted entitlement records.
 * Do not pass role, tenant, consent or entitlement from request JSON.
 *
 * This module neither loads records nor persists audit events. It is not an
 * execution grant and must not be wired to a production action without review.
 */
import {authorizeLaunchAction} from "./ai-visibility-launch-access.mjs";
import {resolveLaunchServiceAvailability} from "./ai-visibility-launch-entitlements.mjs";
import {planLaunchService} from "./ai-visibility-launch-services.mjs";
import {prepareLaunchAuditEvent} from "./ai-visibility-launch-audit.mjs";

export function prepareAuthorizedLaunchPlan({
  actor, membership, sessionClientId, accountClientId,
  serviceId, capability, entitlement,
  featureEnabled=false, globallyEnabled=false, now=Date.now(),
}={}) {
  // Verify actor, role and tenant before consulting service-specific grants.
  const access=authorizeLaunchAction({
    actor, membership, resourceTenantId:accountClientId,
    action:"agent:plan", featureEnabled,
  });
  if (access.allowed!==true) return {ok:false,reason:access.reason};

  // A general customer subscription never unlocks a new service.
  const availability=resolveLaunchServiceAvailability({
    sessionClientId, accountClientId, serviceId, entitlement,
    globallyEnabled, now,
  });
  if (availability.allowed!==true) return {ok:false,reason:availability.reason};

  // Consent is derived exclusively from the verified server entitlement.
  // The availability policy has already rejected revoked or malformed grants.
  const plan=planLaunchService({
    serviceId, capability, tenantId:accountClientId,
    consent:entitlement.consentVerified===true,
  });
  if (plan.ok!==true) return {ok:false,reason:plan.reason};

  const audit=prepareLaunchAuditEvent({
    tenantId:accountClientId, actorId:actor.id, serviceId,
    eventType:"agent-plan-prepared",
  });
  if (audit.ok!==true) return {ok:false,reason:"audit-envelope-unavailable"};

  return {
    ok:true, state:"prepared-not-running", executes:false,
    plan, auditEvent:audit.event,
    auditPersisted:false, requiresAuditPersistence:true,
    requiresProductionApproval:true,
  };
}
