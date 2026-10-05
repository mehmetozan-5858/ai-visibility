import {generateWhiteSpaceHypotheses,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const hypotheses=await generateWhiteSpaceHypotheses(),top=hypotheses.slice(0,5);
  await heartbeatComponent({key:"innovation-brain-cycle",type:"innovation",ok:true,expectedIntervalMinutes:1440,detail:`White-space hypotheses: ${hypotheses.length}`}).catch(()=>null);
  if(top.length)await addSharedAgentEvent({agent:"Innovation / White-Space Brain",helperAgent:"Mission Control Brain",eventType:"innovation-hypothesis",title:`${top.length} farklılaşma hipotezi üretildi`,detail:top.map(x=>`${x.category}: ${x.innovationScore}/100`).join(" · "),payload:{top},status:"completed"}).catch(()=>null);
  return Response.json({ok:true,hypotheses,top,autoImplementation:false,requiresValidation:true});
 }catch(e){await heartbeatComponent({key:"innovation-brain-cycle",type:"innovation",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
