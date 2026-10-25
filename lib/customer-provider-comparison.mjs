/** Shared, customer-neutral three-provider comparison engine.
 * Explicitly called; no writes, scheduled execution, or automatic charges.
 */
export const PROVIDERS=Object.freeze(['gemini','openai','perplexity']);
export async function compareCustomerProviders({client,query,providers=PROVIDERS,keys={},fetchImpl=fetch}={}){
 if(!client?.id||!String(client.name||'').trim())throw Error('Valid customer required');
 if(typeof query!=='string'||!query.trim()||query.length>500)throw Error('Invalid query');
 if(!Array.isArray(providers)||!providers.length||providers.length>3||new Set(providers).size!==providers.length||providers.some(p=>!PROVIDERS.includes(p)))throw Error('Invalid provider selection');
 const results=[];
 for(const provider of providers){
  if(!keys[provider]){results.push({provider,status:'not-configured',verified:false});continue}
  try{
   const model=provider==='gemini'?(process.env.ZERA_GEMINI_MODEL||'gemini-3.8-flash'):provider==='openai'?'gpt-4.1-mini':'sonar';
   const url=provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent':provider==='openai'?'https://api.openai.com/v1/chat/completions':'https://api.perplexity.ai/chat/completions';
   const prompt='Answer this question naturally and do not assume the business is mentioned. Query: '+query;
   const body=provider==='gemini'?{contents:[{parts:[{text:prompt}]}],tools:[{google_search:{}}]}:{model,messages:[{role:'user',content:prompt}]};
   const headers={'content-type':'application/json',...(provider==='gemini'?{'x-goog-api-key':keys[provider]}:{authorization:'Bearer '+keys[provider]})};
   const reply=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   if(!reply.ok)throw Error('provider-http-'+reply.status);
   const data=await reply.json();
   const answer=String(provider==='gemini'?data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(' '):data?.choices?.[0]?.message?.content||'').slice(0,2000);
   const chunks=provider==='gemini'?data?.candidates?.[0]?.groundingMetadata?.groundingChunks||[]:[];
   const supports=provider==='gemini'?data?.candidates?.[0]?.groundingMetadata?.groundingSupports||[]:[];
   const citation=supports.flatMap(s=>(s.groundingChunkIndices||[]).map(i=>({url:chunks[i]?.web?.uri,text:s.segment?.text}))).find(c=>{try{return c.text&&new URL(c.url).protocol==='https:'}catch{return false}});
   const mention=answer.toLocaleLowerCase().includes(String(client.name).toLocaleLowerCase())?'possible-mention':'not-observed';
   results.push({provider,status:citation?'source-supported-answer':answer?'answer-received-unverified':'empty-answer',verified:Boolean(citation),brandMention:mention,answer,evidence:citation?{sourceUrl:citation.url,observation:String(citation.text).slice(0,1200)}:null});
  }catch(e){results.push({provider,status:'failed',verified:false,reason:String(e?.message||e).slice(0,120)})}
 }
 return {clientId:client.id,query,results,verifiedCount:results.filter(r=>r.verified).length,visibilityScore:null,
  disclaimer:'Citations support passages, not proof of ranking or of the client being recommended.'};
}
