/**
 * REVIEW ONLY. Conservative, deliberately partial scan of known entitlement
 * writers. A clean result here can NEVER certify every external/admin writer.
 * Purpose: prevent accidental promotion of a cooperative advisory-lock design
 * while legacy account and pilot changes are still not lock-coordinated.
 */
export function auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource}={}){
 const findings=[];
 const need=(file,source,pattern,code)=>{
  if(typeof source!=='string'||!pattern.test(source))
   findings.push({code,file,reason:'source-or-required-writer-missing'});
 };
 need('lib/pilot-access.js',pilotSource,/export async function grantPilot\(/,'legacy-pilot-grant');
 need('lib/pilot-access.js',pilotSource,/export async function revokePilot\(/,'legacy-pilot-revoke');
 need('lib/repository.js',repositorySource,/export async function confirmPayment\(/,'legacy-payment-confirmation');
 need('lib/repository.js',repositorySource,/export async function confirmCardPaymentByMerchantOid\(/,'legacy-card-confirmation');
 need('lib/portal-pilot-writes-review.mjs',reviewSource,/withPilotWriteLockReview/,'review-writer-helper');
 if(typeof pilotSource==='string'){
  for(const [method,re] of [
   ['grantPilot',/export async function grantPilot\([\s\S]*?(?=export async function revokePilot)/],
   ['revokePilot',/export async function revokePilot\([\s\S]*$/]
  ]){
   const body=pilotSource.match(re)?.[0]||'';
   if(!body.includes('withPilotWriteLockReview('))
    findings.push({code:'legacy-pilot-write-unlocked',file:'lib/pilot-access.js',method});
  }
 }
 if(typeof repositorySource==='string'){
  for(const [method,re] of [
   ['confirmPayment',/export async function confirmPayment\([\s\S]*?(?=export async function upsertSalesOpportunity)/],
   ['confirmCardPaymentByMerchantOid',/export async function confirmCardPaymentByMerchantOid\([\s\S]*?(?=export async function markCardPaymentFailedByMerchantOid)/]
  ]){
   const body=repositorySource.match(re)?.[0]||'';
   if(!body||!body.includes('withPilotWriteLockReview('))
    findings.push({code:'account-activation-not-coordinated',file:'lib/repository.js',method});
  }
 }
 // Even if source scanning finds no known bypass, unknown admin SQL/edge
 // functions, settlement transitions and cross-repo writes stay unverified.
 const unresolvedExternal=['direct-admin-sql','account-suspension-and-deletion',
  'external-payment-webhooks','other-repository-and-edge-writers'];
 return {
  ready:false,reason:'external-entitlement-writers-not-exhaustively-verified',
  findings,unresolvedExternal
 };
}
