/**
 * Candidate policy for future free applicant evidence admission.
 * Not wired into production scoring. The observation and receipt MUST come
 * from independent, trusted, tenant-scoped server-side persistence.
 * Browser-submitted receipts/booleans never qualify as trusted proof.
 */
const allowed = new Set(['OpenRouter','Gemini']);
const isString = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
export function eligibleFreeApplicantEvidence(observation, receipt, {tenantId, domain} = {}) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation) ||
      !receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  if (!allowed.has(observation.provider) || observation.provider !== receipt.provider) return false;
  if (!isString(tenantId) || !isString(domain) ||
      observation.tenantId !== tenantId || receipt.tenantId !== tenantId ||
      observation.domain !== domain || receipt.domain !== domain) return false;
  if (!isString(observation.responseId) || observation.responseId !== receipt.responseId ||
      !isString(observation.model) || observation.model !== receipt.model ||
      !isString(observation.query) || !isString(observation.text)) return false;
  if (observation.brandPrompted !== false || observation.truncated !== false ||
      typeof observation.brandMentioned !== 'boolean') return false;
  if (receipt.id == null || !isString(receipt.id) ||
      receipt.persisted !== true || receipt.verifiedZeroPriceAtRequest !== true ||
      receipt.estimated !== false || receipt.amount !== 0 || receipt.currency !== 'USD') return false;
  if (receipt.operation !== 'answer-evidence' || receipt.responseComplete !== true ||
      receipt.verifiedModelIdentity !== true) return false;
  if (!isString(receipt.query) || receipt.query !== observation.query) return false;
  return true;
}
