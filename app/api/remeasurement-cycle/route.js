import {withRemeasurementLock} from '../../../lib/remeasurement-lock';
import {withRequestBudget,remainingBudget} from '../../../lib/request-budget';
import {heartbeatComponent} from "../../../lib/agent-coordination";
import {getClientsReadyForRemeasurement,createScan,completeScan,failScan,getScanComparison,addClientActivityEvent} from "../../../lib/repository";
import {getClientProfile} from "../../../lib/client-profile";
import {runLocalizedProviderChecks} from "../../../lib/localized-ai";
import {syncFindingsFromScan} from "../../../lib/findings";
export const runtime="nodejs";export const maxDuration=240;
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 return withRequestBudget(210000,async()=>{try{const result=await withRemeasurementLock(async()=>{
 const clients=await getClientsReadyForRemeasurement(8),out={ok:true,eligible:clients.length,remeasured:0,improved:0,unchanged:0,declined:0,uncompared:0,skipped:[],deferred:0,errors:[]};
 for(const [index,client] of clients.entries()){let scanId="",scanCompleted=false;
  if(remainingBudget()<60000){out.deferred=clients.length-index;break}
  try{
   if(!(await getClientsReadyForRemeasurement(1,client.id)).length){out.skipped.push({clientId:client.id,reason:'eligibility-changed'});continue}
   const profile=await getClientProfile(client.id).catch(()=>null),scan=await createScan(client.id,[]);scanId=scan.id;
   if(!scan.persisted)throw new Error("database-unavailable");
   const run=await runLocalizedProviderChecks({name:client.name,domain:client.domain,sector:profile?.sector||"",city:profile?.city||"",country:profile?.country||"",queries:[]},"tr");
   if(!run.results.length)throw new Error("no-provider-result");
   if(!(await getClientsReadyForRemeasurement(1,client.id)).length)throw Error('eligibility-changed-during-scan');
   const completed=await completeScan(scan.id,run.results);scanCompleted=true;await syncFindingsFromScan(client.id,completed).catch(()=>[]);
   const comparison=await getScanComparison(client.id);out.remeasured++;
   if(!comparison)out.uncompared++;else if(comparison.delta>0)out.improved++;else if(comparison.delta<0)out.declined++;else out.unchanged++;
   await addClientActivityEvent(client.id,"remeasurement","Uygulama sonrası yeniden ölçüm tamamlandı",comparison?`Önceki skor ${comparison.previous.score}/100 → yeni skor ${comparison.current.score}/100; değişim ${comparison.delta>0?"+":""}${comparison.delta} puan.`:"Karşılaştırma için yeterli geçmiş tarama bulunamadı.",{comparison,automatic:true});
  }catch(e){if(scanId&&!scanCompleted)await failScan(scanId,String(e?.message||e)).catch(()=>null);out.errors.push({clientId:client.id,error:String(e?.message||e).slice(0,160)})}
 }
 await heartbeatComponent({key:"remeasurement-cycle",type:"cycle",ok:out.errors.length===0,expectedIntervalMinutes:60,detail:`eligible=${out.eligible}; errors=${out.errors.length}`}).catch(()=>null);
 return out;
 });return Response.json(result,{headers:{"cache-control":"no-store"}})}catch{return Response.json({ok:false,error:'Yeniden ölçüm döngüsü başlatılamadı.'},{status:500})}});
}
