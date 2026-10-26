import {ZERA_TASKS} from './zera-evidence-orchestrator.mjs';

const GOOGLE_TASKS=new Map(ZERA_TASKS.filter(t=>t.channel==='google').map(t=>[t.id,t]));
function unsafeHostname(host){
 const h=host.toLowerCase().replace(/\.$/,'');
 if(!h.includes('.')||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.test')||h.endsWith('.invalid'))return true;
 if(/^\d+(?:\.\d+){3}$/.test(h))return true;
 if(h.startsWith('[')||h.endsWith(']'))return true;
 return false;
}
export function validateZeraGoogleEvidence(input,{requireVerified=true}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,reason:'invalid-input'};
 const task=GOOGLE_TASKS.get(input.taskId);
 if(!task)return {ok:false,reason:'unknown-google-task'};
 if(input.query!==task.query)return {ok:false,reason:'query-mismatch'};
 if(typeof input.sourceUrl!=='string'||input.sourceUrl.length>2048)return {ok:false,reason:'invalid-source'};
 let url;
 try{url=new URL(input.sourceUrl)}catch{return {ok:false,reason:'invalid-source'}}
 if(url.protocol!=='https:'||url.username||url.password||url.port||unsafeHostname(url.hostname))return {ok:false,reason:'invalid-source'};
 if(typeof input.observation!=='string'||!input.observation.trim()||input.observation.length>1200)return {ok:false,reason:'invalid-observation'};
 // A name match alone is not evidence of the Wetzlar pilot customer's identity.
 // Claiming a ZERA brand match requires the customer-owned domain as the cited source.
 if(input.claimsZeraIdentity===true&&url.hostname!=='ze-ra.de'&&url.hostname!=='www.ze-ra.de')return {ok:false,reason:'brand-identity-not-established'};
 if(requireVerified&&input.verified!==true)return {ok:false,reason:'not-verified'};
 if(!requireVerified&&input.verified===true)return {ok:false,reason:'independent-verification-required'};
 return {ok:true,evidence:{taskId:task.id,channel:'google',query:task.query,status:requireVerified?'evidence-recorded':'pending-review',verified:requireVerified,sourceUrl:url.href,observation:input.observation.trim()}};
}
