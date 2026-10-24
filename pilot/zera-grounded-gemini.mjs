import {assertPublicScope,createPilot} from './zera-pilot.mjs';
import {AUDIT_TASKS} from './zera-audit-queue.mjs';

/** One externally grounded Gemini query. This is a source-backed AI answer,
 * not a measurement of native Google SERP rank or other AI providers.
 * No API calls occur unless the caller explicitly invokes this function.
 */
export async function runGroundedZeraCheck({taskId,key,fetchImpl=fetch,model='gemini-3.5-flash-lite',pilot=createPilot()}={}){
 const task=AUDIT_TASKS.find(x=>x.id===taskId);
 if(!task)throw Error('Unknown audit task');
 assertPublicScope(pilot,task.scope);
 if(!key)throw Error('Gemini key not configured');
 if(!/^gemini-[a-z0-9.-]+$/.test(model))throw Error('Invalid model');
 const prompt=`Answer the following user search naturally, in the language of the query. Use Google Search grounding. Do not assume ZERA Clothing is present or recommended. Report only observable findings and explicitly say when the evidence is insufficient. Query: ${task.query}`;
 const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
  method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},
  body:JSON.stringify({contents:[{parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{temperature:0}})
 });
 if(!response.ok)throw Error(`Grounded provider request failed: ${response.status}`);
 const data=await response.json();
 const candidate=data?.candidates?.[0],grounding=candidate?.groundingMetadata;
 const chunks=grounding?.groundingChunks||[];
 const supports=grounding?.groundingSupports||[];
 const supported=supports.find(s=>String(s?.segment?.text||'').trim()&&Array.isArray(s.groundingChunkIndices)&&s.groundingChunkIndices.some(i=>chunks[i]?.web?.uri));
 if(!supported)return {taskId,status:'unverified',reason:'No grounded supporting citation returned'};
 const match=supported.groundingChunkIndices.map(i=>chunks[i]?.web?.uri).find(uri=>{try{return new URL(uri).protocol==='https:'}catch{return false}});
 if(!match)return {taskId,status:'unverified',reason:'No valid HTTPS citation returned'};
 return {taskId,status:'evidence_recorded',result:{taskId,evidence:{
  type:'observed',sourceUrl:match,observedAt:new Date().toISOString(),query:task.query,
  observation:String(supported.segment.text).slice(0,1200)}},
  provider:'Gemini + Google Search grounding',locale:task.locale,
  caveat:'A cited Gemini answer, not independent evidence of Google rank or ChatGPT visibility'};
}
