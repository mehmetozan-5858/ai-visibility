import {diagnoseDependencyIncidents,listDependencyIncidents,addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{
  const found=await diagnoseDependencyIncidents(),incidents=await listDependencyIncidents(50);
  await heartbeatComponent({key:"dependency-brain-cycle",type:"integrity",ok:true,expectedIntervalMinutes:60,detail:`Open root-cause incidents: ${incidents.length}`}).catch(()=>null);
  if(found.length)await addSharedAgentEvent({agent:"Dependency Brain",helperAgent:"System Watchdog",eventType:"root-cause",title:`${found.length} kök neden ilişkisi bulundu`,detail:found.slice(0,5).map(x=>`${x.rootComponent} → ${x.affected.length} etkilenen motor`).join(" · "),payload:{incidents:found},status:found.some(x=>x.severity==="critical")?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,found:found.length,incidents,automaticExternalActions:false});
 }catch(e){await heartbeatComponent({key:"dependency-brain-cycle",type:"integrity",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
