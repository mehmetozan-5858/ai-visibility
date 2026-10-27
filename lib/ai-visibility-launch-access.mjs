/**
 * AI Visibility launch authorization policy, phase 1.
 * Pure policy only: server handlers must authenticate the actor, resolve its
 * tenant membership from trusted storage and perform the audit write.
 */
export const LAUNCH_ROLES = Object.freeze(["owner", "manager", "analyst", "viewer", "agent"]);
export const LAUNCH_ACTIONS = Object.freeze([
  "service:read", "report:read", "report:create", "agent:plan",
  "agent:execute", "customer:manage", "audit:read", "settings:write",
]);
const permissions = Object.freeze({
  owner: LAUNCH_ACTIONS,
  manager: ["service:read", "report:read", "report:create", "agent:plan", "customer:manage", "audit:read"],
  analyst: ["service:read", "report:read", "report:create", "agent:plan"],
  viewer: ["service:read", "report:read"],
  agent: ["service:read", "agent:plan"],
});
function identifier(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}
/**
 * Membership must be resolved on the server from an authenticated session.
 * Never accept role, tenant or agent grants from untrusted request bodies.
 * No role can execute agents yet: enabling requires a separate release gate.
 */
export function authorizeLaunchAction({actor, membership, resourceTenantId, action, featureEnabled = false} = {}) {
  if (!actor || !identifier(actor.id) || actor.authenticated !== true) return {allowed:false, reason:"unauthenticated"};
  if (!membership || membership.actorId !== actor.id || !identifier(membership.tenantId) ||
      !LAUNCH_ROLES.includes(membership.role) || membership.verified !== true ||
      // Explicit revocation/inactive fields must never be overridden by a stale verified flag.
      (membership.revoked !== undefined && membership.revoked !== false) ||
      (membership.active !== undefined && membership.active !== true)) {
    return {allowed:false, reason:"unverified-membership"};
  }
  if (!identifier(resourceTenantId) || resourceTenantId !== membership.tenantId) {
    return {allowed:false, reason:"cross-tenant-denied"};
  }
  if (!LAUNCH_ACTIONS.includes(action) || !permissions[membership.role].includes(action)) {
    return {allowed:false, reason:"insufficient-permission"};
  }
  if (action === "agent:execute" || action === "settings:write") {
    return {allowed:false, reason:"requires-separate-production-approval"};
  }
  // Only an explicit server-controlled boolean true enables preview access.
  // Truthy strings such as "false" must never unlock a service.
  if (featureEnabled !== true) return {allowed:false, reason:"feature-disabled"};
  return {allowed:true, reason:"authorized", actorId:actor.id, tenantId:membership.tenantId, action};
}
export function launchRolePermissions(role) {
  // Reject inherited Object keys and malformed role values without throwing.
  if (!LAUNCH_ROLES.includes(role)) return [];
  return [...permissions[role]];
}
