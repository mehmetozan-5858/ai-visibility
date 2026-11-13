import {randomUUID} from 'node:crypto';
import {runFreeBridgeTask} from './ai-bridge-free-inference.mjs';
import {freeMeasurementStatus} from './free-answer-evidence.mjs';
import {evidenceQueries,answerObservation} from './answer-evidence-rules.js';
import {persistVerifiedFreeApplicantPair} from './free-applicant-atomic-store.mjs';

/** Isolated bridge for an eventual trusted ADMIN-only caller.
 * NOT connected to HTTP or production. Caller must independently verify
 * tenant ownership, the data subject's permission, and the free account plan.
 * Never accept those predicates from browser JSON.
 */
export async function collectAndPersistVerifiedFreeApplicant({
  pool,entity,queries,env=process.env,consentVerified=false,tenantAuthorized=false,
  request=runFreeBridgeTask,receiptId=randomUUID,now=()=>new Date().toISOString()
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
  let observation,receipt;
  try{
   const obs=answerObservation(entity,{provider:'OpenRouter',model:status.model,query,
     text:response.answer,responseId:response.responseId,mode:'openrouter-free-api-no-search',
     complete:true,citations:[]},now());
   observation={tenantId:entity.id,domain:entity.domain,provider:'OpenRouter',
     model:status.model,responseId:response.responseId,query,text:obs.text,
     brandMentioned:obs.brandMentioned,brandPrompted:obs.brandPrompted,
     truncated:obs.truncated,mode:obs.mode,recordedAt:obs.checkedAt};
   receipt={id:receiptId(),tenantId:entity.id,domain:entity.domain,
     provider:'OpenRouter',model:status.model,responseId:response.responseId,
     query,amount:0,currency:'USD',estimated:false,operation:'answer-evidence',
     persisted:true,verifiedZeroPriceAtRequest:true,responseComplete:true,
     verifiedModelIdentity:true};
  }catch{results.push({stored:false,reason:'invalid-provider-observation'});break;}
  try{
   const stored=await persistVerifiedFreeApplicantPair({pool,scope,observation,receipt});
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
