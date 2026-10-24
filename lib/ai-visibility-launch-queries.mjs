/**
 * Read-only SQL query builder for launch entitlement checks.
 * Caller must derive clientId from a verified server session.
 * No database connection or side effects are created here.
 */
const services=new Set(["agent-audit-control","agent-commerce-intelligence","candidate-rediscovery","voice-revenue-agent"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function buildLaunchEntitlementQuery({clientId,serviceId}={}){
 if(typeof clientId!=="string"||!uuid.test(clientId))return {ok:false,reason:"invalid-client-id"};
 if(!services.has(serviceId))return {ok:false,reason:"unknown-service"};
 return {ok:true,text:`SELECT client_id,service_id,status,valid_from,expires_at,revoked_at,consent_verified_at
 FROM ai_visibility_launch_entitlements
 WHERE client_id=$1::uuid AND service_id=$2 AND status='active'
 AND valid_from<=NOW() AND (expires_at IS NULL OR expires_at>NOW())
 AND revoked_at IS NULL LIMIT 1`,values:[clientId,serviceId],readOnly:true};
}
