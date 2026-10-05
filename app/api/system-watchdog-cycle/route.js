import {runSystemWatchdog,listSystemWatchdog,addSharedAgentEvent,heartbeatComponent,planSafeRecoveries,markRecoveryAttempt,recordDecisionAudit} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{
  await heartbeatComponent({key:"system-watchdog",type:"integrity",ok:true,expectedIntervalMinutes:60,detail:"Watchdog cycle alive"});
  const result=await runSystemWatchdog(),recoveries=await planSafeRecoveries(),recoveryResults=[];
  const base=new URL(req.url).origin,secret=process.env.AUTO_HUNT_SECRET||process.env.CRON_SECRET;
  for(const item of recoveries){
   try{const rr=await fetch(base+item.route,{method:"GET",headers:{authorization:`Bearer ${secret}`},cache:"no-store"});const ok=rr.ok;await markRecoveryAttempt(item.componentKey,{ok,detail:ok?"Watchdog safe retry succeeded":`Safe retry HTTP ${rr.status}`});await recordDecisionAudit({decisionType:"watchdog-auto-recovery",entityType:"system-component",entityId:item.componentKey,agent:"System Watchdog",input:{route:item.route,attempt:item.attempt},decision:{retry:true},rationale:"Stale allowlisted internal cycle received one bounded retry.",outcome:{ok,status:rr.status}}).catch(()=>null);recoveryResults.push({componentKey:item.componentKey,ok,status:rr.status})}
   catch(e){await markRecoveryAttempt(item.componentKey,{ok:false,detail:String(e?.message||e)});recoveryResults.push({componentKey:item.componentKey,ok:false,error:String(e?.message||e).slice(0,120)})}
  }
  const components=await listSystemWatchdog();
  if(result.stale.length)await addSharedAgentEvent({agent:"System Watchdog",helperAgent:"CEO Ajanı",eventType:"system-integrity",title:`${result.stale.length} sistem bileşeni gecikmiş`,detail:`${result.critical.length} kritik bileşen var. Güvenli yeniden deneme/insan incelemesi gerekli.`,payload:{stale:result.stale.slice(0,20)},status:result.critical.length?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,components,stale:result.stale.length,critical:result.critical.length,recoveryResults,automaticExternalActions:false,boundedInternalRecovery:true});
 }catch(e){await heartbeatComponent({key:"system-watchdog",type:"integrity",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
