import {getProfitControlSnapshot,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const snapshot=await getProfitControlSnapshot(),negative=snapshot.currencies.filter(x=>x.cost>0&&x.contribution<0);
  if(negative.length)await addSharedAgentEvent({agent:"Cost & Profit Brain",helperAgent:"CEO Ajanı",eventType:"profit-risk",title:"Maliyet/gelir dengesi kontrol edildi",detail:negative.map(x=>`${x.currency}: katkı ${x.contribution}`).join(" · "),payload:{negative},status:"needs-attention"}).catch(()=>null);
  return Response.json({ok:true,...snapshot,financialActionsAutomatic:false});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
