import {heartbeatComponent} from "../../../lib/agent-coordination";
import {getClientsReadyForRemeasurement,createScan,completeScan,failScan,getScanComparison,addClientActivityEvent} from "../../../lib/repository";
import {getClientProfile} from "../../../lib/client-profile";
import {runLocalizedProviderChecks} from "../../../lib/localized-ai";
import {syncFindingsFromScan} from "../../../lib/findings";
export const runtime="nodejs";export const maxDuration=240;
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 const clients=await getClientsReadyForRemeasurement(8),out={ok:true,eligible:clients.length,remeasured:0,improved:0,unchanged:0,declined:0,errors:[]};
 for(const client of clients){let scanId="";
  try{
   const profile=await getClientProfile(client.id).catch(()=>null),scan=await createScan(client.id,[]);scanId=scan.id;
   if(!scan.persisted)throw new Error("database-unavailable");
   const run=await runLocalizedProviderChecks({name:client.name,domain:client.domain,sector:profile?.sector||"",city:profile?.city||"",country:profile?.country||"",queries:[]},"tr");
   if(!run.results.length)throw new Error("no-provider-result");
   const completed=await completeScan(scan.id,run.results);await syncFindingsFromScan(client.id,completed).catch(()=>[]);
   const comparison=await getScanComparison(client.id);out.remeasured++;
   if(comparison?.delta>0)out.improved++;else if(comparison?.delta<0)out.declined++;else out.unchanged++;
   await addClientActivityEvent(client.id,"remeasurement","Uygulama sonrası yeniden ölçüm tamamlandı",comparison?`Önceki skor ${comparison.previous.score}/100 → yeni skor ${comparison.current.score}/100; değişim ${comparison.delta>0?"+":""}${comparison.delta} puan.`:"Karşılaştırma için yeterli geçmiş tarama bulunamadı.",{comparison,automatic:true});
  }catch(e){if(scanId)await failScan(scanId,String(e?.message||e)).catch(()=>null);out.errors.push({clientId:client.id,error:String(e?.message||e).slice(0,160)})}
 }
 await heartbeatComponent({key:"remeasurement-cycle",type:"cycle",ok:out.errors.length===0,expectedIntervalMinutes:60,detail:`eligible=${out.eligible}; errors=${out.errors.length}`}).catch(()=>null);
 return Response.json(out,{headers:{"cache-control":"no-store"}});
}
