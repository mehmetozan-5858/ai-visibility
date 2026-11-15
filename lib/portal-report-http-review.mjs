// REVIEW ONLY — pure HTTP response adapter, not imported by a live route.
// Never expose entitlement, raw SQL errors, signing keys or cross-tenant data.
// A real route must only inject trusted server-created gateway and signed cookie.
const privateHeaders={
 'Cache-Control':'private, no-store, max-age=0',
 'Pragma':'no-cache',
 'Vary':'Cookie, Accept-Language',
 'Content-Type':'application/json; charset=utf-8'
};
const response=(status,body)=>new Response(JSON.stringify(body),{
 status,headers:privateHeaders
});
export function createPortalReportHttpReview(gateway){
 if(typeof gateway!=='function')throw Error('review-http-gateway-unavailable');
 return async function getReportReview(cookie){
  if(typeof cookie!=='string'||cookie.length===0)
   return response(401,{error:'customer-session-required'});
  try{
   const rows=await gateway(cookie);
   if(!Array.isArray(rows))throw Error('review-http-invalid-report-shape');
   return response(200,{authorized:true,evidenceClass:'historical',verifiedProviderEvidence:false,reports:rows});
  }catch(error){
   const code=error?.message;
   if(code==='review-envelope-customer-session-required')
    return response(401,{error:'customer-session-required'});
   if(code==='review-envelope-entitlement-denied')
    return response(403,{error:'verified-pilot-entitlement-required'});
   // Role, SQL, signed claims, locks, revoked-after-preflight and all
   // unknown errors fail closed WITHOUT echoing their details to the client.
   return response(503,{error:'verified-report-unavailable'});
  }
 };
}
