import {requireAdmin,requireSameOrigin} from "../../../lib/api-security";
import {addSharedAgentEvent,getAgentCenter} from "../../../lib/agent-coordination";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  return Response.json(await getAgentCenter(),{headers:{"cache-control":"no-store"}});
}

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originDenied=requireSameOrigin(req);if(originDenied)return originDenied;
  const body=await req.json().catch(()=>({}));
  const event=await addSharedAgentEvent({
    agent:body.agent||"Koordinatör Ajan",
    helperAgent:body.helperAgent||"Koordinatör Ajan",
    eventType:body.eventType||"note",
    title:String(body.title||"").slice(0,180),
    detail:String(body.detail||"").slice(0,1000),
    payload:body.payload||{},
    status:body.status||"open"
  });
  if(!event)return Response.json({ok:false,error:"title-required"},{status:400});
  return Response.json({ok:true,event});
}
