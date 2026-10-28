/**
 * Read-only PostgreSQL bridge for the four staged AI Visibility launch services.
 * No HTTP handler, execution, audit persistence, billing or provider call.
 * verifiedSession MUST be constructed only after server-side token verification;
 * never pass an untrusted request body as the session or flags.
 */
import {prepareAuthorizedLaunchPlan} from "./ai-visibility-launch-authorized-plan.mjs";
import {authorizeLaunchAction} from "./ai-visibility-launch-access.mjs";
import {LAUNCH_SERVICES} from "./ai-visibility-launch-services.mjs";

const validId=value=>typeof value==="string" &&
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
const asIso=value=>value instanceof Date?value.toISOString():value;

export async function prepareStoredLaunchPlan({
  pool,verifiedSession,accountClientId,serviceId,capability,
  featureEnabled=false,globallyEnabled=false,now=Date.now(),
}={}) {
  const tenantId=verifiedSession?.clientId;
  // Never infer the actor from a tenant-only customer token: that can impersonate
  // the tenant owner when the future HTTP integration omits actor identity.
  const actorId=verifiedSession?.actorId;
  if(verifiedSession?.verified!==true || !validId(tenantId) || !validId(actorId))
    return {ok:false,reason:"unauthenticated"};
  if(!validId(accountClientId) || accountClientId!==tenantId)
    return {ok:false,reason:"account-session-mismatch"};
  if(featureEnabled!==true)return {ok:false,reason:"feature-disabled"};
  if(globallyEnabled!==true)return {ok:false,reason:"service-disabled"};
  const service=LAUNCH_SERVICES.find(item=>item.id===serviceId);
  if(!service)return {ok:false,reason:"unknown-service"};
  // Reject unsupported or malformed capabilities before acquiring a DB connection.
  // This keeps future HTTP integrations from spending pooled connections on
  // requests that cannot ever produce an authorized plan.
  if(!service.capabilities.includes(capability))
    return {ok:false,reason:"unsupported-capability"};
  if(!pool || typeof pool.connect!=="function")
    return {ok:false,reason:"database-unavailable"};

  let client;
  let result;
  let discardConnection=false;
  try{
    client=await pool.connect();
    // One consistent, read-only snapshot for membership and grant.
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const member=(await client.query(
      "SELECT role,enabled FROM arge_memberships WHERE tenant_id=$1 AND actor_id=$2",
      [tenantId,actorId])).rows[0];
    const membership=member?{actorId,tenantId,role:member.role,verified:member.enabled===true}:undefined;
    // Do not even read a service grant until the stored actor membership and
    // role have passed authorization. Keep the same read-only snapshot.
    const access=authorizeLaunchAction({
      actor:{id:actorId,authenticated:true},membership,
      resourceTenantId:tenantId,action:"agent:plan",featureEnabled,
    });
    if(access.allowed!==true){
      result={ok:false,reason:access.reason};
    }else if(service.access==="tenant-owner" && membership.role!=="owner"){
      result={ok:false,reason:"owner-required"};
    }else{
      const grant=(await client.query(
        'SELECT status,revoked,expires_at AS "expiresAt",not_before AS "notBefore",'+
        'consent_verified AS "consentVerified",consent_revoked AS "consentRevoked" '+
        "FROM arge_entitlements WHERE tenant_id=$1 AND service_id=$2",
        [tenantId,serviceId])).rows[0];
      // SQL NULL is absence, not an ISO timestamp. Do not carry null through
      // the spread: the strict entitlement policy correctly rejects it.
      const {notBefore,...persistedGrant}=grant??{};
      const entitlement=grant?{
        ...persistedGrant,source:"server",clientId:tenantId,serviceId,
        expiresAt:asIso(grant.expiresAt),
        ...(notBefore==null?{}:{notBefore:asIso(notBefore)}),
      }:undefined;
      const plan=prepareAuthorizedLaunchPlan({
        actor:{id:actorId,authenticated:true},
        membership,
        sessionClientId:tenantId,accountClientId,serviceId,capability,entitlement,
        featureEnabled,globallyEnabled,now,
      });
  
      result=plan;
    }
    await client.query("COMMIT");
  }catch{
    if(client){
      try{await client.query("ROLLBACK");}
      catch{
        // A failed rollback leaves the transaction state unknown. Never return
        // that connection to the pool for another tenant request.
        discardConnection=true;
      }
    }
    result={ok:false,reason:"database-unavailable"};
  }finally{
    // A failed release must not turn a prepared plan into a reported success.
    // pg release() is normally synchronous; await also handles test doubles.
    if(client){
      try{await client.release(discardConnection ? true : undefined);}
      catch{result={ok:false,reason:"database-unavailable"};}
    }
  }
  return result;
}
