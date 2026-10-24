import {authorizeLaunchPreview} from "./ai-visibility-launch-preview-authorization.mjs";
/**
 * Pure server integration boundary: caller supplies the ai_client cookie value,
 * the actual verifyClientToken function and an injected read-only db client.
 * Never accepts client identity from request JSON. No HTTP route is enabled.
 */
export async function authorizeLaunchFromClientCookie({cookieToken,verifyClientToken,serviceId,db,now}={}){
 if(typeof cookieToken!=="string"||!cookieToken||typeof verifyClientToken!=="function"){
  return {allowed:false,reason:"missing-client-authentication"};
 }
 let signedSession;
 try{signedSession=await verifyClientToken(cookieToken)}catch{
  return {allowed:false,reason:"invalid-client-session"};
 }
 if(!signedSession||typeof signedSession.clientId!=="string"||!signedSession.clientId){
  return {allowed:false,reason:"invalid-client-session"};
 }
 return authorizeLaunchPreview({
  verifiedSession:{verified:true,kind:"client",clientId:signedSession.clientId,subjectClientId:signedSession.clientId},
  serviceId,db,now
 });
}
