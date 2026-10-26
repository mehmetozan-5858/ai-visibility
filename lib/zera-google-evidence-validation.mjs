import {ZERA_TASKS} from './zera-evidence-orchestrator.mjs';

const GOOGLE_TASKS=new Map(ZERA_TASKS.filter(t=>t.channel==='google').map(t=>[t.id,t]));
function validateZeraGoogleFields(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,reason:'invalid-input'};
 const task=GOOGLE_TASKS.get(input.taskId);
 if(!task)return {ok:false,reason:'unknown-google-task'};
 if(input.query!==task.query)return {ok:false,reason:'query-mismatch'};
 if(typeof input.sourceUrl!=='string'||input.sourceUrl.length>2048)return {ok:false,reason:'invalid-source'};
 let url;
 try{url=new URL(input.sourceUrl)}catch{return {ok:false,reason:'invalid-source'}}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||/^(localhost|.*\.localhost)$/.test(url.hostname))return {ok:false,reason:'invalid-source'};
 if(typeof input.observation!=='string'||!input.observation.trim()||input.observation.length>1200)return {ok:false,reason:'invalid-observation'};
 // A name match alone is not evidence of the Wetzlar pilot customer's identity.
 // Claiming a ZERA brand match requires the customer-owned domain as the cited source.
 if(input.claimsZeraIdentity===true&&url.hostname!=='ze-ra.de'&&url.hostname!=='www.ze-ra.de')return {ok:false,reason:'brand-identity-not-established'};
 return {ok:true,evidence:{taskId:task.id,channel:'google',query:task.query,sourceUrl:url.href,observation:input.observation.trim()}};
}

// Verified observations and unverified review candidates have distinct contracts.
export function validateZeraGoogleEvidence(input){
 const checked=validateZeraGoogleFields(input);
 if(!checked.ok)return checked;
 if(input.verified!==true)return {ok:false,reason:'not-verified'};
 return {ok:true,evidence:{...checked.evidence,status:'evidence-recorded',verified:true}};
}

export function validateZeraGoogleCandidate(input){
 const checked=validateZeraGoogleFields(input);
 if(!checked.ok)return checked;
 if(input.verified!==undefined&&input.verified!==false)return {ok:false,reason:'verification-not-allowed'};
 return {ok:true,evidence:{...checked.evidence,status:'pending-review',verified:false}};
}
