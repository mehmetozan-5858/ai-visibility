import {buildDualEngineSnapshot,buildDualEngineQualityScorecard,refreshDualEngineImprovementBacklog,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const [balance,quality,improvements]=await Promise.all([buildDualEngineSnapshot(),buildDualEngineQualityScorecard(),refreshDualEngineImprovementBacklog()]);
  const priority=improvements[0]||null;
  await heartbeatComponent({key:"unified-mission-control",type:"command",ok:true,expectedIntervalMinutes:1440,detail:`Quality ${quality.score||0}; priority ${priority?.pillar||"none"}`}).catch(()=>null);
  await addSharedAgentEvent({agent:"Unified Mission Control",helperAgent:"Improvement Brain",eventType:"dual-engine-command",title:"Business + Creator ortak komuta planı",detail:priority?`Öncelik: ${priority.pillar} · skor %${priority.score} · ${priority.action}`:"Kritik geliştirme açığı yok.",payload:{balance,quality,improvements},status:Number(priority?.priority||0)>=50?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,balance,quality,improvements,automaticSpendChange:false,automaticOutreach:false});
 }catch(e){await heartbeatComponent({key:"unified-mission-control",type:"command",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
