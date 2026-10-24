import {buildAuditQueue,recordAuditResult} from './zera-audit-queue.mjs';
import {buildPilotReport} from './zera-report.mjs';
/**
 * Explicit adapter boundary for authorized public searches.
 * No implicit outbound calls, costs, credentials, private account access or scheduled execution.
 * A caller must supply an already-approved provider executor.
 */
export async function runPublicPilotAudit({pilot,executor,approved=false,maxTasks=7}={}){
 if(approved!==true)throw new Error('Explicit audit execution approval required');
 if(typeof executor!=='function')throw new Error('Configured public search executor required');
 if(!Number.isInteger(maxTasks)||maxTasks<1||maxTasks>7)throw new Error('Invalid maxTasks');
 const tasks=buildAuditQueue(pilot).slice(0,maxTasks);
 const results=[];
 for(const task of tasks){
  try{
   const reply=await executor(Object.freeze({...task}));
   if(!reply || reply.taskId!==task.id)throw new Error('Provider response mismatch');
   const finding=recordAuditResult(task,reply);
   results.push(finding);
  }catch(error){
   // Provider failures are unknown, not a 0 visibility score or a completed task.
   results.push({...task,status:'awaiting_provider_execution',evidence:null,
     errorCode:'PROVIDER_NOT_VERIFIED'});
  }
 }
 const report=buildPilotReport(results);
 return {tasks:results,report,executedTasks:tasks.length,verifiedResults:report.progress.completed,
  warning:'Execution is provided by an externally configured adapter; no scheduling or storage was performed.'};
}
