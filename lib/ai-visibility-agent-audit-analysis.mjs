/**
 * Offline-only Agent Audit & Control analyzer.
 * Consumes sanitized counters, never raw prompts, secrets, or user messages.
 * No external calls, persistence, legal advice, or automated actions.
 */
const metrics=["runs","failures","humanHandoffs","estimatedCostCents"];
const safeInt=n=>Number.isSafeInteger(n)&&n>=0;
export function analyzeAgentOperations({agents}={}){
 if(!Array.isArray(agents)||agents.length>100)return {ok:false,reason:"invalid-agents"};
 const output=[];
 for(const agent of agents){
  if(!agent||typeof agent.id!=="string"||!/^[a-zA-Z0-9_-]{1,64}$/.test(agent.id)||metrics.some(k=>!safeInt(agent[k])))return {ok:false,reason:"invalid-agent-metrics"};
  if(agent.failures>agent.runs||agent.humanHandoffs>agent.runs)return {ok:false,reason:"inconsistent-counters"};
  const failureRate=agent.runs===0?0:Math.round(agent.failures/agent.runs*10000)/100;
  const flags=[];
  if(agent.runs>=10&&failureRate>=10)flags.push("high-failure-rate");
  if(agent.estimatedCostCents>10000)flags.push("cost-review");
  output.push({id:agent.id,runs:agent.runs,failureRatePercent:failureRate,humanHandoffs:agent.humanHandoffs,estimatedCostCents:agent.estimatedCostCents,flags});
 }
 return {ok:true,agents:output,summary:{agentCount:output.length,flaggedCount:output.filter(x=>x.flags.length).length}};
}
