import {discoverCreatorBenchmarkSignals} from "../../../lib/providers";
import {saveBenchmarkSignals,refreshBenchmarkGapBacklog,generateWhiteSpaceHypotheses,heartbeatComponent,addSharedAgentEvent} from "../../../lib/agent-coordination";
export const runtime="nodejs"; export const maxDuration=300;
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const discovered=await discoverCreatorBenchmarkSignals(),saved=await saveBenchmarkSignals(discovered),gaps=await refreshBenchmarkGapBacklog(),ideas=await generateWhiteSpaceHypotheses(),creatorGaps=gaps.filter(x=>String(x.category).startsWith("creator:")),creatorIdeas=ideas.filter(x=>String(x.category).startsWith("creator:"));
  await heartbeatComponent({key:"creator-benchmark-innovation",type:"creator",ok:true,expectedIntervalMinutes:1440,detail:`Signals ${saved.length}; gaps ${creatorGaps.length}; ideas ${creatorIdeas.length}`}).catch(()=>null);
  if(saved.length)await addSharedAgentEvent({agent:"Creator Benchmark & Innovation Brain",helperAgent:"Improvement Brain",eventType:"creator-benchmark",title:`${saved.length} Creator pazar sinyali işlendi`,detail:`${creatorGaps.length} tekrar eden boşluk · ${creatorIdeas.length} white-space hipotezi`,payload:{signals:saved.slice(0,10),gaps:creatorGaps.slice(0,10),ideas:creatorIdeas.slice(0,10)},status:"completed"}).catch(()=>null);
  return Response.json({ok:true,signals:saved.length,gaps:creatorGaps,whiteSpaceHypotheses:creatorIdeas,automaticImplementation:false});
 }catch(e){await heartbeatComponent({key:"creator-benchmark-innovation",type:"creator",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
