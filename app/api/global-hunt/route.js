import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";
import {databasePool} from "../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../lib/db";
import {refreshBudgetGuard} from "../../../lib/agent-coordination";
import {GET as businessHunt} from "../cron/daily-cycle/route";
import {GET as creatorHunt} from "../creator-hunt/route";

export const runtime="nodejs";
export const maxDuration=300;
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const originError=enforceSameOrigin(req);if(originError)return originError;
 const limited=checkRateLimit(req,{bucket:"global-hunt",limit:2,windowMs:3600000});if(limited)return limited;
 const secret=process.env.CRON_SECRET||process.env.AUTO_HUNT_SECRET;
 const url=getDatabaseUrl();
 if(!secret||!url)return Response.json({error:"Global tarama yapılandırması eksik."},{status:503});
 let client,locked=false;
 try{
  client=await databasePool(url).connect();
  locked=Boolean((await client.query("SELECT pg_try_advisory_lock(741852965) AS acquired")).rows[0]?.acquired);
  if(!locked)return Response.json({error:"Global tarama zaten çalışıyor."},{status:409});
  const guard=await refreshBudgetGuard();
  if(guard.mode==="emergency")return Response.json({error:"AI bütçesi doldu; tarama başlatılmadı."},{status:409});
  const request=()=>new Request(req.url,{headers:{authorization:`Bearer ${secret}`}});
  const results=await Promise.allSettled([businessHunt(request()),creatorHunt(request())]);
  const summarize=async(result)=>{
   if(result.status!=="fulfilled")return {ok:false,error:"Tarama tamamlanamadı."};
   const d=await result.value.json();
   return {ok:result.value.ok&&d.ok===true,skipped:d.skipped||null,found:Number(d.discovered??d.found??0),saved:Number(d.newProspects??d.saved??0),analyzed:Number(d.completed??0),markets:d.market?.markets||d.cells?.map(({country,platform,niche})=>({country,platform,niche}))||[],errorCount:d.errors?.length||d.providerErrors?.length||0};
  };
  const [business,creator]=await Promise.all(results.map(summarize));
  return Response.json({ok:business.ok&&creator.ok,business,creator,automaticSending:false},{headers:{"cache-control":"no-store"}});
 }catch{return Response.json({error:"Global tarama tamamlanamadı. Ajan durumunu kontrol edin."},{status:503})}
 finally{if(locked)await client.query("SELECT pg_advisory_unlock(741852965)").catch(()=>{});client?.release()}
}
