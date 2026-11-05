// Status-only diagnostic. Never grants a retry or schedules a provider call.
// A missing or unreadable attempts table is not proof of an empty history.
export function availableZeraAttemptHistory(tablePresent, rows) {
 return tablePresent===true && Array.isArray(rows) ? rows : null;
}

// Admin-only, redacted summary. Legacy null reasons cannot be reconstructed.
// Never turns a historical provider failure into a retry permission.
export function summarizeZeraAuditEvidence(attempts) {
 if(!Array.isArray(attempts))return {historyAvailable:false,attemptCount:null,unclassifiedFailures:0,comparisonLinks:0};
 return {
  historyAvailable:true,
  attemptCount:attempts.length,
  unclassifiedFailures:attempts.filter(a=>a?.status==='provider-failed'&&!a?.failureReason).length,
  comparisonLinks:attempts.filter(a=>Boolean(a?.comparisonId)).length
 };
}

export function summarizeZeraAttemptGate(attempts, enabled) {
 const invalidHistory=!Array.isArray(attempts);
 const prior=invalidHistory?[]:attempts;
 const hasPrior=prior.length>0;
 return {
  enabled:enabled===true,
  canStartNewAttempt:enabled===true&&!hasPrior&&!invalidHistory,
  blockedReason:invalidHistory?'attempt-history-unavailable':hasPrior?'previous-attempt-preserved':enabled===true?null:'provider-gate-closed',
  needsOperatorReview:hasPrior||invalidHistory,
  historicalFailureUnclassified:prior.some(a=>a?.status==='provider-failed'&&!a?.failureReason),
  attemptHistoryPreserved:true,
  automaticallyRetried:false
 };
}
