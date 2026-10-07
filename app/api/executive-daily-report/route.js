import {dailyAnswerEvidence} from "../../../lib/answer-evidence-daily";
import {reportDay,reportMarkets,validReportDate} from "../../../lib/reporting";
import {requireAdmin} from "../../../lib/api-security";
import {listDailyAgentReports,listSharedAgentEvents,listMarketLearning,listPredictiveAlerts,listAutonomousActions,listStrategyLearning,getProfitControlSnapshot,listProviderHealth} from "../../../lib/agent-coordination";
import {listCreatorHuntLeads} from "../../../lib/creator-hunt";
import {getExecutiveFunnelSnapshot,getPredictiveRiskSignals} from "../../../lib/repository";
import {listNextBestActions,getExperimentPerformance,listOpportunityForecasts} from "../../../lib/prospects";

export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const url=new URL(req.url);const date=url.searchParams.get("date")||reportDay();
  if(!validReportDate(date))return Response.json({error:"Geçersiz rapor tarihi."},{status:400});
  const [answerEvidence,runs,events,creators,funnel,risks,marketLearning,predictiveAlerts,autonomousActions,strategyLearning,nextBestActions,experimentPerformance,opportunityForecasts,profitControl,providerHealth]=await Promise.all([dailyAnswerEvidence(date).catch(()=>({available:false,error:"Günlük yanıt kanıtları alınamadı; sayımlar bilinmiyor."})),listDailyAgentReports(90),listSharedAgentEvents(200),listCreatorHuntLeads(300),getExecutiveFunnelSnapshot(),getPredictiveRiskSignals(),listMarketLearning(20),listPredictiveAlerts(30),listAutonomousActions(30),listStrategyLearning(30),listNextBestActions(50),getExperimentPerformance(),listOpportunityForecasts(50),getProfitControlSnapshot(),listProviderHealth()]);
  const dayRuns=runs.filter(x=>reportDay(x.finishedAt)===date);
  const dayEvents=events.filter(x=>reportDay(x.createdAt)===date);
  const dayCreators=creators.filter(x=>reportDay(x.createdAt)===date||reportDay(x.updatedAt)===date);
  const totals=dayRuns.reduce((a,x)=>({discovered:a.discovered+(x.discovered||0),newProspects:a.newProspects+(x.newProspects||0),scanned:a.scanned+(x.scanned||0),completed:a.completed+(x.completed||0),errors:a.errors+(x.errorCount||0)}),{discovered:0,newProspects:0,scanned:0,completed:0,errors:0});
  const markets=reportMarkets(dayRuns);
  const agents=[...new Set(dayEvents.map(x=>x.agent).filter(Boolean))];
  const p=funnel.prospects||{},conversion={qualifiedRate:p.total?Math.round((p.qualified||0)*100/p.total):0,replyRate:p.contacted?Math.round((p.replies||0)*100/p.contacted):0,winRate:p.proposals?Math.round((p.won||0)*100/p.proposals):0};
  return Response.json({date,generatedAt:new Date().toISOString(),totals,answerEvidence,funnel,conversion,risks,predictiveAlerts,autonomousActions,strategyLearning,nextBestActions,experimentPerformance,opportunityForecasts,profitControl,providerHealth,marketLearning,markets,creator:{found:dayCreators.length,highOpportunity:dayCreators.filter(x=>(x.opportunityScore||0)>=75).length,platforms:[...new Set(dayCreators.map(x=>x.platform))]},agents,events:dayEvents.slice(0,80),runs:dayRuns},{headers:{"cache-control":"no-store"}});
 }catch(e){return Response.json({error:"Gün sonu raporu hazırlanamadı.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
