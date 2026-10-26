/** Safe, deliberately finite error labels for ZERA customer-visible diagnostics.
 * Provider exceptions may contain arbitrary upstream text, URLs or credentials.
 * Never echo those strings into an API response or customer page.
 */
const ALLOWED_REASONS=new Set([
  'no-answer',
  'not-configured',
  'empty-answer',
  'failed',
  'provider-temporarily-unavailable',
  'provider-quota-or-rate-limit',
  'provider-model-not-found',
  'provider-permission-denied',
]);

export function safeZeraProviderReason(reason){
  if(typeof reason!=='string')return 'provider-failed';
  if(ALLOWED_REASONS.has(reason))return reason;
  // The comparison engine emits HTTP status codes as provider-http-NNN.
  if(/^provider-http-[45][0-9]{2}$/.test(reason))return reason;
  return 'provider-failed';
}
