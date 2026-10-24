import {analyzeAgentOperations} from "./ai-visibility-agent-audit-analysis.mjs";
/**
 * Pure tenant-bound Audit & Control report. Only accepts pre-aggregated metrics.
 * The caller must have authorized the verified client's entitlement first.
 * No raw events, prompts, tokens, or persistence.
 */
export function buildAgentAuditClientReport({authorizedClientId,records,generatedAt}={}){
 if(typeof authorizedClientId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authorizedClientId))return {ok:false,reason:"invalid-client"};
 if(!Array.isArray(records)||records.length>100)return {ok:false,reason:"invalid-records"};
 if(typeof generatedAt!=="string"||!Number.isFinite(Date.parse(generatedAt)))return {ok:false,reason:"invalid-report-time"};
 const agents=[];
 for(const item of records){
  if(!item||item.clientId!==authorizedClientId)return {ok:false,reason:"cross-tenant-record"};
  agents.push({id:item.id,runs:item.runs,failures:item.failures,humanHandoffs:item.humanHandoffs,estimatedCostCents:item.estimatedCostCents});
 }
 const result=analyzeAgentOperations({agents});
 if(!result.ok)return result;
 return {ok:true,clientId:authorizedClientId,generatedAt,serviceId:"agent-audit-control",summary:result.summary,agents:result.agents};
}
