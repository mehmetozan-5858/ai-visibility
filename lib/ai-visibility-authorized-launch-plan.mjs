/**
 * Offline-only, fail-closed four-service planning boundary.
 *
 * Server callers MUST obtain the session identity from a verified session,
 * the account and entitlement from trusted storage, and the feature flag and
 * current time from the server. Never pass request-body grants here.
 *
 * This prepares a reviewable plan; it never runs agents, sends messages,
 * records payments, or enables AI Bridge inference.
 */
import {resolveLaunchServiceAvailability} from "./ai-visibility-launch-entitlements.mjs";
import {planLaunchService} from "./ai-visibility-launch-services.mjs";

export function prepareAuthorizedLaunchServicePlan({
  sessionClientId,accountClientId,serviceId,capability,entitlement,
  globallyEnabled=false,now=Date.now()
}={}) {
  const access=resolveLaunchServiceAvailability({
    sessionClientId,accountClientId,serviceId,entitlement,globallyEnabled,now
  });
  if(!access.allowed) return {ok:false,reason:access.reason,executes:false};
  const consent=entitlement.consentVerified===true && entitlement.consentRevoked!==true;
  const plan=planLaunchService({
    serviceId,capability,tenantId:access.clientId,consent
  });
  if(!plan.ok) return {ok:false,reason:plan.reason,executes:false};
  return {...plan,entitlementChecked:true,externalActionsEnabled:false};
}
