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
