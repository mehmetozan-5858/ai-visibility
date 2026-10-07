import {dailyAnswerEvidence} from "../../../../lib/answer-evidence-daily";
import {reportDay} from "../../../../lib/reporting";
import {answerEvidenceStatus} from "../../../../lib/answer-evidence-status";
import {runAutomaticAnswerEvidence} from "../../../../lib/answer-evidence-automation";
import {evaluateOutreachPool,needsProspectPreparation,selectPreparationCandidates} from "../../../../lib/outreach-selection";
import {nicheSearchSector} from "../../../../lib/niche-targeting";
import {databasePool} from "../../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../../lib/db";
import {withRequestBudget} from "../../../../lib/request-budget";
import {discoverBusinesses,runProviderCheck,findPublicBusinessContact,personalizeProspectOutreach,buildProspectProposal} from "../../../../lib/providers";
import {getProspectNames,seedProspects,qualifyProspect,queueProspectScan,completeProspectScan,saveProspectContact,saveProspectPersonalization,saveProspectProposal,prepareProspectCommunication,listOutreachEvaluationCandidates,getLatestProspectAnalysis} from "../../../../lib/prospects";
import {addSharedAgentEvent,saveDailyAgentReport,learnFromMarketRun,listMarketLearning,refreshMarketEconomics,listLearnedPolicies,listResourceAllocations,getRuntimeControl,refreshBudgetGuard} from "../../../../lib/agent-coordination";

export const runtime="nodejs";
export const maxDuration=300;

const MARKETS=[
  {country:"Türkiye",city:"İstanbul"},{country:"Türkiye",city:"İstanbul"},
  {country:"Türkiye",city:"Ankara"},{country:"Türkiye",city:"İzmir"},{country:"Türkiye",city:"Antalya"},{country:"Türkiye",city:"Bursa"},
  {country:"United Kingdom",city:"London"},{country:"Germany",city:"Berlin"},{country:"Germany",city:"Munich"},
  {country:"France",city:"Paris"},{country:"Netherlands",city:"Amsterdam"},{country:"Italy",city:"Milan"},{country:"Spain",city:"Madrid"},
  {country:"United States",city:"New York"},{country:"United States",city:"Miami"},{country:"United States",city:"Los Angeles"},{country:"United States",city:"Chicago"},
  {country:"Canada",city:"Toronto"},{country:"United Arab Emirates",city:"Dubai"},{country:"Saudi Arabia",city:"Riyadh"},
  {country:"Singapore",city:"Singapore"},{country:"Australia",city:"Sydney"},{country:"Japan",city:"Tokyo"}
];

function authorized(req){
  const auth=req.headers.get("authorization")||"";
  const secrets=[process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean);
  return secrets.some(secret=>auth===`Bearer ${secret}`);
}

async function marketsForCurrentHour(){
  const slot=Math.floor(Date.now()/3600000);
  const width=Math.max(2,Math.min(Number(process.env.PARALLEL_HUNT_MARKETS)||3,6));
  const base=Array.from({length:width},(_,i)=>MARKETS[(slot*width+i)%MARKETS.length]);
  try{await refreshMarketEconomics();const learned=await listMarketLearning(12),policies=await listLearnedPolicies(30);if(learned.length>=4&&slot%3!==0){const validated=new Set(policies.filter(x=>x.safeToApply&&x.policyType==="market-priority").map(x=>String(x.scope).toLowerCase()));const ranked=[...learned].sort((a,b)=>(validated.has(`${String(b.country).toLowerCase()}/${String(b.city).toLowerCase()}`)?1:0)-(validated.has(`${String(a.country).toLowerCase()}/${String(a.city).toLowerCase()}`)?1:0)||Number(b.efficiencyScore||0)-Number(a.efficiencyScore||0));const top=ranked.slice(0,Math.max(1,width-1)).map(x=>({country:x.country,city:x.city}));const explore=base.find(b=>!top.some(t=>t.country===b.country&&t.city===b.city))||base[0];return [...top,explore].slice(0,width)}}catch{}
  return base;
}

