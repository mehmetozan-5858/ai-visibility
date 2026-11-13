/**
 * Read-only release admission for a possible second, DIRECT Gemini provider.
 * Does not access credentials, issue network requests, grant customer consent,
 * change environment configuration, or authorize inference itself.
 * Every evidence field MUST come from verified trusted server-side records,
 * never untrusted browser payloads.
 */
export const FREE_GEMINI_MODEL_ALLOWLIST = Object.freeze(['gemini-2.5-flash-lite','gemini-3.5-flash-lite']);
const required = Object.freeze([
  'billing-free-confirmed','free-tier-eligible','positive-remaining-quota',
  'project-model-access-confirmed',
  'privacy-permission-confirmed','tenant-authorization-confirmed','model-allowlisted',
  'zero-price-confirmed','server-key-present','zero-cost-recording-available',
  'manual-admin-action-required','paid-fallback-disabled','grounding-disabled',
  'no-automatic-retries'
]);
/** Evidence-only result. Even a complete checklist NEVER permits inference. */
export function evaluateFreeGeminiAdmission(evidence = {}) {
  const isObject = evidence !== null && typeof evidence === 'object' && !Array.isArray(evidence);
  const e = isObject ? evidence : {};
  const checks = {
    'billing-free-confirmed': e.billingStatus === 'verified-free-no-billing',
    'free-tier-eligible': e.freeTierEligible === true,
    'positive-remaining-quota': Number.isSafeInteger(e.remainingRequests) && e.remainingRequests > 0,
    'project-model-access-confirmed': e.projectModelAccessVerified === true,
    'privacy-permission-confirmed': e.privacyPermission === 'explicit-for-intended-data',
    'tenant-authorization-confirmed': e.tenantAuthorized === true,
    'model-allowlisted': FREE_GEMINI_MODEL_ALLOWLIST.includes(e.model),
    'zero-price-confirmed': e.verifiedModelPriceUsd === 0 && e.priceEvidenceTrusted === true,
    'server-key-present': e.serverKeyConfigured === true,
    'zero-cost-recording-available': e.zeroCostReceiptAvailable === true,
    'manual-admin-action-required': e.manualAdminAction === true,
    'paid-fallback-disabled': e.paidFallbackDisabled === true,
    'grounding-disabled': e.searchGroundingDisabled === true,
    'no-automatic-retries': e.automaticRetriesDisabled === true
  };
  const blockers = required.filter(k => checks[k] !== true);
  return Object.freeze({
    provider: 'Gemini-direct',
    model: checks['model-allowlisted'] ? e.model : null,
    status: blockers.length === 0 ? 'evidence-complete-not-executable' : 'blocked',
    blockers: Object.freeze(blockers),
    mayCallProvider: false,
    customerDataSent: false,
    inferenceRequests: 0,
    priceOrQuotaVerifiedByThisCheck: false
  });
}
