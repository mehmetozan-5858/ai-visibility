import {refreshResourceAllocations,addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const allocations=await refreshResourceAllocations(),priority=allocations.filter(x=>x.tier==="priority"),protectedRows=allocations.filter(x=>x.tier==="protected");
  await addSharedAgentEvent({agent:"Resource Orchestrator",helperAgent:"CEO Ajanı",eventType:"resource-allocation",title:"Kaynak dağılımı güncellendi",detail:`${priority.length} öncelikli pazar · ${protectedRows.length} maliyet korumalı pazar`,payload:{priority:priority.slice(0,10),protected:protectedRows.slice(0,10)},status:"completed"}).catch(()=>null);
  await heartbeatComponent({key:"resource-orchestrator-cycle",type:"cycle",ok:true,expectedIntervalMinutes:60,detail:"Cycle completed"}).catch(()=>null);\n  return Response.json({ok:true,allocations:allocations.length,priority:priority.length,protected:protectedRows.length,items:allocations,actualBillingIntegrated:false});
 }catch(e){await heartbeatComponent({key:"resource-orchestrator-cycle",type:"cycle",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
