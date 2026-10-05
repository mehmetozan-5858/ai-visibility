import {listTruthGuardRisks,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const risks=await listTruthGuardRisks(100),rejected=risks.filter(x=>x.status==="rejected");
  if(risks.length)await addSharedAgentEvent({agent:"Truth Guard",helperAgent:"CEO Ajanı",eventType:"data-quality",title:`${risks.length} veri kalite kontrolü inceleme istiyor`,detail:`${rejected.length} kayıt reddedildi; doğrulanmamış veri satış zincirine geçirilmedi.`,payload:{risks:risks.slice(0,20)},status:rejected.length?"needs-attention":"completed"}).catch(()=>null);
  return Response.json({ok:true,risks:risks.length,rejected:rejected.length,items:risks});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
