import {buildWorldClassScorecard,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const scorecard=await buildWorldClassScorecard();
  await heartbeatComponent({key:"world-class-scorecard",type:"command",ok:true,expectedIntervalMinutes:1440,detail:`Engineering score: ${scorecard.score}/100`}).catch(()=>null);
  await addSharedAgentEvent({agent:"Mission Control Brain",helperAgent:"CEO Ajanı",eventType:"world-class-scorecard",title:`Dünya standardı mühendislik skoru: ${scorecard.score}/100`,detail:scorecard.gaps.map(x=>`${x.pillar}: ${x.value}`).join(" · "),payload:scorecard,status:scorecard.score<60?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,scorecard});
 }catch(e){await heartbeatComponent({key:"world-class-scorecard",type:"command",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
