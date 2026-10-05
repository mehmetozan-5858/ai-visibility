import {refreshOutcomeExperiments,getExperimentPerformance} from "../../../lib/prospects";
import {addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const evaluated=await refreshOutcomeExperiments(700),performance=await getExperimentPerformance();
  const mature=performance.filter(x=>Number(x.outcomes)>=20),best=mature.sort((a,b)=>Number(b.avgValue)-Number(a.avgValue))[0]||null;
  if(best)await addSharedAgentEvent({agent:"Experiment Engine",helperAgent:"CEO Ajanı",eventType:"learning-result",title:`Deney sonucu olgunlaşıyor: varyant ${best.variant}`,detail:`${best.outcomes} sonuç · ${best.wins} satış · ortalama değer ${best.avgValue}. Henüz otomatik politika değişikliği yapılmadı.`,payload:{performance,best},status:"completed"}).catch(()=>null);
  await heartbeatComponent({key:"outcome-learning-cycle",type:"cycle",ok:true,expectedIntervalMinutes:60,detail:"Outcome memory refreshed"}).catch(()=>null);
  return Response.json({ok:true,evaluated:evaluated.length,performance,best,policyChanged:false});
 }catch(e){await heartbeatComponent({key:"outcome-learning-cycle",type:"cycle",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
