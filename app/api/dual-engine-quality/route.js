import {buildDualEngineQualityScorecard,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const scorecard=await buildDualEngineQualityScorecard();
  await heartbeatComponent({key:"dual-engine-quality",type:"quality",ok:true,expectedIntervalMinutes:1440,detail:`Score ${scorecard.score||0}`}).catch(()=>null);
  await addSharedAgentEvent({agent:"Dual Engine Quality Brain",helperAgent:"Mission Control Brain",eventType:"quality-scorecard",title:`Business + Creator kalite skoru: ${scorecard.score||0}/100`,detail:Object.entries(scorecard.pillars||{}).map(([k,v])=>`${k} %${v}`).join(" · "),payload:scorecard,status:Number(scorecard.score||0)<60?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,scorecard});
 }catch(e){await heartbeatComponent({key:"dual-engine-quality",type:"quality",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
