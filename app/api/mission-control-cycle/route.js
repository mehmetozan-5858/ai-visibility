import {buildMissionControlSnapshot,addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const mission=await buildMissionControlSnapshot();
  await heartbeatComponent({key:"mission-control-cycle",type:"command",ok:true,expectedIntervalMinutes:60,detail:`Mode: ${mission.mode}; priority: ${mission.priority}`}).catch(()=>null);
  await addSharedAgentEvent({agent:"Mission Control Brain",helperAgent:"CEO Ajanı",eventType:"mission-control",title:`Mega Makine modu: ${mission.mode}`,detail:`${mission.priority} · ${mission.rationale}`,payload:mission,status:mission.mode==="protect"?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,mission,automaticFinancialActions:false,automaticCustomerActions:false});
 }catch(e){await heartbeatComponent({key:"mission-control-cycle",type:"command",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
