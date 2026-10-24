import {runGroundedZeraCheck} from './zera-grounded-gemini.mjs';
import {AUDIT_TASKS} from './zera-audit-queue.mjs';

export const ZERA_PROVIDERS=Object.freeze(['gemini','openai','perplexity']);
/** One query across selected providers. Generic model output is NEVER treated as source evidence. */
export async function compareZeraProviders({taskId,providers=ZERA_PROVIDERS,keys={},fetchImpl=fetch}={}){
 const task=AUDIT_TASKS.find(t=>t.id===taskId);
 if(!task)throw Error('Unknown audit task');
 if(!Array.isArray(providers)||!providers.length||providers.length>3||new Set(providers).size!==providers.length||providers.some(p=>!ZERA_PROVIDERS.includes(p)))throw Error('Invalid providers');
 const results=[];
 for(const provider of providers){
  if(!keys[provider]){results.push({provider,status:'not-configured',verified:false});continue}
  try{
   if(provider==='gemini'){
    const data=await runGroundedZeraCheck({taskId,key:keys.gemini,fetchImpl});
    results.push({provider,status:data.status,verified:data.status==='evidence_recorded',brandMention:data.brandMention||'unknown',evidence:data.result?.evidence||null,reason:data.reason||null});
   }else{
    // Answer comparison is useful; without trusted native citations it is not verifiable evidence.
    const url=provider==='openai'?'https://api.openai.com/v1/chat/completions':'https://api.perplexity.ai/chat/completions';
    const model=provider==='openai'?'gpt-4.1-mini':'sonar';
    const reply=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+keys[provider]},body:JSON.stringify({model,messages:[{role:'user',content:task.query}]})});
    if(!reply.ok)throw Error('provider-http-'+reply.status);
    const data=await reply.json();
    const answer=String(data?.choices?.[0]?.message?.content||'').slice(0,2000);
    results.push({provider,status:answer?'answer-received-unverified':'empty-answer',verified:false,brandMention:answer.toLowerCase().includes('zera')?'possible-mention':'not-observed',answer,evidence:null});
   }
  }catch(err){results.push({provider,status:'failed',verified:false,reason:String(err?.message||err).slice(0,120)})}
 }
 return {taskId,query:task.query,results,verifiedCount:results.filter(r=>r.verified).length,
  disclaimer:'Comparative provider answers are not verified search rankings; only supported citations count as evidence.'};
}
