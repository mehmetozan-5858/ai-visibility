import {reviewedGuidance} from './source-review.js';
import {validEnquiryEvidence} from './verified-enquiry';
import {preparationPool,enqueuePreparation,enqueueNext,claimPreparation,finishPreparation,PREPARATION_STAGES} from './preparation-queue';
import {preflightProspect} from './prospect-preflight';
import {verifyContactPage} from './contact-page-verification';
import {evaluateOutreachPool} from './outreach-selection';
import {saveEnquiryEvidence,getCommunicationProspect,listOutreachEvaluationCandidates,getLatestProspectAnalysis,saveProspectContact,saveProspectPersonalization,saveProspectProposal,prepareProspectCommunication} from './prospects';
import {personalizeProspectOutreach,buildProspectProposal} from './providers';
import {saveDailyAgentReport,addSharedAgentEvent} from './agent-coordination';
import {withRequestBudget} from './request-budget';

export function validSavedAnalysis(x){return !!x&&x.score!==null&&Number.isFinite(Number(x.score))&&Number(x.score)>=0&&Number(x.score)<=100&&!!x.provider&&!/test|demo|synthetic/i.test(x.provider)&&Array.isArray(x.findings)&&x.findings.some(v=>typeof v==='string'&&v.trim().length>=12)&&Array.isArray(x.recommendations)&&x.recommendations.some(v=>typeof v==='string'&&v.trim().length>=12)}
export function preparationEligible(x){return !!x&&Number(x.qualificationScore)>=45&&!x.replyStatus&&!x.clientId&&!['lost','won'].includes(x.crmStage)&&!['sent','follow-up-due'].includes(x.communicationStatus)&&!/(berlin.?klinik|audi\s*dental|do\s*&\s*co.*restaurant)/i.test(x.name||'')}
const dependencies={preparationPool,enqueuePreparation,enqueueNext,claimPreparation,finishPreparation,preflightProspect,verifyContactPage,saveEnquiryEvidence,getCommunicationProspect,listOutreachEvaluationCandidates,getLatestProspectAnalysis,saveProspectContact,saveProspectPersonalization,saveProspectProposal,prepareProspectCommunication,personalizeProspectOutreach,buildProspectProposal,saveDailyAgentReport,addSharedAgentEvent,withRequestBudget};
function intEnv(name,fallback,min,max){const n=Math.floor(Number(process.env[name]));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
export function preparationCapacity(stage){
 const defaults={preflight:{limit:15,concurrency:4},analysis:{limit:12,concurrency:4},contact:{limit:8,concurrency:3}}[stage];
 const key=stage.toUpperCase();return {limit:intEnv(`PREPARATION_${key}_LIMIT`,defaults.limit,1,30),concurrency:intEnv(`PREPARATION_${key}_CONCURRENCY`,defaults.concurrency,1,6)};
}
// This worker prepares records only. Sending remains in the existing verified outreach flow.
export async function runPreparation(stage,{deps=dependencies,budgetMs=60000,now=Date.now}={}){
 if(!PREPARATION_STAGES.includes(stage))throw Error('invalid-stage');
 const start=now(),pool=await deps.preparationPool();
 const report={ok:true,startedAt:new Date(start).toISOString(),market:{mode:'preparation',stage,markets:[]},stage,discovered:0,newProspects:0,scanned:0,completed:0,contactPrepared:0,sourceReviewsUsed:0,processed:0,reused:0,waiting:0,skipped:0,errors:[]};
 if(stage==='preflight'){const assessment=evaluateOutreachPool(await deps.listOutreachEvaluationCandidates());report.reviewed=await deps.enqueuePreparation(assessment.ranked,pool)}
 const {limit,concurrency}=preparationCapacity(stage);report.capacity={limit,concurrency};
 const reserveMs={preflight:12000,analysis:12000,contact:12000}[stage];
 const wait=async(job,reason,refundAttempt=false)=>{report.waiting++;await deps.finishPreparation(pool,job,{status:!refundAttempt&&job.attempts>=3?'needs-review':'waiting',reason,delaySeconds:refundAttempt?3600:86400,refundAttempt})};
 const processJob=async job=>{
  try{
   const prospect=await deps.getCommunicationProspect(job.prospectId);
   if(!preparationEligible(prospect)){report.skipped++;await deps.finishPreparation(pool,job,{status:'done',reason:'no-longer-eligible'});return}
   let guidance=reviewedGuidance(prospect.sourceReview);
   if(guidance?.decision==='needs-review'){report.waiting++;await deps.finishPreparation(pool,job,{status:'needs-review',reason:'source-review-needs-review'});return}
   if(guidance)report.sourceReviewsUsed++;
   if(stage==='preflight'){
    const result=await deps.preflightProspect(prospect);
    if(result.contact.status!=='verified'){await wait(job,result.reason||'official-email-not-found');return}
    const saved=await deps.saveProspectContact(prospect.id,result.contact);if(saved?.contactStatus!=='verified')throw Error('contact-not-persisted');
    const analysis=await deps.getLatestProspectAnalysis(prospect.id);
    const payload={...result,checkedAt:new Date(now()).toISOString()};
    if(result.inspection?.status==='checked'){
     if(!await deps.saveEnquiryEvidence(prospect.id,{method:'official-enquiry-v1',inspection:result.inspection,checkedAt:new Date(now()).toISOString()}))throw Error('enquiry-evidence-not-persisted');
     await deps.enqueueNext(pool,job,'contact',payload);
    }else await deps.enqueueNext(pool,job,validSavedAnalysis(analysis)?'contact':'analysis',payload);
    await deps.finishPreparation(pool,job,{payload});if(validSavedAnalysis(analysis))report.reused++;
   }else if(stage==='analysis'){
    let result=await deps.getLatestProspectAnalysis(prospect.id);
    if(validSavedAnalysis(result))report.reused++;
    else{
     // Legacy analysis backlog now prepares permission enquiries without paid calls.
     const checked=await deps.preflightProspect(prospect);
     if(checked.contact.status!=='verified'||checked.inspection?.status!=='checked'){await wait(job,checked.reason||'official-evidence-or-analysis-required');return}
     if(!await deps.saveProspectContact(prospect.id,checked.contact))throw Error('contact-not-persisted');
     if(!await deps.saveEnquiryEvidence(prospect.id,{method:'official-enquiry-v1',inspection:checked.inspection,checkedAt:new Date(now()).toISOString()}))throw Error('enquiry-evidence-not-persisted');
    }
    await deps.enqueueNext(pool,job,'contact',job.payload);await deps.finishPreparation(pool,job);
   }else{
    const result=await deps.getLatestProspectAnalysis(prospect.id);if(!validSavedAnalysis(result)&&!validEnquiryEvidence(prospect.enquiryEvidence,prospect.domain,now())){await wait(job,'official-evidence-or-analysis-required');return}
    const contact={email:prospect.contactEmail,sourceUrl:prospect.contactSourceUrl,contactUrl:prospect.contactUrl,status:prospect.contactStatus};
    if(contact.status!=='verified'||!contact.email||!contact.sourceUrl){await wait(job,'official-email-not-found');return}
    if(!await deps.verifyContactPage(contact.sourceUrl,contact.email,prospect.domain)){await wait(job,'official-contact-recheck-failed');return}
    const fresh=await deps.getCommunicationProspect(prospect.id);
    guidance=reviewedGuidance(fresh?.sourceReview);
    if(guidance?.decision==='needs-review'){report.waiting++;await deps.finishPreparation(pool,job,{status:'needs-review',reason:'source-review-needs-review'});return}
    if(!preparationEligible(fresh)){report.skipped++;await deps.finishPreparation(pool,job,{reason:'no-longer-eligible'});return}
    const personalized=await deps.personalizeProspectOutreach(prospect,result,contact);
    if(!await deps.saveProspectPersonalization(prospect.id,personalized))throw Error('personalization-not-persisted');
    const proposal=await deps.buildProspectProposal(prospect,result,personalized);
    if(!await deps.saveProspectProposal(prospect.id,proposal))throw Error('proposal-not-persisted');
    if(!await deps.prepareProspectCommunication(prospect.id))throw Error('communication-not-prepared');
    await deps.finishPreparation(pool,job,{payload:{...job.payload,...(guidance?{sourceReviewGuidance:guidance}:{})}});report.contactPrepared++;
   }
  }catch(e){
   const reason=/^(preparation-lease-lost|enquiry-evidence-not-persisted|contact-not-persisted|scan-not-persisted|no-valid-provider-result|personalization-not-persisted|proposal-not-persisted|communication-not-prepared)$/.test(e.message)?e.message:'preparation-stage-failed';
   report.errors.push({stage,prospectId:job.prospectId,error:reason});
   await deps.finishPreparation(pool,job,{status:job.attempts>=3?'needs-review':'retry',reason,delaySeconds:job.attempts===1?300:1800}).catch(()=>{report.ok=false});
  }
 };
 let claimed=0,stop=false;
 const worker=async()=>{
  while(!stop){
   if(now()-start>budgetMs-reserveMs){report.deferred='runtime-budget';stop=true;return}
   const slot=claimed++;if(slot>=limit)return;
   const job=await deps.claimPreparation(pool,stage);if(!job){stop=true;return}
   report.processed++;await processJob(job);
  }
 };
 await Promise.all(Array.from({length:Math.min(concurrency,limit)},()=>worker()));
 report.finishedAt=new Date(now()).toISOString();report.durationMs=now()-start;
 try{if(!await deps.saveDailyAgentReport(report))throw Error('report-not-persisted')}catch{report.ok=false;report.errors.push({stage:'report-save',error:'report-not-persisted'})}
 await deps.addSharedAgentEvent({agent:'Hazırlık Kuyruğu',eventType:'preparation-cycle',title:`${({preflight:'Resmî site kontrolü',analysis:'Eski kuyruk site kontrolü',contact:'İletişim hazırlığı'})[stage]}: ${report.processed} iş`,detail:`${report.completed} yeni analiz, ${report.reused} kayıtlı analiz kullanımı, ${report.contactPrepared} hazır paket, ${report.waiting} bekleyen iş. Kapasite ${limit}, paralellik ${concurrency}. E-posta gönderimi yapılmadı.`,payload:report,status:report.errors.length?'needs-attention':'completed'}).catch(()=>{});
 return report;
}