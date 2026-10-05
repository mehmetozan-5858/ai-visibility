import {refreshImprovementBacklog,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const backlog=await refreshImprovementBacklog(),top=backlog.slice(0,3);
  await heartbeatComponent({key:"improvement-brain-cycle",type:"learning",ok:true,expectedIntervalMinutes:1440,detail:`Top gap: ${top[0]?.pillar||"none"}`}).catch(()=>null);
  await addSharedAgentEvent({agent:"Improvement Brain",helperAgent:"Mission Control Brain",eventType:"continuous-improvement",title:"Mega Makine gelişim öncelikleri yenilendi",detail:top.map(x=>`${x.pillar}: ${x.currentScore}/100`).join(" · "),payload:{top},status:top.some(x=>Number(x.currentScore)<60)?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,backlog,top});
 }catch(e){await heartbeatComponent({key:"improvement-brain-cycle",type:"learning",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
