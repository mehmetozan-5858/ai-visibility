/**
 * REVIEW ONLY. Conservative, deliberately partial scan of known entitlement
 * writers. A clean result here can NEVER certify every external/admin writer.
 * Purpose: prevent accidental promotion of a cooperative advisory-lock design
 * while legacy account and pilot changes are still not lock-coordinated.
 */
export function auditPortalEntitlementWriterCoverage({pilotSource,repositorySource,reviewSource,reversalSource}={}){
 const findings=[];
 const need=(file,source,pattern,code)=>{
  if(typeof source!=='string'||!pattern.test(source))
   findings.push({code,file,reason:'source-or-required-writer-missing'});
 };
 need('lib/pilot-access.js',pilotSource,/export async function grantPilot\(/,'legacy-pilot-grant');
 need('lib/pilot-access.js',pilotSource,/export async function revokePilot\(/,'legacy-pilot-revoke');
 need('lib/repository.js',repositorySource,/export async function confirmPayment\(/,'legacy-payment-confirmation');
 need('lib/repository.js',repositorySource,/export async function confirmCardPaymentByMerchantOid\(/,'legacy-card-confirmation');
 need('lib/repository.js',repositorySource,/export async function markCardPaymentFailedByMerchantOid\(/,'legacy-card-failure');
 need('lib/portal-pilot-writes-review.mjs',reviewSource,/withPilotWriteLockReview/,'review-writer-helper');
 need('lib/payment-reversal.js',reversalSource,/export async function reversePayment\(/,'bank-payment-reversal');
 if(typeof pilotSource==='string'){
  // Explicit release blocker: legacy paid-label access is independent of
  // verified settlement and the report RPC's strict pilot-only authority.
  // Preserve legacy behavior in this review branch; flag it, do not change it.
  const accessStart=pilotSource.indexOf('export async function customerAccess(');
  const accessEnd=pilotSource.indexOf('const PILOT_TENANT_UUID=',accessStart);
  const accessBody=accessStart>=0
   ?pilotSource.slice(accessStart,accessEnd>accessStart?accessEnd:undefined):'';
  if(accessBody&&
     /CUSTOMER_SETTLEMENT_PROOF_ENABLED/.test(accessBody)&&
     /return\s*\{allowed:true,kind:'paid'\}/.test(accessBody))
   findings.push({code:'legacy-paid-label-entitlement-unverified',
    file:'lib/pilot-access.js',method:'customerAccess'});
 }
 if(typeof pilotSource==='string'){
  for(const [method,re] of [
   ['grantPilot',/export async function grantPilot\([\s\S]*?(?=export async function revokePilot)/],
   ['revokePilot',/export async function revokePilot\([\s\S]*$/]
  ]){
   const body=pilotSource.match(re)?.[0]||'';
   const required=method==='grantPilot'?'grantPilotWithLockReview(':'revokePilotWithLockReview(';
   if(!body.includes(required))
    findings.push({code:'legacy-pilot-write-unlocked',file:'lib/pilot-access.js',method});
  }
 }
 if(typeof repositorySource==='string'){
  for(const [method,next] of [
   ['confirmPayment','export async function upsertSalesOpportunity'],
   ['confirmCardPaymentByMerchantOid','export async function markCardPaymentFailedByMerchantOid'],
   ['markCardPaymentFailedByMerchantOid','export async function addClientActivity']
  ]){
   const beginning='export async function '+method+'(';
   const start=repositorySource.indexOf(beginning);
   const end=start>=0?repositorySource.indexOf(next,start+beginning.length):-1;
   const body=start>=0?repositorySource.slice(start,end>start?end:undefined):'';
   if(!body||(!body.includes('withPilotWriteLockReview(')&&!body.includes('acquirePilotAdvisoryLockReview(tx,bound.clientId)')))
    findings.push({code:'account-activation-not-coordinated',file:'lib/repository.js',method});
  }
 }
 // An advisory lock cannot repair split-transaction card activation:
 // flag this additional independent release blocker without touching payment.
 if(typeof repositorySource==='string'){
  const start=repositorySource.indexOf('export async function confirmCardPaymentByMerchantOid(');
  const end=repositorySource.indexOf('export async function markCardPaymentFailedByMerchantOid(',start);
  const card=start>=0?repositorySource.slice(start,end>start?end:undefined):'';
  if(!card||(card.includes('pool.query(')&&card.includes('UPDATE payments')&&
    card.includes('UPDATE clients')&&!card.includes("await tx.query('BEGIN'")))
   findings.push({code:'card-activation-not-atomic',file:'lib/repository.js',
    method:'confirmCardPaymentByMerchantOid'});
 }
 if(typeof reversalSource==='string'){
  // This is a source-only review. Order matters: acquiring the payment
  // row lock first can deadlock with transaction writers that take the
  // tenant advisory lock first. A missing/new writer always remains HOLD.
  const start=reversalSource.indexOf('export async function reversePayment(');
  const body=start>=0?reversalSource.slice(start):'';
  const tenant=body.indexOf('SELECT client_id AS "clientId" FROM payments WHERE id=$1');
  const lock=body.indexOf('await acquirePilotAdvisoryLockReview(tx,bound.clientId)');
  const rowLock=body.indexOf('SELECT * FROM payments WHERE id=$1 AND client_id=$2 FOR UPDATE');
  const account=body.indexOf("UPDATE clients SET status='payment-review'");
  if(tenant<0||lock<=tenant||rowLock<=lock||account<=rowLock||
     !body.includes('BEGIN ISOLATION LEVEL READ COMMITTED')||
     !body.includes('await tx.query("ROLLBACK")'))
   findings.push({code:'bank-payment-reversal-lock-order-unverified',
    file:'lib/payment-reversal.js',method:'reversePayment'});
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
