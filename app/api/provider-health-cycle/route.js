import {listProviderHealth,addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const providers=await listProviderHealth(),bad=providers.filter(x=>["degraded","unhealthy"].includes(x.status));
  if(bad.length)await addSharedAgentEvent({agent:"Reliability Brain",helperAgent:"CEO Ajanı",eventType:"provider-health",title:`${bad.length} sağlayıcıda performans riski`,detail:bad.map(x=>`${x.provider}: ${x.status}`).join(" · "),payload:{bad},status:"needs-attention"}).catch(()=>null);
  await heartbeatComponent({key:"provider-health-cycle",type:"cycle",ok:true,expectedIntervalMinutes:60,detail:"Cycle completed"}).catch(()=>null);
  return Response.json({ok:true,providers,degraded:bad.length});
 }catch(e){await heartbeatComponent({key:"provider-health-cycle",type:"cycle",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
