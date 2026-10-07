import {preparationPool,enqueuePreparation,enqueueNext,claimPreparation,finishPreparation,reservePreparationAI,PREPARATION_STAGES} from './preparation-queue';
import {preflightProspect} from './prospect-preflight';
import {verifyContactPage} from './contact-page-verification';
import {evaluateOutreachPool} from './outreach-selection';
import {getCommunicationProspect,listOutreachEvaluationCandidates,getLatestProspectAnalysis,queueProspectScan,completeProspectScan,saveProspectContact,saveProspectPersonalization,saveProspectProposal,prepareProspectCommunication} from './prospects';
import {runProviderCheck,personalizeProspectOutreach,buildProspectProposal} from './providers';
import {refreshBudgetGuard,saveDailyAgentReport,addSharedAgentEvent} from './agent-coordination';
import {withRequestBudget} from './request-budget';

export function validSavedAnalysis(x){return !!x&&x.score!==null&&Number.isFinite(Number(x.score))&&Number(x.score)>=0&&Number(x.score)<=100&&!!x.provider&&!/test|demo|synthetic/i.test(x.provider)&&Array.isArray(x.findings)&&x.findings.some(v=>typeof v==='string'&&v.trim().length>=12)&&Array.isArray(x.recommendations)&&x.recommendations.some(v=>typeof v==='string'&&v.trim().length>=12)}
export function preparationEligible(x){return !!x&&Number(x.qualificationScore)>=45&&!x.replyStatus&&!x.clientId&&!['lost','won'].includes(x.crmStage)&&!['sent','follow-up-due'].includes(x.communicationStatus)&&!/(berlin.?klinik|audi\s*dental|do\s*&\s*co.*restaurant)/i.test(x.name||'')}
const dependencies={preparationPool,enqueuePreparation,enqueueNext,claimPreparation,finishPreparation,reservePreparationAI,preflightProspect,verifyContactPage,getCommunicationProspect,listOutreachEvaluationCandidates,getLatestProspectAnalysis,queueProspectScan,completeProspectScan,saveProspectContact,saveProspectPersonalization,saveProspectProposal,prepareProspectCommunication,runProviderCheck,personalizeProspectOutreach,buildProspectProposal,refreshBudgetGuard,saveDailyAgentReport,addSharedAgentEvent,withRequestBudget};
// This worker prepares records only. Sending remains in the existing verified outreach flow.
export async function runPreparation(stage,{deps=dependencies,budgetMs=60000,now=Date.now}={}){
 if(!PREPARATION_STAGES.includes(stage))throw Error('invalid-stage');
 const start=now(),pool=await deps.preparationPool();
 const report={ok:true,startedAt:new Date(start).toISOString(),market:{mode:'preparation',stage,markets:[]},stage,discovered:0,newProspects:0,scanned:0,completed:0,contactPrepared:0,processed:0,reused:0,waiting:0,skipped:0,errors:[]};
 if(stage==='preflight'){const assessment=evaluateOutreachPool(await deps.listOutreachEvaluationCandidates());report.reviewed=await deps.enqueuePreparation(assessment.ranked,pool)}
 const limit={preflight:10,analysis:3,contact:5}[stage];
 const wait=async(job,reason,refundAttempt=false)=>{report.waiting++;await deps.finishPreparation(pool,job,{status:!refundAttempt&&job.attempts>=3?'needs-review':'waiting',reason,delaySeconds:refundAttempt?3600:86400,refundAttempt})};
 // Run paid work serially so every attempt sees freshly recorded spend before starting.
 for(let index=0;index<limit;index++){
  if(now()-start>budgetMs-({preflight:22000,analysis:40000,contact:20000}[stage])){report.deferred='runtime-budget';break}
  const job=await deps.claimPreparation(pool,stage);if(!job)break;report.processed++;
  try{
   const prospect=await deps.getCommunicationProspect(job.prospectId);
   if(!preparationEligible(prospect)){report.skipped++;await deps.finishPreparation(pool,job,{status:'done',reason:'no-longer-eligible'});continue}
   if(stage==='preflight'){
    const result=await deps.preflightProspect(prospect);
    if(result.contact.status!=='verified'){await wait(job,result.reason||'official-email-not-found');continue}
    const saved=await deps.saveProspectContact(prospect.id,result.contact);if(saved?.contactStatus!=='verified')throw Error('contact-not-persisted');
    const analysis=await deps.getLatestProspectAnalysis(prospect.id);
    const payload={...result,checkedAt:new Date(now()).toISOString()};
    await deps.enqueueNext(pool,job,validSavedAnalysis(analysis)?'contact':'analysis',payload);
    await deps.finishPreparation(pool,job,{payload});if(validSavedAnalysis(analysis))report.reused++;
   }else if(stage==='analysis'){
    let result=await deps.getLatestProspectAnalysis(prospect.id);
    if(validSavedAnalysis(result))report.reused++;
    else{
     const guard=await deps.refreshBudgetGuard();
     if(!guard||!Number.isFinite(guard.dailyBudget)||!['normal','caution','guarded'].includes(guard.mode)){await wait(job,'ai-budget-unavailable-or-exhausted',true);break}
     if(!await deps.reservePreparationAI(pool,job,{dailyLimit:Math.floor(50*(guard.multiplier||1))})){await wait(job,'daily-analysis-limit',true);break}
     const scan=await deps.queueProspectScan(prospect.id);if(!scan||scan.status==='demo-only')throw Error('scan-not-persisted');
     report.scanned++;
     result=await deps.withRequestBudget(Math.min(35000,budgetMs-(now()-start)-5000),()=>deps.runProviderCheck(prospect,{inspection:job.payload?.inspection}));
     if(!validSavedAnalysis(result))throw Error('no-valid-provider-result');
     if(!await deps.completeProspectScan(scan.id,prospect.id,result))throw Error('scan-not-persisted');report.completed++;
    }
    await deps.enqueueNext(pool,job,'contact',job.payload);await deps.finishPreparation(pool,job);
   }else{
    const result=await deps.getLatestProspectAnalysis(prospect.id);if(!validSavedAnalysis(result)){await wait(job,'saved-analysis-required');continue}
    const contact={email:prospect.contactEmail,sourceUrl:prospect.contactSourceUrl,contactUrl:prospect.contactUrl,status:prospect.contactStatus};
    if(contact.status!=='verified'||!contact.email||!contact.sourceUrl){await wait(job,'official-email-not-found');continue}
    if(!await deps.verifyContactPage(contact.sourceUrl,contact.email,prospect.domain)){await wait(job,'official-contact-recheck-failed');continue}
    // Re-read eligibility after network work: never prepare an already-contacted/customer record.
    if(!preparationEligible(await deps.getCommunicationProspect(prospect.id))){report.skipped++;await deps.finishPreparation(pool,job,{reason:'no-longer-eligible'});continue}
    const personalized=await deps.personalizeProspectOutreach(prospect,result,contact);
    if(!await deps.saveProspectPersonalization(prospect.id,personalized))throw Error('personalization-not-persisted');
    const proposal=await deps.buildProspectProposal(prospect,result,personalized);
    if(!await deps.saveProspectProposal(prospect.id,proposal))throw Error('proposal-not-persisted');
    if(!await deps.prepareProspectCommunication(prospect.id))throw Error('communication-not-prepared');
    await deps.finishPreparation(pool,job);report.contactPrepared++;
   }
  }catch(e){
   // Operational codes only: do not expose database/provider credentials in the panel.
   const reason=/^(preparation-lease-lost|contact-not-persisted|scan-not-persisted|no-valid-provider-result|personalization-not-persisted|proposal-not-persisted|communication-not-prepared)$/.test(e.message)?e.message:'preparation-stage-failed';
   report.errors.push({stage,prospectId:job.prospectId,error:reason});
   await deps.finishPreparation(pool,job,{status:job.attempts>=3?'needs-review':'retry',reason,delaySeconds:job.attempts===1?300:1800}).catch(()=>{report.ok=false});
  }
 }
 report.finishedAt=new Date(now()).toISOString();report.durationMs=now()-start;
 try{if(!await deps.saveDailyAgentReport(report))throw Error('report-not-persisted')}catch{report.ok=false;report.errors.push({stage:'report-save',error:'report-not-persisted'})}
 await deps.addSharedAgentEvent({agent:'Hazırlık Kuyruğu',eventType:'preparation-cycle',title:`${({preflight:'Resmî site kontrolü',analysis:'Analiz',contact:'İletişim hazırlığı'})[stage]}: ${report.processed} iş`,detail:`${report.completed} yeni analiz, ${report.reused} kayıtlı analiz kullanımı, ${report.contactPrepared} hazır paket, ${report.waiting} bekleyen iş. E-posta gönderimi yapılmadı.`,payload:report,status:report.errors.length?'needs-attention':'completed'}).catch(()=>{});
 return report;
}
