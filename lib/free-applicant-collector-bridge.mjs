import {runFreeBridgeTask} from './ai-bridge-free-inference.mjs';
import {freeMeasurementStatus} from './free-answer-evidence.mjs';
import {evidenceQueries,answerObservation} from './answer-evidence-rules.js';
import {persistTrustedFreeApplicantAnswer} from './free-applicant-trusted-capture.mjs';
import {readApplicantProviderConsent} from './applicant-free-provider-consent-read.mjs';

/** Isolated bridge for an eventual trusted ADMIN-only caller.
 * NOT connected to HTTP or production. Caller must independently verify
 * tenant ownership, the data subject's permission, the free account plan,
 * and the persisted provider cost receipt via a separate trusted DB read.
 * Never accept those predicates from browser JSON.
 */
export async function collectAndPersistVerifiedFreeApplicant({
  pool,entity,queries,env=process.env,consentVerified=false,tenantAuthorized=false,
  request=runFreeBridgeTask,findTrustedReceipt,readTrustedReceipt
}={}){
 const blocked=reason=>Object.freeze({accepted:0,attempted:0,reason,customerAcceptance:false});
 if(consentVerified!==true||tenantAuthorized!==true)return blocked('unverified-permission');
 if(entity?.entityType!=='prospect'||typeof entity?.id!=='string'||
    typeof entity?.domain!=='string'||typeof entity?.name!=='string')
    return blocked('unverified-prospect');
 const status=freeMeasurementStatus(env);
 if(!status.ready)return blocked('free-provider-not-configured');
 if(!pool||typeof pool.query!=='function'||typeof pool.connect!=='function')
    return blocked('proof-storage-unavailable');
 // Consent comes from a live, separate verified applicant action stored in
 // the database, not a browser Boolean or a previously verified email.
 const authorization=await readApplicantProviderConsent(pool,{
   prospectId:entity.id,businessDomain:entity.domain,provider:'OpenRouter'});
 if(authorization.authorized!==true)return blocked('verified-provider-consent-required');
 // Independent, persisted ledger evidence must be provided from trusted
 // server-side adapters. A provider self-report of usage.cost=0 cannot be
 // converted into its own proof receipt.
 if(typeof findTrustedReceipt!=='function'||typeof readTrustedReceipt!=='function')
    return blocked('independent-cost-proof-unavailable');
 // Require actual reviewed receipt schema before any network inference.
 try{
  const tables=(await pool.query(`SELECT
    to_regclass('public.free_applicant_verified_receipts') IS NOT NULL AS receipts,
    to_regclass('public.free_applicant_verified_observations') IS NOT NULL AS observations`)).rows?.[0];
  if(tables?.receipts!==true||tables?.observations!==true)
    return blocked('proof-storage-unavailable');
 }catch{return blocked('proof-storage-unavailable');}
 let neutral;
 try{
   neutral=evidenceQueries(entity,queries||[],/^(Türkiye|Turkey|TR)$/i.test(entity.country||'')?'tr':'en');
   if(!neutral.length||neutral.some(x=>x.brandPrompted))return blocked('neutral-queries-required');
 }catch{return blocked('invalid-neutral-queries');}
 const scope={tenantId:entity.id,domain:entity.domain};
 const results=[];
 const seen=new Set();
 for(const {query} of neutral){
  let response;
  try{
   response=await request({enabled:true,modelId:status.model,apiKey:env.OPENROUTER_API_KEY,
     prompt:query,timeoutMs:15000});
  }catch{response={ok:false,reason:'provider-exception'};}
  if(response?.ok!==true||response?.complete!==true||
     response.verifiedZeroPriceAtRequest!==true||response.modelId!==status.model||
     response.usage?.cost!==0||typeof response.responseId!=='string'||
     !response.responseId.trim()||response.responseId.length>200||
     seen.has(response.responseId)||typeof response.answer!=='string'||
     !response.answer.trim()||response.answer.length>500){
    results.push({stored:false,reason:'unverified-provider-response'});
    // Stop after failure; never fall back to paid models or retry.
    break;
  }
  seen.add(response.responseId);
  let receipt;
  try{
   receipt=await findTrustedReceipt({tenantId:entity.id,domain:entity.domain,
      provider:'OpenRouter',model:status.model,responseId:response.responseId,query});
  }catch{receipt=null;}
  if(typeof receipt?.id!=='string'||!receipt.id.trim()){
    results.push({stored:false,reason:'independent-cost-proof-unavailable'});
    break;
  }
  try{
   const stored=await persistTrustedFreeApplicantAnswer({pool,prospect:entity,
     providerAnswer:response,query,costReceipt:{id:receipt.id},
     trustedCostRead:readTrustedReceipt});
   results.push({stored:stored.stored===true,reason:stored.stored?'stored':stored.reason});
  }catch{results.push({stored:false,reason:'proof-store-failed'});}
  if(results.at(-1).stored!==true)break;
 }
 return Object.freeze({accepted:results.filter(r=>r.stored).length,
   attempted:results.length,reason:results.every(r=>r.stored)?'local-proof-persisted':'partial-or-rejected',
   // This bridge is never sufficient for public acceptance: two independent
   // providers, customer authorization and release approval remain separate.
   customerAcceptance:false});
}
