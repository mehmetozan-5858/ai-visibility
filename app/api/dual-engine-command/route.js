import {buildDualEngineSnapshot,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const snapshot=await buildDualEngineSnapshot();
  await heartbeatComponent({key:"dual-engine-command",type:"command",ok:true,expectedIntervalMinutes:1440,detail:`Business ${snapshot.business?.depthScore||0} / Creator ${snapshot.creator?.depthScore||0}`}).catch(()=>null);
  await addSharedAgentEvent({agent:"Dual Engine Command",helperAgent:"Mission Control Brain",eventType:"portfolio-balance",title:"Business + Creator ortak büyüme dengesi",detail:`Business %${snapshot.balance?.recommendedFocus?.business||50} · Creator %${snapshot.balance?.recommendedFocus?.creator||50} geliştirme odağı`,payload:snapshot,status:Number(snapshot.balance?.imbalance||0)>25?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,snapshot,automaticSpendChange:false,automaticOutreachChange:false});
 }catch(e){await heartbeatComponent({key:"dual-engine-command",type:"command",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
