/**
 * AI Visibility new-service availability boundary.
 * "Paid" or "pilot" access to the EXISTING visibility report never
 * automatically entitles a customer to a new launch product.
 * Only trusted server-side entitlement records can enable a service.
 */
import {LAUNCH_SERVICES} from "./ai-visibility-launch-services.mjs";

const catalog = new Set(LAUNCH_SERVICES.map(s=>s.id));
export function resolveLaunchServiceAvailability({
  sessionClientId, accountClientId, serviceId, entitlement, globallyEnabled=false
}={}) {
  if (typeof sessionClientId!=="string" || !sessionClientId ||
      sessionClientId!==accountClientId) return {allowed:false,reason:"account-session-mismatch"};
  if (!catalog.has(serviceId)) return {allowed:false,reason:"unknown-service"};
  if (globallyEnabled!==true) return {allowed:false,reason:"service-disabled"};
  if (!entitlement || entitlement.source!=="server" || entitlement.clientId!==sessionClientId ||
      entitlement.serviceId!==serviceId || entitlement.status!=="active" ||
      entitlement.revoked===true) return {allowed:false,reason:"service-entitlement-required"};
  if (["candidate-rediscovery","voice-revenue-agent"].includes(serviceId) &&
      entitlement.consentVerified!==true) return {allowed:false,reason:"verified-consent-required"};
  return {allowed:true,reason:"authorized-service",serviceId,clientId:sessionClientId};
}
