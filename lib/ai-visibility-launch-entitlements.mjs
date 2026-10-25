/**
 * AI Visibility new-service availability boundary.
 * Existing paid/pilot visibility access never unlocks a new service.
 * Only trusted server-side entitlement records can enable a service.
 *
 * This is a pure, offline policy, NOT a database lookup or execution grant.
 * Callers must load the entitlement from trusted storage, never request JSON,
 * and must use the server clock (the optional now parameter is for tests).
 */
import {LAUNCH_SERVICES} from "./ai-visibility-launch-services.mjs";

const catalog = new Set(LAUNCH_SERVICES.map(s=>s.id));
const sensitive = new Set(LAUNCH_SERVICES.filter(s=>s.sensitive).map(s=>s.id));
function utcInstant(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value ? ms : null;
}
export function resolveLaunchServiceAvailability({
  sessionClientId, accountClientId, serviceId, entitlement,
  globallyEnabled=false, now=Date.now()
}={}) {
  if (typeof sessionClientId!=="string" || !sessionClientId ||
      sessionClientId!==accountClientId) return {allowed:false,reason:"account-session-mismatch"};
  if (!catalog.has(serviceId)) return {allowed:false,reason:"unknown-service"};
  if (globallyEnabled!==true) return {allowed:false,reason:"service-disabled"};
  if (!entitlement || entitlement.source!=="server" || entitlement.clientId!==sessionClientId ||
      entitlement.serviceId!==serviceId || entitlement.status!=="active" ||
      // Missing legacy revocation field is allowed; any present non-false value
      // (including strings and null) fails closed rather than bypassing revocation.
      (entitlement.revoked!==undefined && entitlement.revoked!==false))
    return {allowed:false,reason:"service-entitlement-required"};
  // Expiry is mandatory: an old "active" row must not grant perpetual access.
  // Invalid/missing timestamps and invalid clocks fail closed.
  const expiresAt=utcInstant(entitlement.expiresAt);
  if (!Number.isFinite(now) || expiresAt===null || now>=expiresAt)
    return {allowed:false,reason:"entitlement-expired-or-unverifiable"};
  if (entitlement.notBefore!==undefined) {
    const notBefore=utcInstant(entitlement.notBefore);
    if (notBefore===null || now<notBefore || notBefore>=expiresAt)
      return {allowed:false,reason:"entitlement-not-yet-valid"};
  }
  if (sensitive.has(serviceId) &&
      (entitlement.consentVerified!==true ||
       (entitlement.consentRevoked!==undefined && entitlement.consentRevoked!==false)))
    return {allowed:false,reason:"verified-consent-required"};
  return {allowed:true,reason:"authorized-service",serviceId,clientId:sessionClientId};
}
