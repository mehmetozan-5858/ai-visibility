// Status-only diagnostic. Never grants a retry or schedules a provider call.
export function summarizeZeraAttemptGate(attempts, enabled) {
 const invalidHistory=!Array.isArray(attempts);
 const prior=invalidHistory?[]:attempts;
 const hasPrior=prior.length>0;
 return {
  enabled:enabled===true,
  canStartNewAttempt:enabled===true&&!hasPrior&&!invalidHistory,
  blockedReason:invalidHistory?'attempt-history-unavailable':hasPrior?'previous-attempt-preserved':enabled===true?null:'provider-gate-closed',
  needsOperatorReview:hasPrior||invalidHistory,
  attemptHistoryPreserved:true,
  automaticallyRetried:false
 };
}
