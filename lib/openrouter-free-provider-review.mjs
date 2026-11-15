// REVIEW BRANCH — disabled unless explicitly opted in. Never fall back to a
// paid model; all remote calls require an explicit zero-price model identifier.
// This module is not a live provider receipt or customer delivery proof.
export function openRouterFreeConfig(env=process.env){
 const key=env.OPENROUTER_API_KEY;
 const model=env.OPENROUTER_FREE_MODEL;
 if(env.OPENROUTER_FREE_ENABLED!=='true')return {ready:false,reason:'disabled'};
 if(typeof key!=='string'||key.length<20)return {ready:false,reason:'missing-key'};
 if(typeof model!=='string'||model.length>120||
    !(model==='openrouter/free'||/^[a-z0-9_.-]+\/[a-z0-9_.-]+:free$/i.test(model)))
  return {ready:false,reason:'non-free-model-denied'};
 return {ready:true,model};
}
export async function runOpenRouterFreeReview(prompt,{
 env=process.env,fetcher=globalThis.fetch
}={}){
 const config=openRouterFreeConfig(env);
 if(!config.ready)throw Error('openrouter-free-'+config.reason);
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>16000)
  throw Error('openrouter-free-prompt-invalid');
 if(typeof fetcher!=='function')throw Error('openrouter-free-fetch-unavailable');
 // A :free suffix is never a price certificate. Require a current
 // catalog row with explicit zero pricing BEFORE a completion request.
 // Unknown/missing fields fail closed; no paid provider fallback.
 let catalog;
 try{
  const listing=await fetcher('https://openrouter.ai/api/v1/models',{
   method:'GET',redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(5000)
  });
  if(!listing?.ok)throw Error('catalog-http-unavailable');
  catalog=await listing.json();
 }catch{throw Error('openrouter-free-catalog-unavailable')}
 const row=Array.isArray(catalog?.data)
  ?catalog.data.find(x=>x?.id===config.model):null;
 const catalogPrice=row?.pricing;
 const fields=['prompt','completion'];
 const zero=value=>typeof value==='string'&&
   /^(?:0+(?:\.0+)?|0*\.0+)$/.test(value);
 if(!catalogPrice||typeof catalogPrice!=='object'||!fields.every(k=>zero(catalogPrice[k]))||
    Object.entries(catalogPrice).some(([key,val])=>key!=='prompt'&&key!=='completion'&&
       val!==null&&val!==undefined&&!zero(val)))
  throw Error('openrouter-free-catalog-zero-price-unverified');
 let r;
 try{
  r=await fetcher('https://openrouter.ai/api/v1/chat/completions',{
   method:'POST',redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(12000),
   headers:{'content-type':'application/json',
    authorization:'Bearer '+env.OPENROUTER_API_KEY},
   body:JSON.stringify({model:config.model,stream:false,max_tokens:900,
    temperature:0.2,messages:[{role:'user',content:prompt}]})
  });
 }catch{throw Error('openrouter-free-network-failed')}
 if(!r?.ok)throw Error('openrouter-free-provider-unavailable');
 let body;
 try{body=await r.json()}catch{throw Error('openrouter-free-response-invalid')}
 if(body?.error||body?.choices?.[0]?.finish_reason!=='stop'||
    typeof body?.choices?.[0]?.message?.content!=='string'||
    !body.choices[0].message.content.trim())
  throw Error('openrouter-free-response-incomplete');
 // Detect non-free routing if the response identifies a different model.
 const actual=body.model;
 if(typeof actual!=='string'||actual.length===0||
    !(actual==='openrouter/free'||actual.endsWith(':free')))
  throw Error('openrouter-free-model-not-proven');
 const price=body.usage?.cost;
 if(price!==undefined&&(!Number.isFinite(price)||price!==0))
  throw Error('openrouter-free-nonzero-cost');
 return {content:body.choices[0].message.content,
  model:actual,receiptId:typeof body.id==='string'?body.id:null,
  costVerified:price===0};
}
