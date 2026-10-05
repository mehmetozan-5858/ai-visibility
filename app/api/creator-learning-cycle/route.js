import {creatorLearningSnapshot,creatorPredictiveAlerts} from "../../../lib/creator-hunt";
import {heartbeatComponent,addSharedAgentEvent,recordDecisionAudit} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const learning=await creatorLearningSnapshot(),alerts=await creatorPredictiveAlerts(),opportunities=alerts.filter(x=>x.severity==="opportunity"),warnings=alerts.filter(x=>x.severity==="warning");
  await recordDecisionAudit({decisionType:"creator-learning",entityType:"creator-market",entityId:"global",agent:"Creator Learning Brain",input:{platforms:learning.platforms.length,niches:learning.niches.length,countries:learning.countries.length},evidence:{alerts:alerts.slice(0,20)},decision:{opportunities:opportunities.slice(0,10),warnings:warnings.slice(0,10)},rationale:"Creator tarama sonuçları platform, niş ve ülke bazında öğrenme sinyallerine dönüştürüldü; sinyaller yönlendiricidir, garanti değildir."}).catch(()=>null);
  await heartbeatComponent({key:"creator-learning-cycle",type:"learning",ok:true,expectedIntervalMinutes:60,detail:`Opportunities ${opportunities.length}; warnings ${warnings.length}`}).catch(()=>null);
  if(alerts.length)await addSharedAgentEvent({agent:"Creator Learning Brain",helperAgent:"Dual Engine Command",eventType:"creator-prediction",title:"Creator pazar öğrenmesi güncellendi",detail:`${opportunities.length} fırsat · ${warnings.length} uyarı`,payload:{opportunities:opportunities.slice(0,10),warnings:warnings.slice(0,10)},status:warnings.length?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,learning,alerts,automaticSpendChange:false,automaticOutreach:false});
 }catch(e){await heartbeatComponent({key:"creator-learning-cycle",type:"learning",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
