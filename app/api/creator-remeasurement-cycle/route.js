import {refreshCreatorRemeasurement} from "../../../lib/creator-hunt";
import {heartbeatComponent,addSharedAgentEvent,recordDecisionAudit} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const items=await refreshCreatorRemeasurement(),changed=items.filter(x=>Object.values(x.deltas||{}).some(v=>Math.abs(Number(v))>=5));
  await recordDecisionAudit({decisionType:"creator-remeasurement",entityType:"creator",entityId:"portfolio",agent:"Creator Remeasurement Brain",input:{evaluated:items.length},evidence:{materialChanges:changed.slice(0,20)},decision:{changed:changed.length},rationale:"Creator skorları başlangıç ölçümüyle karşılaştırılır; değişim tek başına nedensellik iddiası değildir."}).catch(()=>null);
  await heartbeatComponent({key:"creator-remeasurement-cycle",type:"creator",ok:true,expectedIntervalMinutes:1440,detail:`Evaluated ${items.length}; changed ${changed.length}`}).catch(()=>null);
  if(changed.length)await addSharedAgentEvent({agent:"Creator Remeasurement Brain",helperAgent:"Creator Learning Brain",eventType:"creator-remeasurement",title:`${changed.length} Creator kaydında anlamlı skor değişimi`,detail:changed.slice(0,5).map(x=>x.displayName).join(" · "),payload:{changed:changed.slice(0,20)},status:"completed"}).catch(()=>null);
  return Response.json({ok:true,evaluated:items.length,changed:changed.length,items:changed.slice(0,50),causalityClaim:false});
 }catch(e){await heartbeatComponent({key:"creator-remeasurement-cycle",type:"creator",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
