import {budgetFetch,withRequestBudget} from './request-budget.js';
import {answerObservation,answerSummary,evidenceQueries,parsePerplexityAnswer} from './answer-evidence-rules.js';
import {recordOperationalCost} from './agent-coordination';
export function answerProviders(env=process.env){return ['ChatGPT','Gemini','Perplexity'].filter(p=>p==='ChatGPT'?env.OPENAI_API_KEY||env.AI_PROVIDER_API_KEY||env.AI_GATEWAY_API_KEY||env.VERCEL_OIDC_TOKEN||env.VERCEL:p==='Gemini'?env.GEMINI_API_KEY:env.PERPLEXITY_API_KEY)}
async function json(url,body,headers={}){const r=await budgetFetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});if(!r.ok)throw Error('provider-http-'+r.status);return r.json()}
export async function requestAnswer(provider,query){
 if(provider==='ChatGPT'){
  const key=process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY,model=process.env.OPENAI_MODEL||'gpt-4.1-mini';
  if(key){const d=await json('https://api.openai.com/v1/chat/completions',{model,messages:[{role:'user',content:query}],max_completion_tokens:1500},{authorization:'Bearer '+key});return {text:d.choices?.[0]?.message?.content||'',model:d.model||model,responseId:d.id||'',usage:d.usage||null,citations:[],mode:'api-no-search',complete:d.choices?.[0]?.finish_reason==='stop'}}
  const {generateText}=await import('ai');const m=process.env.OPENAI_GATEWAY_MODEL||'openai/gpt-5-nano';const d=await generateText({model:m,prompt:query,maxOutputTokens:1500,maxRetries:0,abortSignal:AbortSignal.timeout(15000)});return {text:d.text,model:m,responseId:d.response?.id||'',usage:d.usage||null,citations:[],mode:'api-no-search',complete:d.finishReason==='stop'};
 }
 if(provider==='Gemini'){
  const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';const d=await json(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,{contents:[{parts:[{text:query}]}],generationConfig:{maxOutputTokens:1500}}),c=d.candidates?.[0];return {text:(c?.content?.parts||[]).filter(x=>!x.thought).map(x=>x.text||'').join('\n'),model:d.modelVersion||model,responseId:d.responseId||'',usage:d.usageMetadata||null,citations:[],mode:'api-no-search',complete:c?.finishReason==='STOP'};
 }
 const d=await json('https://api.perplexity.ai/v1/agent',{preset:process.env.PERPLEXITY_PRESET||'fast',input:query,max_output_tokens:1500},{authorization:'Bearer '+process.env.PERPLEXITY_API_KEY});return {...parsePerplexityAnswer(d),mode:'agent-api'};
}
export async function collectAnswerEvidence(entity,{queries=[],language='tr',providers,request=requestAnswer,recordCost=recordOperationalCost,env=process.env}={}){
 const requested=evidenceQueries(entity,queries,language),available=answerProviders(env),selected=providers?available.filter(p=>providers.includes(p)):available;
 if(!selected.length)throw Error('answer-provider-not-configured');
 const observations=[],errors=[];
 await Promise.allSettled(selected.map(async provider=>{for(const {query} of requested){
  const start=Date.now();try{
   const answer=await withRequestBudget(15000,()=>request(provider,query));
   const configured=Number(env[`AI_COST_${provider.toUpperCase()}_USD`]),actual=Number(answer.usage?.cost?.total_cost),hasActual=answer.usage?.cost?.currency==='USD'&&Number.isFinite(actual)&&actual>=0,hasEstimate=Number.isFinite(configured)&&configured>0;
   await recordCost({costType:'ai-provider',provider,operation:'answer-evidence',marketKey:'business:ai',amount:hasActual?actual:hasEstimate?configured:0,currency:'USD',estimated:!hasActual,metadata:{engine:'business',pricingSource:hasActual?'provider-reported':hasEstimate?'env-estimate':'unconfigured-zero',usage:answer.usage||null,latencyMs:Date.now()-start}});
   observations.push(answerObservation(entity,{...answer,provider,query}));
  }catch{errors.push({provider,query,error:'Yanıt veya maliyet kaydı tamamlanamadı; yokluk sonucu çıkarılamaz.'})}
 }}));
 observations.sort((a,b)=>selected.indexOf(a.provider)-selected.indexOf(b.provider)||requested.findIndex(x=>x.query===a.query)-requested.findIndex(x=>x.query===b.query));
 return {queries:requested.map(x=>x.query),observations,errors,summary:answerSummary(observations,errors)};
}
