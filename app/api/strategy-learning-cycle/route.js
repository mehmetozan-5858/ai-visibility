import {refreshStrategyLearning,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const strategies=await refreshStrategyLearning(),top=strategies.filter(x=>Number(x.confidence)>=40).slice(0,5);
  if(top.length)await addSharedAgentEvent({agent:"Strategy Learning Engine",helperAgent:"CEO Ajanı",eventType:"strategy-learning",title:"En güçlü strateji kombinasyonları güncellendi",detail:top.map(x=>[x.country,x.city,x.sector,x.package,`skor ${x.strategyScore}`].filter(Boolean).join(" / ")).join(" · "),payload:{top},status:"completed"}).catch(()=>null);
  return Response.json({ok:true,strategies:strategies.length,top});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
