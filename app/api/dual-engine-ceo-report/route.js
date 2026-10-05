import {creatorCommercialFunnelSnapshot} from "../../../lib/creator-hunt";
import {businessCommercialFunnelSnapshot,buildDualEngineQualityScorecard,heartbeatComponent,addSharedAgentEvent,recordDecisionAudit} from "../../../lib/agent-coordination";
export const runtime="nodejs";
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 try{const [business,creator,quality]=await Promise.all([businessCommercialFunnelSnapshot(),creatorCommercialFunnelSnapshot(),buildDualEngineQualityScorecard()]);
  const report={business,creator,quality:{score:quality.score,pillars:quality.pillars},truth:"Yalnız veritabanında doğrulanabilen aşamalar raporlanır. Creator tarafında doğrulanmış satış/ödeme kaydı oluşmadan gelir veya kazanılan müşteri sayısı üretilmez."};
  await recordDecisionAudit({decisionType:"dual-engine-ceo-report",entityType:"system",entityId:"commercial",agent:"CEO Ajanı",input:{business:business.funnel,creator:creator.funnel},evidence:{businessRates:business.rates,creatorRates:creator.rates},decision:{quality:report.quality},rationale:report.truth}).catch(()=>null);
  await heartbeatComponent({key:"dual-engine-ceo-report",type:"report",ok:true,expectedIntervalMinutes:1440,detail:`Business qualified ${business.funnel?.qualified||0}; Creator qualified ${creator.funnel?.qualified||0}`}).catch(()=>null);
  await addSharedAgentEvent({agent:"CEO Ajanı",helperAgent:"Unified Mission Control",eventType:"dual-engine-commercial-report",title:"Business + Creator ticari huni raporu",detail:`Business: ${business.funnel?.found||0} aday → ${business.funnel?.qualified||0} nitelikli → ${business.funnel?.offer_ready||0} teklif hazır → ${business.funnel?.won||0} kazanıldı · Creator: ${creator.funnel?.found||0} aday → ${creator.funnel?.qualified||0} nitelikli → ${creator.funnel?.offer_ready||0} teklif hazır`,payload:report,status:"completed"}).catch(()=>null);
  return Response.json({ok:true,report});
 }catch(e){await heartbeatComponent({key:"dual-engine-ceo-report",type:"report",ok:false,expectedIntervalMinutes:1440,detail:String(e?.message||e)}).catch(()=>null);return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
