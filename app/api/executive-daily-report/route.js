import {requireAdmin} from "../../../lib/api-security";
import {listDailyAgentReports,listSharedAgentEvents,listMarketLearning,listPredictiveAlerts,listAutonomousActions,listStrategyLearning} from "../../../lib/agent-coordination";
import {listCreatorHuntLeads} from "../../../lib/creator-hunt";
import {getExecutiveFunnelSnapshot,getPredictiveRiskSignals} from "../../../lib/repository";
import {listNextBestActions,getExperimentPerformance,listOpportunityForecasts} from "../../../lib/prospects";

export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const url=new URL(req.url);const date=url.searchParams.get("date")||new Date().toISOString().slice(0,10);
  const [runs,events,creators,funnel,risks,marketLearning,predictiveAlerts,autonomousActions,strategyLearning,nextBestActions,experimentPerformance,opportunityForecasts]=await Promise.all([listDailyAgentReports(90),listSharedAgentEvents(200),listCreatorHuntLeads(300),getExecutiveFunnelSnapshot(),getPredictiveRiskSignals(),listMarketLearning(20),listPredictiveAlerts(30),listAutonomousActions(30),listStrategyLearning(30),listNextBestActions(50),getExperimentPerformance(),listOpportunityForecasts(50)]);
  const dayRuns=runs.filter(x=>String(x.reportDate).slice(0,10)===date);
  const dayEvents=events.filter(x=>String(x.createdAt||"").slice(0,10)===date);
  const dayCreators=creators.filter(x=>String(x.createdAt||"").slice(0,10)===date||String(x.updatedAt||"").slice(0,10)===date);
  const totals=dayRuns.reduce((a,x)=>({discovered:a.discovered+(x.discovered||0),newProspects:a.newProspects+(x.newProspects||0),scanned:a.scanned+(x.scanned||0),completed:a.completed+(x.completed||0),errors:a.errors+(x.errorCount||0)}),{discovered:0,newProspects:0,scanned:0,completed:0,errors:0});
  const markets=[...new Map(dayRuns.map(x=>[JSON.stringify(x.market),x.market])).values()];
  const agents=[...new Set(dayEvents.map(x=>x.agent).filter(Boolean))];
  const p=funnel.prospects||{},conversion={qualifiedRate:p.total?Math.round((p.qualified||0)*100/p.total):0,replyRate:p.contacted?Math.round((p.replies||0)*100/p.contacted):0,winRate:p.proposals?Math.round((p.won||0)*100/p.proposals):0};
  return Response.json({date,generatedAt:new Date().toISOString(),totals,funnel,conversion,risks,predictiveAlerts,autonomousActions,strategyLearning,nextBestActions,experimentPerformance,opportunityForecasts,marketLearning,markets,creator:{found:dayCreators.length,highOpportunity:dayCreators.filter(x=>(x.opportunityScore||0)>=75).length,platforms:[...new Set(dayCreators.map(x=>x.platform))]},agents,events:dayEvents.slice(0,80),runs:dayRuns});
 }catch(e){return Response.json({error:"Gün sonu raporu hazırlanamadı.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
