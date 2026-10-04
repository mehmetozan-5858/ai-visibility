import {discoverBusinesses,runProviderCheck} from "../../../../../lib/providers";
import {getProspectNames,seedProspects,queueProspectScan,completeProspectScan} from "../../../../../lib/prospects";

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

export async function GET(req){
  if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401,headers:{"cache-control":"no-store"}});

  const startedAt=new Date().toISOString();
  const market=marketForToday();
  const report={ok:true,startedAt,market,discovered:0,newProspects:0,scanned:0,completed:0,errors:[]};

  try{
    const existingNames=await getProspectNames();
    const found=await discoverBusinesses({...market,existingNames});
    report.discovered=found.length;
    const seeded=await seedProspects(found);
    const existingSet=new Set(existingNames.map(x=>String(x).toLocaleLowerCase("tr-TR")));
    const fresh=seeded.filter(x=>!existingSet.has(String(x.name||"").toLocaleLowerCase("tr-TR")));
    report.newProspects=fresh.length;

    // Keep daily provider cost bounded. The remaining prospects stay in the lead pool for later cycles.
    for(const prospect of fresh.slice(0,4)){
      try{
        report.scanned+=1;
        const scan=await queueProspectScan(prospect.id);
        if(scan.status==="demo-only")throw new Error("database-unavailable");
        const result=await runProviderCheck(prospect);
        if(!result)throw new Error("no-provider-result");
        await completeProspectScan(scan.id,prospect.id,result);
        report.completed+=1;
      }catch(e){
        report.errors.push({prospectId:prospect.id,name:prospect.name,error:String(e?.message||e).slice(0,180)});
      }
    }
  }catch(e){
    report.ok=false;
    report.errors.push({stage:"discovery",error:String(e?.message||e).slice(0,220)});
  }

  return Response.json({...report,finishedAt:new Date().toISOString()},{status:report.ok?200:500,headers:{"cache-control":"no-store"}});
}
