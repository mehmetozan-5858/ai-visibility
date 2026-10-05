import {refreshCreatorIntelligence} from "../../../lib/creator-hunt";
import {heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const items=await refreshCreatorIntelligence(),urgent=items.filter(x=>x.priority>=80).slice(0,25),hot=items.filter(x=>x.qualification==="hot");
  await heartbeatComponent({key:"creator-intelligence-cycle",type:"creator",ok:true,expectedIntervalMinutes:60,detail:`Evaluated ${items.length}; hot ${hot.length}`}).catch(()=>null);
  if(urgent.length)await addSharedAgentEvent({agent:"Creator Intelligence Brain",helperAgent:"Dual Engine Command",eventType:"creator-next-best-action",title:`${urgent.length} yüksek öncelikli Creator hamlesi`,detail:urgent.slice(0,5).map(x=>`${x.displayName}: ${x.action}`).join(" · "),payload:{urgent},status:"needs-attention"}).catch(()=>null);
  return Response.json({ok:true,evaluated:items.length,hot:hot.length,urgent:urgent.length,top:items.slice(0,50),automaticOutreach:false});
 }catch(e){await heartbeatComponent({key:"creator-intelligence-cycle",type:"creator",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
