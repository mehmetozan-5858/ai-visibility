import {refreshBudgetGuard,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const guard=await refreshBudgetGuard();
  if(guard.mode!=="normal")await addSharedAgentEvent({agent:"Budget Guard",helperAgent:"CEO Ajanı",eventType:"budget-brake",title:`Bütçe koruması: ${guard.mode}`,detail:guard.reason,payload:guard,status:guard.mode==="emergency"?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,...guard,customerServicePaused:false,financialActionsAutomatic:false});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
