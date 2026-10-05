import {runSelfHealingDecisionEngine,addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const actions=await runSelfHealingDecisionEngine();for(const x of actions){await addSharedAgentEvent({agent:"Decision Engine",helperAgent:"CEO Ajanı",eventType:"self-healing-decision",title:`Karar önerisi: ${x.actionType}`,detail:x.reason,payload:x,status:"needs-attention"}).catch(()=>null)}
 await heartbeatComponent({key:"self-healing-cycle",type:"cycle",ok:true,expectedIntervalMinutes:60,detail:"Cycle completed"}).catch(()=>null);\n  return Response.json({ok:true,decisions:actions.length,actions,note:"Finansal veya müşteri iletişimi etkileyen kararlar otomatik uygulanmaz."});}
 catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
