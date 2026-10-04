import {discoverBusinesses,runProviderCheck} from "../../../../lib/providers";
import {getProspectNames,seedProspects,queueProspectScan,completeProspectScan} from "../../../../lib/prospects";
import {addSharedAgentEvent,saveDailyAgentReport} from "../../../../lib/agent-coordination";

export const runtime="nodejs";
export const maxDuration=300;

const MARKETS=[
  {country:"Türkiye",city:"İstanbul"},
  {country:"Türkiye",city:"Ankara"},
  {country:"Türkiye",city:"İzmir"},
  {country:"United Kingdom",city:"London"},
  {country:"Germany",city:"Berlin"},
  {country:"France",city:"Paris"},
  {country:"United States",city:"New York"},
  {country:"United States",city:"Miami"},
  {country:"Canada",city:"Toronto"},
  {country:"United Arab Emirates",city:"Dubai"}
];

function authorized(req){
  const secret=process.env.CRON_SECRET||"";
  const auth=req.headers.get("authorization")||"";
  return Boolean(secret)&&auth===`Bearer ${secret}`;
}

function marketForToday(){
  const day=Math.floor(Date.now()/86400000);
  return MARKETS[day%MARKETS.length];
}

function logCycle(event,payload={}){
  console.log(JSON.stringify({source:"daily-agent-cycle",event,at:new Date().toISOString(),...payload}));
}

async function share(event){
  try{await addSharedAgentEvent(event)}catch(e){console.error(JSON.stringify({source:"agent-coordinator",event:"share-error",error:String(e?.message||e).slice(0,160)}))}
}

export async function GET(req){
  if(!authorized(req)){
    logCycle("unauthorized");
    return Response.json({ok:false,error:"unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
  }

  const startedAt=new Date().toISOString();
  const market=marketForToday();
  const report={ok:true,startedAt,market,discovered:0,newProspects:0,scanned:0,completed:0,errors:[]};
  logCycle("started",{market});
  await share({agent:"Koordinatör Ajan",eventType:"cycle-start",title:`Günlük ajan döngüsü başladı: ${market.city}`,detail:`${market.country} / ${market.city} pazarı ortak çalışma alanına açıldı.`,payload:{market}});

  try{
    const existingNames=await getProspectNames();
    const found=await discoverBusinesses({...market,existingNames});
    report.discovered=found.length;
    logCycle("discovery-complete",{market,discovered:report.discovered,existingProspects:existingNames.length});
    await share({agent:"Araştırma Ajanı",eventType:"discovery",title:`${report.discovered} işletme bulundu`,detail:`${market.city} taraması tamamlandı ve bulgular Koordinatör Ajan ile paylaşıldı.`,payload:{market,discovered:report.discovered}});

    const seeded=await seedProspects(found);
    const existingSet=new Set(existingNames.map(x=>String(x).toLocaleLowerCase("tr-TR")));
    const fresh=seeded.filter(x=>!existingSet.has(String(x.name||"").toLocaleLowerCase("tr-TR")));
    report.newProspects=fresh.length;
    logCycle("prospects-seeded",{newProspects:report.newProspects});
    await share({agent:"Lead Finder",eventType:"handoff",title:`${report.newProspects} yeni aday ortak panoya aktarıldı`,detail:"Yeni adaylar görünürlük taraması için sıraya alındı.",payload:{newProspects:report.newProspects}});

    for(const prospect of fresh.slice(0,4)){
      try{
        report.scanned+=1;
        logCycle("scan-started",{prospectId:prospect.id,name:prospect.name,scanned:report.scanned});
        await share({agent:"Görünürlük Ajanı",eventType:"scan-start",title:`Tarama başladı: ${prospect.name}`,detail:"Koordinatör Ajan ilgili bulguları diğer uzman ajanlarla paylaşacak.",payload:{prospectId:prospect.id,name:prospect.name}});
        const scan=await queueProspectScan(prospect.id);
        if(scan.status==="demo-only")throw new Error("database-unavailable");
        const result=await runProviderCheck(prospect);
        if(!result)throw new Error("no-provider-result");
        await completeProspectScan(scan.id,prospect.id,result);
        report.completed+=1;
        logCycle("scan-completed",{prospectId:prospect.id,name:prospect.name,completed:report.completed});
        await share({agent:"Görünürlük Ajanı",eventType:"handoff",title:`Tarama tamamlandı: ${prospect.name}`,detail:"Sonuçlar İçerik, Uygulama, Satış ve CEO ajanlarının ortak kullanımına açıldı.",payload:{prospectId:prospect.id,name:prospect.name,provider:result?.provider||""},status:"completed"});
      }catch(e){
        const error=String(e?.message||e).slice(0,180);
        report.errors.push({prospectId:prospect.id,name:prospect.name,error});
        console.error(JSON.stringify({source:"daily-agent-cycle",event:"scan-error",at:new Date().toISOString(),prospectId:prospect.id,name:prospect.name,error}));
        await share({agent:"Risk Ajanı",eventType:"error",title:`Tarama hatası: ${prospect.name}`,detail:error,payload:{prospectId:prospect.id,name:prospect.name},status:"needs-attention"});
      }
    }
  }catch(e){
    report.ok=false;
    const error=String(e?.message||e).slice(0,220);
    report.errors.push({stage:"discovery",error});
    console.error(JSON.stringify({source:"daily-agent-cycle",event:"discovery-error",at:new Date().toISOString(),market,error}));
    await share({agent:"Risk Ajanı",eventType:"error",title:"Günlük keşif aşamasında hata",detail:error,payload:{market},status:"needs-attention"});
  }

  const finishedAt=new Date().toISOString();
  const finalReport={...report,finishedAt};
  logCycle("finished",{
    ok:report.ok,
    market,
    discovered:report.discovered,
    newProspects:report.newProspects,
    scanned:report.scanned,
    completed:report.completed,
    errorCount:report.errors.length,
    startedAt,
    finishedAt
  });

  try{await saveDailyAgentReport(finalReport)}catch(e){console.error(JSON.stringify({source:"daily-agent-cycle",event:"report-save-error",error:String(e?.message||e).slice(0,180)}))}
  await share({agent:"CEO Ajanı",eventType:"daily-summary",title:`Günlük özet: ${report.completed}/${report.scanned} tarama tamamlandı`,detail:`Bulunan ${report.discovered}, yeni aday ${report.newProspects}, hata ${report.errors.length}.`,payload:finalReport,status:report.errors.length?"needs-attention":"completed"});

  return Response.json(finalReport,{status:report.ok?200:500,headers:{"cache-control":"no-store"}});
}
