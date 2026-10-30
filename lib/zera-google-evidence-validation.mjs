import {ZERA_TASKS} from './zera-evidence-orchestrator.mjs';

const GOOGLE_TASKS=new Map(ZERA_TASKS.filter(t=>t.channel==='google').map(t=>[t.id,t]));
export function validateZeraGoogleEvidence(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,reason:'invalid-input'};
 const task=GOOGLE_TASKS.get(input.taskId);
 if(!task)return {ok:false,reason:'unknown-google-task'};
 if(input.query!==task.query)return {ok:false,reason:'query-mismatch'};
 if(typeof input.sourceUrl!=='string'||input.sourceUrl.length>2048)return {ok:false,reason:'invalid-source'};
 let url;
 try{url=new URL(input.sourceUrl)}catch{return {ok:false,reason:'invalid-source'}}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||/^(localhost|.*\.localhost)$/.test(url.hostname))return {ok:false,reason:'invalid-source'};
 if(typeof input.observation!=='string'||!input.observation.trim()||input.observation.length>1200)return {ok:false,reason:'invalid-observation'};
 if(input.verified!==true)return {ok:false,reason:'not-verified'};
 return {ok:true,evidence:{taskId:task.id,channel:'google',query:task.query,status:'evidence-recorded',verified:true,sourceUrl:url.href,observation:input.observation.trim()}};
}
