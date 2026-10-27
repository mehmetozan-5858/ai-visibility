/** Static diagnostic categories only. Never reflect error messages or SQL. */
export function comparisonAttemptFailure(error,stage){
 const safeStage=['provider','comparison-storage','attempt-status'].includes(stage)?stage:'unknown';
 const code=typeof error?.code==='string'?error.code:'';
 const categories={'42P01':'schema-unavailable','42703':'schema-mismatch','23503':'customer-reference-missing',
  '42501':'storage-permission-denied','57014':'storage-timeout','ECONNRESET':'storage-connection-failed',
  'ECONNREFUSED':'storage-connection-failed','ETIMEDOUT':'storage-timeout'};
 const category=Object.hasOwn(categories,code)?categories[code]:
  (/^08[A-Z0-9]{3}$/.test(code)?'storage-connection-failed':'internal-error');
 return Object.freeze({stage:safeStage,reason:safeStage==='provider'?'provider-processing-error':category,
  automaticRetryAllowed:false});
}
