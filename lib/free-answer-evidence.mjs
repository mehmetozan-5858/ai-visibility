import {runFreeBridgeTask,freeProviderFailureDetails} from './ai-bridge-free-inference.mjs';
import {answerObservation,answerSummary,evidenceQueries} from './answer-evidence-rules.js';
const safeReasons=new Set(['inference-disabled','missing-server-key','non-free-model-denied','invalid-prompt','unavailable-transport','invalid-timeout','model-catalog-unavailable','model-not-verified-free','provider-request-failed','unexpected-model','empty-response','nonzero-cost-reported','missing-response-identity','incomplete-provider-response','timeout','transport-error']);
const modelPattern=/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*:free$/i;
export function freeMeasurementStatus(env=process.env){
 const enabled=env.APPLICANT_FREE_MEASUREMENT_ENABLED==='true';
 const serverKeyConfigured=typeof env.OPENROUTER_API_KEY==='string'&&!!env.OPENROUTER_API_KEY.trim();
 const modelConfigured=modelPattern.test(env.OPENROUTER_FREE_MODEL||'');
 return {enabled,serverKeyConfigured,modelConfigured,ready:enabled&&serverKeyConfigured&&modelConfigured,
  model:modelConfigured?env.OPENROUTER_FREE_MODEL:null,provider:'OpenRouter',maxQueries:2,
  priceVerified:false,scope:'Configuration only; catalog price is rechecked before each request.'};
}
// Explicit manual path only. Never call the normal paid-capable provider collector.
export async function collectFreeAnswerEvidence(entity,{queries=[],language='tr'}={},deps={}){
 const env=deps.env||process.env,status=freeMeasurementStatus(env);
 if(!status.ready)throw Error('free-measurement-not-configured');
 const requested=evidenceQueries(entity,queries,language),observations=[],errors=[];
 const request=deps.request||runFreeBridgeTask;
 const recordCost=deps.recordCost||(await import('./agent-coordination.js')).recordOperationalCost;
 for(const {query,brandPrompted} of requested){
  if(brandPrompted)throw Error('neutral-free-query-required');
 }
 let rateLimited=false;
 const observedResponseIds=new Set();
 for(const {query} of requested){
  if(rateLimited){errors.push({provider:'OpenRouter',query,reason:'skipped-after-rate-limit',error:'İlk sorgu kota sınırına takıldığı için bu sorgu sağlayıcıya gönderilmedi.'});continue;}
  let phase='provider';
  try{
   const answer=await request({modelId:status.model,prompt:query,apiKey:env.OPENROUTER_API_KEY,enabled:true,timeoutMs:15000});
   if(!answer.ok){
    rateLimited=answer.status===429;
    errors.push({provider:'OpenRouter',query,reason:safeReasons.has(answer.reason)?answer.reason:'unclassified-provider-failure',
     ...(Number.isInteger(answer.status)&&answer.status>=400&&answer.status<=599?{providerStatus:answer.status}:{}),
     ...(rateLimited?freeProviderFailureDetails(answer):{}),
     error:'Ücretsiz sağlayıcı çağrısı tamamlanamadı; ücretli sağlayıcı denenmedi.'});continue;
   }
   if(answer.verifiedZeroPriceAtRequest!==true||answer.usage?.cost!==0||answer.modelId!==status.model){
    errors.push({provider:'OpenRouter',query,reason:'answer-verification-failed',error:'Yanıt kimliği veya sıfır maliyet doğrulanamadı; uygun örnek sayılmadı.'});continue;
   }
   // A provider report with no exact identity, or a replayed response,
   // cannot be linked one-to-one to a trusted cost receipt. Never write its cost.
   if(typeof answer.responseId!=='string'||!answer.responseId.trim()||answer.responseId.length>200||
      observedResponseIds.has(answer.responseId)){
    errors.push({provider:'OpenRouter',query,reason:'answer-verification-failed',
      error:'Sağlayıcı yanıt kimliği eksik veya tekrarlı; kanıt kaydedilmedi.'});
    continue;
   }
   observedResponseIds.add(answer.responseId);
   phase='cost';
   const cost=await recordCost({costType:'ai-provider',provider:'OpenRouter',operation:'answer-evidence',marketKey:'business:ai',
    ...(entity.entityType==='prospect'?{prospectId:entity.id}:{}),
    amount:0,currency:'USD',estimated:false,
    metadata:{engine:'business',pricingSource:'provider-reported-zero',
      model:answer.modelId,responseId:answer.responseId}});
   if(typeof cost?.id!=='string'||!cost.id)throw Error('cost-not-persisted');
   phase='observation';
   observations.push(answerObservation(entity,{provider:'OpenRouter',model:answer.modelId,query,text:answer.answer,
    responseId:answer.responseId||'',mode:'openrouter-free-api-no-search',complete:answer.complete===true,
    usage:{cost:{total_cost:0,currency:'USD'}},citations:[]}));
  }catch{errors.push({provider:'OpenRouter',query,reason:phase==='cost'?'cost-recording-failed':phase==='observation'?'invalid-observation':'transport-error',error:'Ücretsiz yanıt veya maliyet doğrulaması tamamlanamadı; ücretli sağlayıcı denenmedi.'})}
 }
 return {queries:requested.map(x=>x.query),observations,errors,summary:answerSummary(observations,errors),measurementPolicy:'verified-zero-price-only'};
}
