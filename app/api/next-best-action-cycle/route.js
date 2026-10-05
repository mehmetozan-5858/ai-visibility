import {refreshNextBestActions} from "../../../lib/prospects";
import {addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const actions=await refreshNextBestActions(500),urgent=actions.filter(x=>x.priority>=80).slice(0,20);
  if(urgent.length)await addSharedAgentEvent({agent:"Next Best Action Engine",helperAgent:"CEO Ajanı",eventType:"decision-queue",title:`${urgent.length} yüksek öncelikli sonraki hamle`,detail:urgent.slice(0,5).map(x=>`${x.name}: ${x.action}`).join(" · "),payload:{urgent},status:"needs-attention"}).catch(()=>null);
  return Response.json({ok:true,evaluated:actions.length,urgent:urgent.length,top:actions.slice(0,50)});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
