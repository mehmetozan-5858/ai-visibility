import {discoverBusinesses,runProviderCheck,findPublicBusinessContact,personalizeProspectOutreach,buildProspectProposal} from "../../../../lib/providers";
import {getProspectNames,seedProspects,qualifyProspect,queueProspectScan,completeProspectScan,saveProspectContact,saveProspectPersonalization,saveProspectProposal,prepareProspectCommunication} from "../../../../lib/prospects";
import {addSharedAgentEvent,saveDailyAgentReport,learnFromMarketRun,listMarketLearning,refreshMarketEconomics,listLearnedPolicies,listResourceAllocations} from "../../../../lib/agent-coordination";

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
  const width=Math.max(2,Math.min(Number(process.env.PARALLEL_HUNT_MARKETS)||4,8));
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
  if(!authorized(req)){logCycle("unauthorized");return Response.json({ok:false,error:"unauthorized"},{status:401,headers:{"cache-control":"no-store"}})}
  const startedAt=new Date().toISOString(),markets=await marketsForCurrentHour();
  const report={ok:true,startedAt,market:{mode:"parallel",markets},discovered:0,newProspects:0,scanned:0,completed:0,errors:[]};
  logCycle("parallel-started",{markets});
  await share({agent:"Global Baş Amir Ajan",eventType:"cycle-start",title:`Paralel global av başladı: ${markets.length} pazar`,detail:markets.map(x=>`${x.country}/${x.city}`).join(" · "),payload:{markets}});
  try{
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
    const qualified=[];for(const prospect of fresh){try{const q=await qualifyProspect(prospect.id);qualified.push({...prospect,qualificationScore:q?.qualificationScore||0,qualificationLevel:q?.qualificationLevel||"low"})}catch(e){report.errors.push({stage:"qualification",prospectId:prospect.id,error:String(e?.message||e).slice(0,160)})}}
    qualified.sort((a,b)=>(b.qualificationScore||0)-(a.qualificationScore||0));
    await share({agent:"Lead Finder",eventType:"handoff",title:`${report.newProspects} yeni aday paralel avdan geldi`,detail:`${report.discovered} benzersiz işletme bulundu; pahalı analiz yalnız öncelikli ilk adaylara uygulanıyor.`,payload:{markets,discovered:report.discovered,newProspects:report.newProspects}});
    const deepLimit=Math.max(4,Math.min(Number(process.env.DEEP_SCAN_LIMIT)||8,16));
    for(const prospect of qualified.filter(x=>x.qualificationLevel!=="low").slice(0,deepLimit)){
      try{
        report.scanned++;const scan=await queueProspectScan(prospect.id);if(scan.status==="demo-only")throw new Error("database-unavailable");
        const result=await runProviderCheck(prospect);if(!result)throw new Error("no-provider-result");
        await completeProspectScan(scan.id,prospect.id,result);report.completed++;
        try{const contact=await findPublicBusinessContact(prospect);await saveProspectContact(prospect.id,contact);await share({agent:"Contact Finder",eventType:"handoff",title:`İletişim kontrolü: ${prospect.name}`,detail:contact.status==="verified"?"Doğrulanmış kamusal kurumsal iletişim kanalı bulundu.":"Doğrulanabilir kamusal kurumsal iletişim kanalı bulunamadı.",payload:{prospectId:prospect.id,status:contact.status,sourceUrl:contact.sourceUrl||""},status:contact.status==="verified"?"completed":"needs-attention"});
          if(contact.status==="verified"){const personalized=await personalizeProspectOutreach(prospect,result,contact);await saveProspectPersonalization(prospect.id,personalized);await share({agent:"Personalization Agent",eventType:"handoff",title:`Kişisel iletişim taslağı hazır: ${prospect.name}`,detail:personalized.reason,payload:{prospectId:prospect.id,status:"drafted"},status:"completed"});const proposal=await buildProspectProposal(prospect,result,personalized);await saveProspectProposal(prospect.id,proposal);await prepareProspectCommunication(prospect.id);await share({agent:"Communication Center",eventType:"handoff",title:`İletişim paketi incelemeye hazır: ${prospect.name}`,detail:"Doğrulanmış kanal, kişisel mesaj ve sabit fiyatlı teklif kontrollü kuyruğa alındı.",payload:{prospectId:prospect.id,status:"ready-for-review"},status:"completed"});await share({agent:"Proposal Agent",eventType:"handoff",title:`Teklif taslağı hazır: ${prospect.name}`,detail:`${proposal.package} · ${proposal.amount} ${proposal.currency}`,payload:{prospectId:prospect.id,...proposal},status:"completed"})}
        }catch(contactError){report.errors.push({stage:"contact-personalization",prospectId:prospect.id,error:String(contactError?.message||contactError).slice(0,160)})}
        await share({agent:"Görünürlük Ajanı",eventType:"handoff",title:`Tarama tamamlandı: ${prospect.name}`,detail:"Sonuç uzman ve satış ajanlarının ortak kullanımına açıldı.",payload:{prospectId:prospect.id,name:prospect.name,provider:result?.provider||""},status:"completed"});
      }catch(e){report.errors.push({prospectId:prospect.id,name:prospect.name,error:String(e?.message||e).slice(0,180)})}
    }
  }catch(e){report.ok=false;report.errors.push({stage:"parallel-cycle",error:String(e?.message||e).slice(0,220)})}
  const finishedAt=new Date().toISOString(),finalReport={...report,finishedAt};
  logCycle("parallel-finished",{markets:markets.length,discovered:report.discovered,newProspects:report.newProspects,scanned:report.scanned,completed:report.completed,errorCount:report.errors.length});
  try{await saveDailyAgentReport(finalReport);await learnFromMarketRun(finalReport)}catch(e){console.error(JSON.stringify({source:"daily-agent-cycle",event:"report-save-error",error:String(e?.message||e).slice(0,180)}))}
  await share({agent:"CEO Ajanı",eventType:"daily-summary",title:`Paralel av: ${report.discovered} aday / ${report.completed} derin tarama`,detail:`${markets.length} pazar aynı turda tarandı. Yeni aday ${report.newProspects}, hata ${report.errors.length}.`,payload:finalReport,status:report.errors.length?"needs-attention":"completed"});
  return Response.json(finalReport,{status:report.ok?200:500,headers:{"cache-control":"no-store"}});
}
