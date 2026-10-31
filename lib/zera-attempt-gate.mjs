// Status-only diagnostic. Never grants a retry or schedules a provider call.
export function summarizeZeraAttemptGate(attempts, enabled) {
 const prior=Array.isArray(attempts)?attempts:[];
 const hasPrior=prior.length>0;
 return {
  enabled:enabled===true,
  canStartNewAttempt:enabled===true&&!hasPrior,
  blockedReason:hasPrior?'previous-attempt-preserved':enabled===true?null:'provider-gate-closed',
  needsOperatorReview:hasPrior,
  attemptHistoryPreserved:true,
  automaticallyRetried:false
 };
}
