import {runSystemWatchdog,listSystemWatchdog,addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{
  await heartbeatComponent({key:"system-watchdog",type:"integrity",ok:true,expectedIntervalMinutes:60,detail:"Watchdog cycle alive"});
  const result=await runSystemWatchdog(),components=await listSystemWatchdog();
  if(result.stale.length)await addSharedAgentEvent({agent:"System Watchdog",helperAgent:"CEO Ajanı",eventType:"system-integrity",title:`${result.stale.length} sistem bileşeni gecikmiş`,detail:`${result.critical.length} kritik bileşen var. Güvenli yeniden deneme/insan incelemesi gerekli.`,payload:{stale:result.stale.slice(0,20)},status:result.critical.length?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,components,stale:result.stale.length,critical:result.critical.length,automaticExternalActions:false});
 }catch(e){await heartbeatComponent({key:"system-watchdog",type:"integrity",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
