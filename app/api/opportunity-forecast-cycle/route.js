import {refreshOpportunityForecasts} from "../../../lib/prospects";
import {addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const items=await refreshOpportunityForecasts(1000),top=items.filter(x=>x.probability>=50).slice(0,20);
  if(top.length)await addSharedAgentEvent({agent:"Opportunity Forecast Brain",helperAgent:"CEO Ajanı",eventType:"opportunity-forecast",title:`${top.length} yüksek olasılıklı satış fırsatı`,detail:top.slice(0,5).map(x=>`${x.name}: %${x.probability}`).join(" · "),payload:{top},status:"completed"}).catch(()=>null);
  await heartbeatComponent({key:"opportunity-forecast-cycle",type:"cycle",ok:true,expectedIntervalMinutes:60,detail:"Cycle completed"}).catch(()=>null);
 return Response.json({ok:true,evaluated:items.length,highProbability:top.length,top,disclaimer:"Olasılık ve beklenen değer tahmindir; garanti değildir."});
 }catch(e){await heartbeatComponent({key:"opportunity-forecast-cycle",type:"cycle",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
