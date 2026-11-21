import {runFreeBridgeTask,freeProviderFailureDetails,ZERA_ALTERNATE_FREE_MODEL} from './ai-bridge-free-inference.mjs';
import {answerObservation,answerSummary,evidenceQueries} from './answer-evidence-rules.js';
const safeReasons=new Set(['inference-disabled','missing-server-key','non-free-model-denied','invalid-prompt','unavailable-transport','invalid-timeout','model-catalog-unavailable','model-not-verified-free','provider-request-failed','unexpected-model','empty-response','nonzero-cost-reported','timeout','transport-error']);
const modelPattern=/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*:free$/i;
export {ZERA_ALTERNATE_FREE_MODEL};
export function freeMeasurementStatus(env=process.env,model=env.OPENROUTER_FREE_MODEL){
 const enabled=env.APPLICANT_FREE_MEASUREMENT_ENABLED==='true';
 const serverKeyConfigured=typeof env.OPENROUTER_API_KEY==='string'&&!!env.OPENROUTER_API_KEY.trim();
 const modelConfigured=modelPattern.test(model||'');
 return {enabled,serverKeyConfigured,modelConfigured,ready:enabled&&serverKeyConfigured&&modelConfigured,
  model:modelConfigured?model:null,provider:'OpenRouter',maxQueries:2,
  priceVerified:false,scope:'Configuration only; catalog price is rechecked before each request.'};
}
export const FREE_MODEL_FALLBACKS = [
 'google/gemma-4-26b-a4b-it:free',
 'baidu/ernie-5.5-flash-preview:free',
 'nvidia/nemotron-3-ultra:free',
];

// Only the scheduled path opts into fallback. Historical comparisons keep their original model.
export async function collectFreeAnswerEvidence(entity,{queries=[],language='tr'}={},deps={}){
 const env=deps.env||process.env,status=freeMeasurementStatus(env,deps.model);
 if(!status.ready)throw Error('free-measurement-not-configured');
 const requested=evidenceQueries(entity,queries,language),observations=[],errors=[],fallbackAttempts=[];
 const models=[...new Set([status.model,...(deps.fallbackModels||[]).filter(id=>typeof id==='string'&&modelPattern.test(id))])].slice(0,4);
 const request=deps.request||runFreeBridgeTask;
 const recordCost=deps.recordCost||(await import('./agent-coordination.js')).recordOperationalCost;
 for(const {query,brandPrompted} of requested){
  if(brandPrompted)throw Error('neutral-free-query-required');
 }
 let rateLimited=false;
 for(const {query} of requested){
  if(rateLimited){errors.push({provider:'OpenRouter',query,reason:'skipped-after-rate-limit',error:'İlk sorgu kota sınırına takıldığı için bu sorgu sağlayıcıya gönderilmedi.'});continue;}
  let phase='provider';
  try{
   let modelId,answer;
   for(const [index,candidate] of models.entries()){
    modelId=candidate;
    answer=await request({modelId,prompt:query,apiKey:env.OPENROUTER_API_KEY,enabled:true,timeoutMs:models.length>1?5500:15000});
    const canSwitch=answer.reason==='model-not-verified-free'||
     (answer.status===429 && answer.limitSource==='upstream_provider_shared_pool');
    if(answer.ok||!canSwitch||index===models.length-1)break;
    fallbackAttempts.push({modelId,reason:answer.reason,...freeProviderFailureDetails(answer)});
   }
   if(!answer.ok){
    rateLimited=answer.status===429;
    errors.push({provider:'OpenRouter',query,reason:safeReasons.has(answer.reason)?answer.reason:'unclassified-provider-failure',
     ...(Number.isInteger(answer.status)&&answer.status>=400&&answer.status<=599?{providerStatus:answer.status}:{}),
     ...(rateLimited || answer.reason === 'empty-response' ? freeProviderFailureDetails(answer) : {}),
     error:'Ücretsiz sağlayıcı çağrısı tamamlanamadı; ücretli sağlayıcı denenmedi.'});continue;
   }
   if(answer.verifiedZeroPriceAtRequest!==true||answer.usage?.cost!==0||answer.modelId!==modelId){
    errors.push({provider:'OpenRouter',query,reason:'answer-verification-failed',error:'Yanıt kimliği veya sıfır maliyet doğrulanamadı; uygun örnek sayılmadı.'});continue;
   }
   phase='cost';
   const cost=await recordCost({costType:'ai-provider',provider:'OpenRouter',operation:'answer-evidence',marketKey:'business:ai',amount:0,currency:'USD',estimated:false,
    metadata:{engine:'business',pricingSource:'provider-reported-zero',model:answer.modelId}});
   if(typeof cost?.id!=='string'||!cost.id)throw Error('cost-not-persisted');
   phase='observation';
   observations.push(answerObservation(entity,{provider:'OpenRouter',model:answer.modelId,query,text:answer.answer,
    responseId:answer.responseId||'',mode:'openrouter-free-api-no-search',complete:answer.complete===true,
    usage:{cost:{total_cost:0,currency:'USD'}},citations:[]}));
  }catch{errors.push({provider:'OpenRouter',query,reason:phase==='cost'?'cost-recording-failed':phase==='observation'?'invalid-observation':'transport-error',error:'Ücretsiz yanıt veya maliyet doğrulaması tamamlanamadı; ücretli sağlayıcı denenmedi.'})}
 }
 return {queries:requested.map(x=>x.query),observations,errors,summary:answerSummary(observations,errors),measurementPolicy:'verified-zero-price-only',...(fallbackAttempts.length?{fallbackAttempts}:{})};
}
