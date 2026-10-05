import {getPaidClientsNeedingImplementation,getLatestCompletedScan,saveImplementationWorkItems,addClientActivityEvent} from "../../../lib/repository";
import {runLocalizedImplementationPlan} from "../../../lib/localized-ai";
export const runtime="nodejs";export const maxDuration=180;
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 const clients=await getPaidClientsNeedingImplementation(12),out={ok:true,eligible:clients.length,prepared:0,waitingForScan:0,errors:[]};
 for(const client of clients){
  try{
   const scan=await getLatestCompletedScan(client.id);
   if(!scan){out.waitingForScan++;await addClientActivityEvent(client.id,"implementation-waiting","Uygulama zinciri tarama bekliyor","Ödeme doğrulandı; uygulama paketi için tamamlanmış müşteri taraması gerekiyor.");continue}
   const plan=await runLocalizedImplementationPlan({clientName:client.name,domain:client.domain,score:scan.score,results:Array.isArray(scan.results)?scan.results:[]},"tr");
   const workItems=await saveImplementationWorkItems(client.id,plan);
   await addClientActivityEvent(client.id,"implementation-prepared","Uygulama paketi otomatik hazırlandı",`${workItems.length} görev hazırlandı; erişim ve müşteri onayı gereken işler ayrı tutuldu.`,{scanId:scan.id,workItemCount:workItems.length});
   out.prepared++;
  }catch(e){out.errors.push({clientId:client.id,error:String(e?.message||e).slice(0,160)})}
 }
 return Response.json(out,{headers:{"cache-control":"no-store"}});
}
