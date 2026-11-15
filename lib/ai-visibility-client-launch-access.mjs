/**
 * Read-only service catalog preview for a verified customer session.
 * The current signed client token proves tenant access, not an individual
 * actor identity. Never manufacture an actor or a verified membership from
 * the tenant ID; report and agent permissions require a separate actor gate.
 * The calling route must verify the signed session and server-side account.
 */
export const isValidLaunchClientId = value => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);

export function resolveClientLaunchReadAccess({session, account, access} = {}) {
  // Match the launch entitlement/authorization tenant identifier boundary.
  // A signed tenant token does not by itself authorize a malformed tenant ID.
  if (!isValidLaunchClientId(session?.clientId)) {
    return {allowed:false, reason:"unauthenticated"};
  }
  if (!account?.client || account.client.id !== session.clientId) {
    return {allowed:false, reason:"account-session-mismatch"};
  }
  if (access?.allowed !== true || !["paid","pilot"].includes(access.kind)) {
    return {allowed:false, reason:"customer-access-inactive"};
  }
  return {
    allowed:true,
    reason:"catalog-preview-only",
    tenantId:session.clientId,
    previewOnly:true,
    productionEnabled:false,
  };
}
