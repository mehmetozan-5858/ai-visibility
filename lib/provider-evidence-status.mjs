/** Classify provider observations without inferring live health from historical counts. */
export function providerEvidenceStatus(record, now = Date.now()) {
  const unknown = (reason) => ({status:'unknown', reason, measuredAt:null});
  if (!record || typeof record !== 'object') return unknown('no-record');
  if (record.enabled === false) return {status:'disabled', reason:'explicitly-disabled', measuredAt:null};
  if (record.enabled !== true) return unknown('configuration-unverified');
  if (record.consent !== true || record.authorized !== true) return {status:'blocked', reason:'consent-or-authorization-unverified', measuredAt:null};
  if (record.errorCategory === 'quota' || record.errorCategory === 'rate-limit') return {status:'blocked', reason:record.errorCategory, measuredAt:null};
  if (record.errorCategory) return {status:'error', reason:'provider-or-persistence-error', measuredAt:null};
  const {responseId, persisted, observedAt, evidenceType} = record;
  if (evidenceType !== 'real-api-response' || typeof responseId !== 'string' || !responseId.trim() || persisted !== true) return unknown('no-verified-persisted-api-response');
  const timestamp = Date.parse(observedAt);
  if (typeof observedAt !== 'string' || !Number.isFinite(timestamp) || timestamp > now || timestamp < 0) return unknown('invalid-evidence-time');
  const measuredAt = new Date(timestamp).toISOString();
  if (now - timestamp > 24 * 60 * 60 * 1000) return {status:'historical', reason:'last-verified-response-older-than-24h', measuredAt};
  return {status:'recent-evidence', reason:'verified-persisted-api-response-within-24h', measuredAt};
}
