import {ZERA_TASKS} from './zera-evidence-orchestrator.mjs';
// Produces an honest operator draft from read-only state; never invents rankings or scores.
export function buildZeraPilotDraft({attempts=[],googleCandidates=[],ownedSiteCount=0}={}){
 const tasks=ZERA_TASKS.map(t=>{
  const attempt=t.channel==='ai-answer'?attempts.find(a=>a.taskId===t.id):null;
  const candidate=t.channel==='google'?googleCandidates.find(a=>a.taskId===t.id):null;
  return {id:t.id,channel:t.channel,query:t.query,status:attempt?.status==='provider-failed'||attempt?.status==='error'?'blocked':attempt?.status==='stored'?'stored-unverified':'pending',pendingReviewCandidates:t.channel==='google'?Math.max(0,Number(candidate?.candidates)||0):0};
 });
 return {customer:'ZERA Clothing',reportType:'pilot-draft-unverified',readyForCustomer:false,verifiedTasks:0,totalTasks:tasks.length,visibilityScore:null,ownedSiteObservations:Math.max(0,Number(ownedSiteCount)||0),tasks,blockers:['no-independent-google-verification','no-verified-ai-evidence','end-to-end-report-not-validated']};
}
