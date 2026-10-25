import {buildAuditQueue,recordAuditResult} from './zera-audit-queue.mjs';
import {buildPilotReport} from './zera-report.mjs';
/** Resumable audit controller. Scheduling and provider costs remain explicitly external. */
export async function resumePublicPilotAudit({pilot,executor,load,save,approved=false,maxTasks=7}={}){
 if(!approved)throw Error('Owner approval required');
 if(typeof executor!=='function'||typeof load!=='function'||typeof save!=='function')throw Error('Verified executor and durable storage required');
 if(!Number.isInteger(maxTasks)||maxTasks<1||maxTasks>7)throw Error('Invalid task limit');
 const queue=buildAuditQueue(pilot);
 const stored=await load(pilot.id);
 if(stored!=null&&!Array.isArray(stored))throw Error('Invalid stored audit records');
 const existing=new Map();
 for(const row of stored||[]){
  if(row.pilotId!==pilot.id||!queue.some(x=>x.id===row.id)||existing.has(row.id))throw Error('Invalid stored audit task');
  existing.set(row.id,row);
 }
 const finished=[];let attempted=0;
 for(const task of queue){
  const old=existing.get(task.id);
  if(old?.status==='evidence_recorded'){
   // Validate previously stored evidence before accepting it.
   const verified=recordAuditResult(task,{taskId:task.id,evidence:old.evidence});
   finished.push(verified);continue;
  }
  if(attempted>=maxTasks){finished.push(task);continue}
  attempted++;
  try{
   const response=await executor(Object.freeze({...task}));
   const verified=recordAuditResult(task,response);
   await save(pilot.id,verified); // save only verified results
   finished.push(verified);
  }catch{
   finished.push({...task,errorCode:'PROVIDER_OR_STORE_UNAVAILABLE'});
  }
 }
 return {report:buildPilotReport(finished),attempted,verified:finished.filter(x=>x.status==='evidence_recorded').length};
}
