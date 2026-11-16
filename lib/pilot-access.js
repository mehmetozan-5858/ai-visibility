import {grantPilotWithLockReview,revokePilotWithLockReview} from './portal-pilot-writes-review.mjs';
import {customerHasVerifiedSettlement} from './customer-settlement-proof.mjs';
import {databasePool} from './database-runtime';
import {getDatabaseUrl} from './db';
// Client pilot access schema is provisioned separately, not from an API request.
function pool(){return databasePool(getDatabaseUrl())}
export function accountHasPaidAccess(account){return Boolean(account&&account.client?.status!=='payment-review'&&(account.payments||[]).some(x=>x.status==='paid'))}
export async function getPilotAccess(clientId){const p=pool();return (await p.query('SELECT email,expires_at AS "expiresAt" FROM client_pilot_access WHERE client_id=$1 AND revoked_at IS NULL AND expires_at>NOW()',[clientId])).rows[0]||null}
export async function customerAccess(account){
 if(!account)return {allowed:false};
 // A suspended account must not regain report access through an older pilot.
 if(account.client?.status==='payment-review')return {allowed:false};
 const paidLabel=accountHasPaidAccess(account);
 if(paidLabel){
  // Legacy behavior only until the separately approved strict launch flag is enabled.
  if(process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED!=='true')
   return {allowed:true,kind:'paid'};
  if(await customerHasVerifiedSettlement(account.client.id))
   return {allowed:true,kind:'paid'};
 }
 // A historical bank-transfer "paid" label must not suppress a separately
 // authorized and unexpired pilot; the pilot has its own explicit entitlement.
 const pilot=await getPilotAccess(account.client.id);
 if(pilot)return {allowed:true,kind:'pilot',...pilot};
 return paidLabel
  ?{allowed:false,kind:'payment-review',reason:'independent-settlement-proof-required'}
  :{allowed:false};
}
const PILOT_TENANT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// REVIEW BRANCH ONLY: pilot writers now share the same transaction advisory
// lock namespace as the uninstalled one-time report SQL candidate.
// This is not sufficient for a release: account/payment/admin writers remain
// uncoordinated and the report migration is not installed or proven on Neon.
export async function grantPilot(clientId,email,days,reason){
 if(!PILOT_TENANT_UUID.test(String(clientId))||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
  !Number.isInteger(days)||days<1||days>30||
  typeof reason!=='string'||reason.length<10)throw Error('invalid-pilot');
 return grantPilotWithLockReview(pool(),clientId,email,days,reason);
}
export async function revokePilot(clientId){
 if(!PILOT_TENANT_UUID.test(String(clientId)))throw Error('invalid-pilot');
 return revokePilotWithLockReview(pool(),clientId);
}
