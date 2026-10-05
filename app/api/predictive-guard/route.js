import {runPredictiveGuard,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const alerts=await runPredictiveGuard();for(const a of alerts){await addSharedAgentEvent({agent:"Risk Ajanı",helperAgent:"CEO Ajanı",eventType:"predictive-alert",title:a.title,detail:`${a.detail} Öneri: ${a.recommendation}`,payload:a,status:a.severity==="high"?"needs-attention":"open"}).catch(()=>null)}
 return Response.json({ok:true,newAlerts:alerts.length,alerts});}catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
