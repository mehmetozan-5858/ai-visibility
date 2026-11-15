/** REVIEW ONLY — explicit authorized/empty report envelope contract.
 * Do not wire the existing row-only RPC into this parser. That RPC cannot
 * distinguish an authorized empty report from a denied claim.
 * The future SQL RPC must return exactly ONE envelope after successful
 * signature, tenant, entitlement, nonce and lock validation.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function decodeAuthorizedReportEnvelopeReview(rows,expectedTenant){
 if(typeof expectedTenant!=='string'||!UUID.test(expectedTenant))
  throw Error('report-envelope-tenant-invalid');
 if(!Array.isArray(rows)||rows.length!==1)
  throw Error('report-envelope-authorization-unproven');
 const envelope=rows[0];
 if(!envelope||envelope.authorized!==true||
    typeof envelope.tenantId!=='string'||
    envelope.tenantId.toLowerCase()!==expectedTenant.toLowerCase()||
    !Array.isArray(envelope.reports)||envelope.reports.length>20)
  throw Error('report-envelope-authorization-unproven');
 for(const item of envelope.reports){
  if(!item||typeof item!=='object'||Array.isArray(item)||
     typeof item.clientId!=='string'||
     item.clientId.toLowerCase()!==expectedTenant.toLowerCase())
   throw Error('report-envelope-cross-tenant-denied');
 }
 return {authorized:true,reports:envelope.reports};
}
