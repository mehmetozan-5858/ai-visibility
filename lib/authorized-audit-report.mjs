import {authorizeLaunchAction} from './ai-visibility-launch-access.mjs';
import {resolveLaunchServiceAvailability} from './ai-visibility-launch-entitlements.mjs';
import {prepareLaunchAuditEvent} from './ai-visibility-launch-audit.mjs';
import {reconcileRevenue} from './revenue-integrity.mjs';
import {assessRelease} from './release-assurance.mjs';

/** Shared Audit & Control submodule boundary. Server-loaded context only.
 * Returns an unpersisted report; routes must persist its audit atomically before
 * delivery. No provider, billing, email, deployment or database action occurs.
 */
export function prepareAuthorizedAuditReport({actor,membership,sessionClientId,accountClientId,
 entitlement,featureEnabled=false,globallyEnabled=false,now=Date.now(),kind,input}={}){
 const serviceId='agent-audit-control';
 const auth=authorizeLaunchAction({actor,membership,resourceTenantId:accountClientId,action:'report:create',featureEnabled});
 if(!auth.allowed)return {ok:false,reason:auth.reason};
 if(membership.role!=='owner')return {ok:false,reason:'owner-required'};
 const available=resolveLaunchServiceAvailability({sessionClientId,accountClientId,serviceId,entitlement,globallyEnabled,now});
 if(!available.allowed)return {ok:false,reason:available.reason};
 let report;
 try{
  if(kind==='revenue-integrity')report=reconcileRevenue({...input,tenantId:accountClientId});
  else if(kind==='release-assurance')report=assessRelease(input);
  else return {ok:false,reason:'unsupported-report'};
 }catch{return {ok:false,reason:'invalid-report-evidence'};}
 const audit=prepareLaunchAuditEvent({tenantId:accountClientId,actorId:actor.id,serviceId,eventType:'report-prepared'});
 if(!audit.ok)return {ok:false,reason:'audit-envelope-unavailable'};
 return {ok:true,state:'prepared-not-delivered',kind,report,auditEvent:audit.event,auditPersisted:false,
  requiresAuditPersistence:true,customerDeliveryAuthorized:false};
}
