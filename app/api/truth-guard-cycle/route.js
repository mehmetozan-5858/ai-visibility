import {listTruthGuardRisks,addSharedAgentEvent,heartbeatComponent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const risks=await listTruthGuardRisks(100),rejected=risks.filter(x=>x.status==="rejected");
  if(risks.length)await addSharedAgentEvent({agent:"Truth Guard",helperAgent:"CEO Ajanı",eventType:"data-quality",title:`${risks.length} veri kalite kontrolü inceleme istiyor`,detail:`${rejected.length} kayıt reddedildi; doğrulanmamış veri satış zincirine geçirilmedi.`,payload:{risks:risks.slice(0,20)},status:rejected.length?"needs-attention":"completed"}).catch(()=>null);
  await heartbeatComponent({key:"truth-guard-cycle",type:"cycle",ok:true,expectedIntervalMinutes:60,detail:"Cycle completed"}).catch(()=>null);\n  return Response.json({ok:true,risks:risks.length,rejected:rejected.length,items:risks});
 }catch(e){await heartbeatComponent({key:"truth-guard-cycle",type:"cycle",ok:false,expectedIntervalMinutes:60,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