function logCycle(event,payload={}){
  console.log(JSON.stringify({source:"daily-agent-cycle",event,at:new Date().toISOString(),...payload}));
}

async function share(event){
  try{await addSharedAgentEvent(event)}catch(e){console.error(JSON.stringify({source:"agent-coordinator",event:"share-error",error:String(e?.message||e).slice(0,160)}))}
}

export async function GET(req){
 if(!authorized(req))return runCycle(req);
 return withRequestBudget(90000,async()=>{
  const url=getDatabaseUrl();if(!url)return Response.json({ok:false,error:"database-not-configured"},{status:503});
  const client=await databasePool(url).connect();let locked=false;
  try{locked=Boolean((await client.query("SELECT pg_try_advisory_lock(741852964) AS acquired")).rows[0]?.acquired);
   if(!locked)return Response.json({ok:true,skipped:"already-running"},{headers:{"cache-control":"no-store"}});
   return await runCycle(req);
  }finally{if(locked)await client.query("SELECT pg_advisory_unlock(741852964)").catch(()=>{});client.release()}
 });
}
async function runCycle(req){
  if(!authorized(req)){logCycle("unauthorized");return Response.json({ok:false,error:"unauthorized"},{status:401,headers:{"cache-control":"no-store"}})}
  const startedMs=Date.now(),startedAt=new Date().toISOString();
  const guard=await refreshBudgetGuard();
  if(guard.mode==="emergency")return Response.json({ok:true,skipped:"ai-budget-exhausted",budget:guard},{headers:{"cache-control":"no-store"}});
  const slot=Math.floor(Date.now()/3600000);
  const markets=(await marketsForCurrentHour()).slice(0,guard.multiplier<1?1:6).map((m,i)=>({...m,focusArea:nicheSearchSector(slot,i),nicheFocus:slot%5!==4}));
  const budgetMs=Math.max(45000,Math.min(Number(process.env.DAILY_CYCLE_BUDGET_MS)||75000,80000));
  const hasBudget=(reserve=30000)=>Date.now()-startedMs<budgetMs-reserve;
  const report={ok:true,startedAt,market:{mode:"parallel",targeting:"specialist-b2b-80-percent",markets},budget:guard,discovered:0,newProspects:0,scanned:0,completed:0,contactPrepared:0,truncated:false,stopReason:"",errors:[]};
  logCycle("parallel-started",{markets});
  await share({agent:"Global Baş Amir Ajan",eventType:"cycle-start",title:`Paralel global av başladı: ${markets.length} pazar`,detail:markets.map(x=>`${x.country}/${x.city}`).join(" · "),payload:{markets}});
  try{
    const initialAssessment=evaluateOutreachPool(await listOutreachEvaluationCandidates());
    const preparationFirst=initialAssessment.awaitingAnalysis>=50;
    report.mode=preparationFirst?"backlog-preparation":"discovery-and-preparation";
    if(!preparationFirst){
    const existingNames=await getProspectNames();
    const batches=await Promise.allSettled(markets.map(m=>discoverBusinesses({...m,existingNames})));
    const found=[];
    batches.forEach((x,i)=>{if(x.status==="fulfilled")found.push(...x.value);else report.errors.push({stage:"discovery",market:markets[i],error:String(x.reason?.message||x.reason).slice(0,180)})});
    const unique=[...new Map(found.map(x=>[`${String(x.name).toLocaleLowerCase("tr-TR")}|${String(x.domain||"").toLowerCase()}`,x])).values()];
    report.discovered=unique.length;
    const seeded=await seedProspects(unique);
    const existingSet=new Set(existingNames.map(x=>String(x).toLocaleLowerCase("tr-TR")));
    const fresh=seeded.filter(x=>!existingSet.has(String(x.name||"").toLocaleLowerCase("tr-TR")));
    report.newProspects=fresh.length;
    // Complete discovery first, then compare the full accumulated business pool.
    for(const prospect of seeded){try{await qualifyProspect(prospect.id)}catch(e){report.errors.push({stage:"qualification",prospectId:prospect.id,error:String(e?.message||e).slice(0,160)})}}
    }
    const assessment=preparationFirst?initialAssessment:evaluateOutreachPool(await listOutreachEvaluationCandidates());
    report.poolReview={evaluated:assessment.evaluated,qualifiedForContact:assessment.qualified,awaitingAnalysis:assessment.awaitingAnalysis};
    const qualified=assessment.ranked.filter(needsProspectPreparation);
    await share({agent:"Qualification + Opportunity Agents",eventType:"pool-review",title:`Genel aday değerlendirmesi: ${assessment.evaluated} işletme`,detail:`Uzmanlık, doğrudan sayfa kontrolleri ve kurumsal iletişim karşılaştırıldı. Tahmini skor ölçüm sayılmadı. İletişime hazır ${assessment.qualified}; analiz bekleyen ${assessment.awaitingAnalysis}.`,payload:report.poolReview,status:"completed"});
    await share({agent:"Lead Finder",eventType:"handoff",title:`${report.newProspects} yeni aday paralel avdan geldi`,detail:`${report.discovered} benzersiz işletme bulundu; pahalı analiz yalnız öncelikli ilk adaylara uygulanıyor.`,payload:{markets,discovered:report.discovered,newProspects:report.newProspects}});
    const deepLimit=Math.max(1,Math.min(Number(process.env.DEEP_SCAN_LIMIT)||2,2));
    const hotCount=qualified.filter(x=>x.qualificationLevel==="hot").length;
    report.hotProspects=hotCount;
    report.capacity={analysisLimit:guard.multiplier<1?1:deepLimit,analysisConcurrency:guard.multiplier<1?1:deepLimit,contactLimit:1};
    report.preparedCandidates=[];
    report.evidenceReview=[];
    const answerCandidates=[];
    const analyses=selectPreparationCandidates(assessment.ranked.filter(x=>x.analysisRequired),{limit:report.capacity.analysisLimit,slot});
    if(analyses.length&&!hasBudget(35000)){report.truncated=true;report.stopReason="runtime-budget"}
    else await Promise.allSettled(analyses.map(async prospect=>{
      report.preparedCandidates.push({id:prospect.id,name:prospect.name,stage:"analysis"});
      try{
        const scan=await queueProspectScan(prospect.id);if(scan.status==="demo-only")throw new Error("database-unavailable");
        report.scanned++;
        const result=await withRequestBudget(Math.min(35000,Math.max(1000,budgetMs-(Date.now()-startedMs)-15000)),()=>runProviderCheck(prospect));if(!result)throw new Error("no-provider-result");
        const saved=await completeProspectScan(scan.id,prospect.id,result);if(!saved)throw new Error("scan-not-persisted");
        report.completed++;answerCandidates.push(prospect);
        report.evidenceReview.push({prospectId:prospect.id,status:result.evidence?.status||"unavailable",sourceUrl:result.evidence?.sourceUrl||"",checkedAt:result.evidence?.checkedAt||null,scope:result.evidence?.scope||"",checks:result.evidence?.checks||[]});
        await share({agent:"Görünürlük Ajanı",eventType:"handoff",title:`Tarama tamamlandı: ${prospect.name}`,detail:"Sağlayıcı ön değerlendirmesi kaydedildi; doğrulama bekleyen notlar ile doğrudan sayfa kontrolleri ayrı tutulur.",payload:{prospectId:prospect.id,name:prospect.name,provider:result.provider||""},status:"completed"});
      }catch(e){report.errors.push({stage:"analysis",prospectId:prospect.id,name:prospect.name,error:String(e?.message||e).slice(0,180)})}
    }));
    if(hasBudget(30000)){
      try{const run=await runAutomaticAnswerEvidence(answerCandidates);report.answerEvidence={id:run.id||null,kind:run.kind||null,entityId:run.entityId||null,entityType:run.entityType||null,implementationWorkId:run.result?.implementationContext?.workId||null,implementationPlans:run.implementationPlans??null,skipped:run.skipped||'',summary:run.result?.summary||null,comparisonPairs:run.result?.comparison?.pairs?.length||0,slotAuditSaved:run.slotAuditSaved??null};
        if(run.result)await share({agent:"Görünürlük Ajanı",eventType:"answer-evidence",title:`${run.kind==='repeat'?'AI yanıtı yeniden ölçüldü':'AI yanıt kanıtı kaydedildi'}: ${run.entityName}`,detail:`${run.result.summary.successful} yanıt, ${run.result.summary.failed} hata; ${run.result.comparison?.pairs?.length||0} eş koşullu karşılaştırma. Genel görünürlük puanı değildir.`,payload:{runId:run.id,kind:run.kind,summary:run.result.summary,comparisonPairs:run.result.comparison?.pairs?.length||0},status:run.result.errors.length||run.slotAuditSaved===false?"needs-attention":"completed"});
      }catch{report.answerEvidence={skipped:'evidence-run-unavailable'}}
    }else report.answerEvidence={skipped:'runtime-budget'};
    // Re-read saved results and current eligibility after concurrent scans.
    const contactAssessment=evaluateOutreachPool(await listOutreachEvaluationCandidates());
    const contactCandidates=selectPreparationCandidates(contactAssessment.ranked.filter(x=>!x.analysisRequired),{limit:1,slot});
    for(const prospect of contactCandidates){
      if(!hasBudget(25000)){report.truncated=true;report.stopReason="contact-deferred";break}
      report.preparedCandidates.push({id:prospect.id,name:prospect.name,stage:"contact-package"});
      try{
        const result=await getLatestProspectAnalysis(prospect.id);if(!result)throw new Error("saved-analysis-required");
        const foundContact=prospect.contactStatus==="verified"?{email:prospect.contactEmail,sourceUrl:prospect.contactSourceUrl,status:"verified"}:await findPublicBusinessContact(prospect);
        const savedContact=await saveProspectContact(prospect.id,foundContact);
        const contact={email:savedContact?.contactEmail||"",sourceUrl:savedContact?.contactSourceUrl||"",contactUrl:savedContact?.contactUrl||"",status:savedContact?.contactStatus||"not-found"};
        await share({agent:"Contact Finder",eventType:"handoff",title:`İletişim kontrolü: ${prospect.name}`,detail:contact.status==="verified"?"Doğrulanmış kamusal kurumsal iletişim kanalı bulundu.":"Doğrulanabilir kamusal kurumsal iletişim kanalı bulunamadı.",payload:{prospectId:prospect.id,status:contact.status,sourceUrl:contact.sourceUrl||""},status:contact.status==="verified"?"completed":"needs-attention"});
        if(contact.status==="verified"){
          if(!hasBudget(12000)){report.truncated=true;report.stopReason="personalization-deferred";break}
          const personalized=await personalizeProspectOutreach(prospect,result,contact);await saveProspectPersonalization(prospect.id,personalized);
          await share({agent:"Personalization Agent",eventType:"handoff",title:`Kişisel iletişim taslağı hazır: ${prospect.name}`,detail:personalized.reason,payload:{prospectId:prospect.id,status:"drafted"},status:"completed"});
          const proposal=await buildProspectProposal(prospect,result,personalized);await saveProspectProposal(prospect.id,proposal);
          const prepared=await prepareProspectCommunication(prospect.id);if(!prepared)throw new Error("communication-not-prepared");
          report.contactPrepared=(report.contactPrepared||0)+1;
          await share({agent:"Communication Center",eventType:"handoff",title:`İletişim paketi incelemeye hazır: ${prospect.name}`,detail:"Doğrulanmış kanal, kişisel mesaj ve sabit fiyatlı teklif kontrollü kuyruğa alındı.",payload:{prospectId:prospect.id,status:"ready-for-review"},status:"completed"});
          await share({agent:"Proposal Agent",eventType:"handoff",title:`Teklif taslağı hazır: ${prospect.name}`,detail:`${proposal.package} · ${proposal.amount} ${proposal.currency}`,payload:{prospectId:prospect.id,...proposal},status:"completed"});
        }
      }catch(e){report.errors.push({stage:"contact-personalization",prospectId:prospect.id,error:String(e?.message||e).slice(0,180)})}
    }
    report.poolAfter={evaluated:contactAssessment.evaluated,awaitingAnalysis:contactAssessment.awaitingAnalysis};
  }catch(e){report.ok=false;report.errors.push({stage:"parallel-cycle",error:String(e?.message||e).slice(0,220)})}
  if(hasBudget(5000)){try{const status=await answerEvidenceStatus();report.answerMonitoring={counts:status.counts,reviewed:status.reviewed,hourlyUsed:status.hourlyUsed,serverNow:status.serverNow,limited:status.limited};try{const daily=await dailyAnswerEvidence(reportDay(status.serverNow));report.answerMonitoring.daily={date:daily.date,counts:daily.counts,totalRuns:daily.totalRuns,limited:daily.limited}}catch{report.answerMonitoring.daily={available:false}}try{const customer=await answerEvidenceStatus({entityType:'client'});report.answerMonitoring.customer={counts:customer.readiness.counts,reasons:customer.readiness.reasons,reviewed:customer.readiness.reviewed,limited:customer.readiness.limited}}catch{report.answerMonitoring.customer={error:'customer-status-unavailable'}}}catch{report.answerMonitoring={error:'status-unavailable'}}}
  const finishedAt=new Date().toISOString(),finalReport={...report,finishedAt,durationMs:Date.now()-startedMs};
  logCycle("parallel-finished",{markets:markets.length,discovered:report.discovered,newProspects:report.newProspects,scanned:report.scanned,completed:report.completed,errorCount:report.errors.length});
  try{const saved=await saveDailyAgentReport(finalReport);if(!saved)throw new Error("report-not-persisted");await learnFromMarketRun(finalReport)}catch(e){finalReport.ok=false;finalReport.errors.push({stage:"report-save",error:String(e?.message||e).slice(0,180)});console.error(JSON.stringify({source:"daily-agent-cycle",event:"report-save-error",error:String(e?.message||e).slice(0,180)}))}
  const monitoringNote=report.answerMonitoring?.counts?` Anlık yanıt ölçümü: ${report.answerMonitoring.counts.ready} uygun, ${report.answerMonitoring.counts.cooldown} aralık bekleyen, ${report.answerMonitoring.counts.blocked} koşulu eksik / kapsam dışı.`:"";
  await share({agent:"CEO Ajanı",eventType:"daily-summary",title:`Paralel av: ${report.discovered} aday / ${report.completed} derin tarama`,detail:report.mode==="backlog-preparation"?`Yeni keşif yerine mevcut adaylar işlendi. Kaydedilen analiz ${report.completed}, hazırlanan iletişim paketi ${report.contactPrepared||0}, hata ${report.errors.length}.${monitoringNote}`:`${markets.length} pazar aynı turda tarandı. Yeni aday ${report.newProspects}, hata ${report.errors.length}.${monitoringNote}`,payload:finalReport,status:report.errors.length?"needs-attention":"completed"});
  return Response.json(finalReport,{status:finalReport.ok?200:500,headers:{"cache-control":"no-store"}});
}
