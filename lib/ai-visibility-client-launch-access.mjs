/**
 * Bridges the existing signed AI Visibility client session to the launch
 * access policy. Only server-confirmed client access may become a membership.
 * This grants read-only preview access, never execution or settings rights.
 */
import {authorizeLaunchAction} from "./ai-visibility-launch-access.mjs";

export function resolveClientLaunchReadAccess({session, account, access} = {}) {
  if (!session || typeof session.clientId !== "string" || !session.clientId) {
    return {allowed:false, reason:"unauthenticated"};
  }
  if (!account?.client || account.client.id !== session.clientId) {
    return {allowed:false, reason:"account-session-mismatch"};
  }
  if (access?.allowed !== true || !["paid","pilot"].includes(access.kind)) {
    return {allowed:false, reason:"customer-access-inactive"};
  }
  return authorizeLaunchAction({
    actor:{id:session.clientId,authenticated:true},
    membership:{actorId:session.clientId,tenantId:session.clientId,role:"viewer",verified:true},
    resourceTenantId:account.client.id,
    action:"service:read",
    featureEnabled:true,
  });
}
