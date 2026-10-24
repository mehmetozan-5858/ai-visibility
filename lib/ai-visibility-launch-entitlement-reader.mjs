import {buildLaunchEntitlementQuery} from "./ai-visibility-launch-queries.mjs";
/**
 * Read-only service access evaluation. db.query must be injected by trusted
 * server code, never by an untrusted request. Does not initialize schemas.
 */
export async function readLaunchServiceEntitlement({session,serviceId,db,now=new Date()}={}){
 const clientId=session?.clientId;
 const statement=buildLaunchEntitlementQuery({clientId,serviceId});
 if(!statement.ok)return {allowed:false,reason:statement.reason};
 if(typeof db?.query!=="function")return {allowed:false,reason:"database-unavailable"};
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))return {allowed:false,reason:"invalid-time"};
 try{
  const result=await db.query(statement.text,statement.values);
  const rows=result?.rows;
  if(!Array.isArray(rows)||rows.length!==1)return {allowed:false,reason:"entitlement-not-found"};
  const row=rows[0];
  if(row.client_id!==clientId||row.service_id!==serviceId||row.status!=="active"||row.revoked_at!=null)return {allowed:false,reason:"entitlement-mismatch"};
  const start=row.valid_from==null?NaN:new Date(row.valid_from).getTime();
  const end=row.expires_at==null?Infinity:new Date(row.expires_at).getTime();
  if(!Number.isFinite(start)||!(end===Infinity||Number.isFinite(end))||start>now.getTime()||end<=now.getTime())return {allowed:false,reason:"entitlement-expired"};
  if(["candidate-rediscovery","voice-revenue-agent"].includes(serviceId)){
   // Date(null) becomes the Unix epoch; absent consent must never authorize.
   const consent=row.consent_verified_at==null?NaN:new Date(row.consent_verified_at).getTime();
   if(!Number.isFinite(consent)||consent>now.getTime())return {allowed:false,reason:"consent-required"};
  }
  return {allowed:true,reason:"active-entitlement",serviceId,clientId};
 }catch{return {allowed:false,reason:"entitlement-query-failed"}}
}
