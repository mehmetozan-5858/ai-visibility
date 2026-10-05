import {discoverBenchmarkSignals} from "../../../lib/providers";
import {saveBenchmarkSignals,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs";export const maxDuration=180;
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const found=await discoverBenchmarkSignals(),saved=await saveBenchmarkSignals(found),top=saved.filter(x=>Number(x.confidence)>=70).sort((a,b)=>Number(b.relevance)-Number(a.relevance)).slice(0,5);
  await heartbeatComponent({key:"benchmark-intelligence-cycle",type:"research",ok:true,expectedIntervalMinutes:1440,detail:`Evidence signals: ${saved.length}`}).catch(()=>null);
  if(top.length)await addSharedAgentEvent({agent:"Benchmark Intelligence Brain",helperAgent:"Improvement Brain",eventType:"competitive-intelligence",title:`${top.length} yüksek güvenli pazar/teknoloji sinyali`,detail:top.map(x=>x.competitor?x.competitor+": "+x.category:x.category).join(" · "),payload:{top},status:"completed"}).catch(()=>null);
  return Response.json({ok:true,found:found.length,saved:saved.length,top,sourceRequired:true});
 }catch(e){await heartbeatComponent({key:"benchmark-intelligence-cycle",type:"research",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
