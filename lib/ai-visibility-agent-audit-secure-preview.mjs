import {authorizeLaunchFromClientCookie} from "./ai-visibility-launch-cookie-auth.mjs";
import {buildAgentAuditClientReport} from "./ai-visibility-agent-audit-report.mjs";

/**
 * Server-only, read-only integration boundary for Agent Audit & Control.
 * Caller must supply the signed ai_client cookie, the real trusted token
 * verifier, a read-only entitlement DB and a trusted aggregated-metrics loader.
 * Never accept a client ID, entitlement, metrics loader or database from HTTP
 * request JSON. Does not register a route, send data, or write to storage.
 */
export async function prepareAuthorizedAgentAuditReport({
  cookieToken, verifyClientToken, entitlementDb, loadAggregatedMetrics, now=new Date()
}={}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return {ok:false,reason:"invalid-time"};
  }
  if (typeof loadAggregatedMetrics !== "function") {
    return {ok:false,reason:"metrics-loader-unavailable"};
  }

  const access=await authorizeLaunchFromClientCookie({
    cookieToken,verifyClientToken,serviceId:"agent-audit-control",
    db:entitlementDb,now
  });
  if (!access.allowed) return {ok:false,reason:access.reason};

  let records;
  try {
    // The loader is trusted server code. Pass only the verified tenant ID.
    records=await loadAggregatedMetrics(access.clientId);
  } catch {
    return {ok:false,reason:"metrics-unavailable"};
  }
  return buildAgentAuditClientReport({
    authorizedClientId:access.clientId,records,generatedAt:now.toISOString()
  });
}
