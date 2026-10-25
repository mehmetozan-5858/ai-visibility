import {createPilot,assertPublicScope,classifyEvidence} from './zera-pilot.mjs';
/**
 * Pure planning and evidence ingestion. No provider API or external agent is invoked.
 * Execution adapters must be explicitly configured and separately audited.
 */
export const AUDIT_TASKS=Object.freeze([
 {id:'brand-google-de',scope:'public_brand_audit',channel:'google',locale:'de-DE',query:'ZERA Clothing Wetzlar'},
 {id:'local-google-de',scope:'public_brand_audit',channel:'google',locale:'de-DE',query:'Damenmode Wetzlar Boutique Termin'},
 {id:'modest-google-de',scope:'public_brand_audit',channel:'google',locale:'de-DE',query:'Modest Fashion Wetzlar'},
 {id:'turkish-google-de',scope:'public_brand_audit',channel:'google',locale:'tr-TR',query:'Wetzlar tesettür giyim mağazası'},
 {id:'competitor-google-de',scope:'public_competitor_audit',channel:'google',locale:'de-DE',query:'Damenmode Boutiquen Wetzlar'},
 {id:'brand-ai-de',scope:'public_ai_search_audit',channel:'ai-answer',locale:'de-DE',query:'Welche Modeboutiquen gibt es in Wetzlar?'},
 {id:'brand-ai-tr',scope:'public_ai_search_audit',channel:'ai-answer',locale:'tr-TR',query:'Wetzlar çevresinde kadın giyim butiklerini öner'}
]);
export function buildAuditQueue(pilot=createPilot()){
 return AUDIT_TASKS.map(task=>{assertPublicScope(pilot,task.scope);return {...task,pilotId:pilot.id,status:'awaiting_provider_execution',evidence:null}});
}
export function recordAuditResult(task,result) {
 if(!task ||task.status!=='awaiting_provider_execution')throw new Error('Invalid task state');
 if(!result ||result.taskId!==task.id)throw new Error('Task mismatch');
 const evidence=classifyEvidence(result.evidence||{});
 if(evidence.type!=='observed')throw new Error('Audit findings require direct source evidence');
 return {...task,status:'evidence_recorded',evidence};
}
export function auditProgress(queue) {
 const completed=queue.filter(x=>x.status==='evidence_recorded').length;
 return {total:queue.length,completed,pending:queue.length-completed,completionPercent:queue.length?Math.round(completed/queue.length*100):0};
}
