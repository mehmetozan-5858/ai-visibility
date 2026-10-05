import {refreshLearnedPolicies,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const policies=await refreshLearnedPolicies(),validated=policies.filter(x=>x.safeToApply);
  if(validated.length)await addSharedAgentEvent({agent:"Policy Brain",helperAgent:"CEO Ajanı",eventType:"validated-policy",title:`${validated.length} kanıt eşiğini geçen politika`,detail:validated.slice(0,5).map(x=>`${x.policyType}: ${x.winner} (%${x.confidence} güven)`).join(" · "),payload:{validated},status:"completed"}).catch(()=>null);
  return Response.json({ok:true,policies:policies.length,validated:validated.length,items:policies,automaticCustomerActions:false,automaticFinancialActions:false});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
