/** DRAFT / NOT EXPOSED AS AN API ROUTE.
 * Assembles a provider result and a separate trusted DB cost receipt.
 * Scope must come from a server-authorized prospect lookup. The caller
 * must independently verify the provider's true zero-price eligibility and
 * cost receipt; a provider-reported usage.cost=0 is NOT that verification.
 */
import {answerObservation} from './answer-evidence-rules.js';
import {persistVerifiedFreeApplicantPair} from './free-applicant-atomic-store.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function persistTrustedFreeApplicantAnswer({
 pool, prospect, providerAnswer, query, costReceipt, trustedCostRead
}={}){
 const blocked=reason=>Object.freeze({stored:false,reason});
 if(!prospect||!uuid.test(prospect.id||'')||
    typeof prospect.domain!=='string'||!prospect.domain.trim()||
    typeof prospect.name!=='string'||!prospect.name.trim())
   return blocked('unverified-prospect-scope');
 if(!providerAnswer||providerAnswer.ok!==true||
    providerAnswer.complete!==true||providerAnswer.verifiedZeroPriceAtRequest!==true||
    providerAnswer.usage?.cost!==0||
    typeof providerAnswer.modelId!=='string'||!providerAnswer.modelId.endsWith(':free')||
    typeof providerAnswer.responseId!=='string'||!providerAnswer.responseId.trim()||
    providerAnswer.responseId.length>200||typeof providerAnswer.answer!=='string'||
    !providerAnswer.answer.trim()||providerAnswer.answer.length>5000||
    typeof query!=='string'||query.length<8||query.length>500)
   return blocked('ineligible-provider-answer');
 // Never construct a fake proof by copying the upstream self-reported zero.
 // A separate trusted server/database verification is mandatory.
 if(!costReceipt||typeof costReceipt.id!=='string'||!costReceipt.id.trim()||
    typeof trustedCostRead!=='function')
   return blocked('trusted-cost-receipt-required');
 let verified;
 try{verified=await trustedCostRead(costReceipt.id,prospect.id);}
 catch{return blocked('trusted-cost-read-unavailable');}
 if(!verified||verified.id!==costReceipt.id||
    verified.tenantId!==prospect.id||verified.domain!==prospect.domain||
    verified.provider!=='OpenRouter'||verified.model!==providerAnswer.modelId||
    verified.responseId!==providerAnswer.responseId||verified.query!==query||
    verified.amount!==0||verified.currency!=='USD'||verified.estimated!==false||
    verified.verifiedZeroPriceAtRequest!==true||verified.responseComplete!==true||
    verified.verifiedModelIdentity!==true||verified.operation!=='answer-evidence')
   return blocked('trusted-cost-not-verified');
 let observation;
 try{observation=answerObservation(prospect,{
   provider:'OpenRouter',model:providerAnswer.modelId,query,
   text:providerAnswer.answer,responseId:providerAnswer.responseId,
   mode:'openrouter-free-api-no-search',complete:true,
   usage:{cost:{total_cost:0,currency:'USD'}},citations:[]
  });}catch{return blocked('invalid-observation');}
 if(observation.truncated||observation.brandPrompted)
   return blocked('non-neutral-or-incomplete');
 const scope={tenantId:prospect.id,domain:prospect.domain};
 const proofObservation={
   tenantId:scope.tenantId,domain:scope.domain,provider:observation.provider,
   model:observation.model,responseId:observation.responseId,query,
   text:observation.text,brandMentioned:observation.brandMentioned,
   brandPrompted:observation.brandPrompted,truncated:observation.truncated,
   mode:observation.mode,recordedAt:new Date().toISOString()
 };
 return persistVerifiedFreeApplicantPair({pool,scope,observation:proofObservation,
  receipt:{...verified,persisted:true}});
}
