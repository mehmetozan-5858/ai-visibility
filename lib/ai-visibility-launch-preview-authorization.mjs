import {readLaunchServiceEntitlement} from "./ai-visibility-launch-entitlement-reader.mjs";
/**
 * Server-only access boundary for the launch services.
 * verifiedSession must be obtained by the caller from a trusted signed session
 * verifier, never from a JSON request body or query string.
 * This module performs no writes, external calls, or schema initialization.
 */
export async function authorizeLaunchPreview({verifiedSession,serviceId,db,now}={}){
 if(!verifiedSession||verifiedSession.verified!==true||verifiedSession.kind!=="client"){
  return {allowed:false,reason:"unverified-client-session"};
 }
 if(verifiedSession.clientId!==verifiedSession.subjectClientId){
  return {allowed:false,reason:"session-tenant-mismatch"};
 }
 const result=await readLaunchServiceEntitlement({session:{clientId:verifiedSession.clientId},serviceId,db,now});
 return result.allowed?{allowed:true,clientId:result.clientId,serviceId:result.serviceId}:{allowed:false,reason:result.reason};
}
