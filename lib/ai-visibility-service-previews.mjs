/**
 * Offline, deterministic AI Visibility launch service engine previews.
 * No external requests, persistence, outbound messages, charges or AI inference.
 */
const services=new Set(["agent-audit-control","agent-commerce-intelligence","candidate-rediscovery","voice-revenue-agent"]);
export function prepareLaunchServicePreview({serviceId,tenantId,records=[],consentVerified=false}={}){
 if(!services.has(serviceId))return {ok:false,reason:"unknown-service"};
 if(typeof tenantId!=="string"||!/^[\w-]{1,128}$/.test(tenantId))return {ok:false,reason:"invalid-tenant"};
 if(!Array.isArray(records)||records.length>100||records.some(r=>!r||typeof r!=="object"||r.tenantId!==tenantId))return {ok:false,reason:"invalid-or-cross-tenant-records"};
 if(["candidate-rediscovery","voice-revenue-agent"].includes(serviceId)&&consentVerified!==true)return {ok:false,reason:"consent-required"};
 const count=records.length;
 return {ok:true,state:"preview-only",serviceId,tenantId,summary:{
  recordsReviewed:count,
  category:serviceId==="agent-audit-control"?"agent-events":serviceId==="agent-commerce-intelligence"?"catalog-signals":serviceId==="candidate-rediscovery"?"candidate-metadata":"inbound-call-metadata"
 },externalActionsEnabled:false,requiresHumanReview:true};
}
