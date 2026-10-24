import {PILOT_ID} from './zera-pilot.mjs';
import {AUDIT_TASKS,auditProgress} from './zera-audit-queue.mjs';
/** Pure report builder. The caller supplies audited task records; no demo output is represented as live. */
export function buildPilotReport(records,{asOf=new Date().toISOString()}={}){
 if(!Array.isArray(records))throw new Error('Audit records must be an array');
 const known=new Map(AUDIT_TASKS.map(t=>[t.id,t]));
 const unique=new Set();
 const tasks=records.map(record=>{
   if(!known.has(record.id)||record.pilotId!==PILOT_ID||unique.has(record.id))throw new Error('Unknown/duplicate/wrong-pilot audit record');
   unique.add(record.id);
   if(!['awaiting_provider_execution','evidence_recorded'].includes(record.status))throw new Error('Invalid audit state');
   if(record.status==='evidence_recorded'){
     const e=record.evidence;
     if(e?.type!=='observed'||!e.sourceUrl||!e.observedAt||!e.observation)throw new Error('Missing observed evidence');
   }else if(record.evidence)throw new Error('Pending jobs cannot claim evidence');
   return {id:record.id,channel:known.get(record.id).channel,query:known.get(record.id).query,
     status:record.status,evidence:record.status==='evidence_recorded'?record.evidence:null};
 });
 const progress=auditProgress(tasks);
 return {pilotId:PILOT_ID,asOf,progress,observations:tasks.filter(x=>x.evidence),
   pendingTasks:AUDIT_TASKS.filter(t=>!unique.has(t.id)||tasks.find(x=>x.id===t.id)?.status!=='evidence_recorded').map(t=>t.id),
   integrity:{evidenceOnly:true,sourceRequired:true,unknownNotZero:true},
   nextStep:progress.completed===AUDIT_TASKS.length?'review_findings':'execute_authorized_public_scans'};
}
export function formatPilotReportMarkdown(report){
 const esc=s=>String(s??'').replace(/[\r\n|]/g,' ').slice(0,800);
 const lines=[`# ZERA Pilot — ${esc(report.asOf)}`,`Pilot: ${esc(report.pilotId)}`,
 `Verified audits: ${report.progress.completed}/${AUDIT_TASKS.length} (remaining ${report.pendingTasks.length})`,
 '', '## Observed evidence'];
 if(!report.observations.length)lines.push('No verified scan results yet.');
 for(const row of report.observations)lines.push(`- **${esc(row.id)}**: ${esc(row.evidence.observation)} — ${esc(row.evidence.sourceUrl)} (${esc(row.evidence.observedAt)})`);
 lines.push('','## Pending tasks',...report.pendingTasks.map(id=>`- ${esc(id)}`),'','Attribution is not proof of incremental revenue.');
 return lines.join('\n');
}
