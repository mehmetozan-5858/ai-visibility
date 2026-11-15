import {verifyClientToken} from './admin-auth.js';
import {signOneTimeReportClaim} from './one-time-db-report-review.mjs';
import {decodeAuthorizedReportEnvelopeReview} from './portal-explicit-report-envelope-review.mjs';

// REVIEW ONLY — no HTTP routing, Neon credential, role creation or deployment.
// The post-lock SQL RPC is authoritative for current tenant entitlement;
// the independent server-side preflight is an additional early-denial gate.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE=/^portal_gateway_reader_[a-z0-9_]+$/;
const ROLE_PROBE=`SELECT current_user AS "name",r.rolcanlogin AS login,
 r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",
 r.rolcreatedb AS "createDb",r.rolcreaterole AS "createRole",
 r.rolreplication AS replication,
 has_schema_privilege(current_user,'public','USAGE') AS "schemaUsage",
 has_schema_privilege(current_user,'public','CREATE') AS "schemaCreate",
 has_function_privilege(current_user,
 'public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)',
 'EXECUTE') AS "envelopeExecute",
 has_table_privilege(current_user,'public.ai_provider_comparisons','SELECT') AS "rawSelect",
 has_table_privilege(current_user,'public.client_credentials','SELECT') AS "credentialSelect",
 has_table_privilege(current_user,'public.payments','SELECT') AS "paymentSelect",
 has_table_privilege(current_user,'public.verified_customer_settlements','SELECT') AS "settlementSelect",
 has_schema_privilege(current_user,'portal_authz','USAGE') AS "privateSchemaUsage"
 FROM pg_roles r WHERE r.rolname=current_user`;
const RPC='SELECT "authorized","tenantId","reports" FROM public.portal_verified_one_time_envelope_review($1::uuid,$2::bigint,$3::uuid,$4::text)';

export function isEnvelopeReaderRoleReview(row,expected){
 return Boolean(row&&ROLE.test(expected||'')&&row.name===expected&&
  row.login===true&&row.superuser===false&&row.bypassRls===false&&
  row.createDb===false&&row.createRole===false&&row.replication===false&&
  row.schemaUsage===true&&row.schemaCreate===false&&
  row.envelopeExecute===true&&row.rawSelect===false&&
  row.credentialSelect===false&&row.paymentSelect===false&&
  row.settlementSelect===false&&row.privateSchemaUsage===false);
}

export function createEnvelopeGatewayReview({reportPool,entitlementAuthority}={}){
 if(!reportPool||typeof reportPool.connect!=='function'||
    typeof entitlementAuthority!=='function')
  throw Error('review-envelope-gateway-unavailable');
 // Trusted caller supplies pools and authority at initialization, NOT via HTTP.
 return async function readEnvelopeFromVerifiedSession(signedCookie){
  const session=await verifyClientToken(signedCookie);
  if(!session||!UUID.test(String(session.clientId||'')))
   throw Error('review-envelope-customer-session-required');
  const tenant=session.clientId.toLowerCase();
  let proof;
  try{proof=await entitlementAuthority(tenant)}
  catch{throw Error('review-envelope-entitlement-denied')}
  if(!proof||proof.active!==true||proof.source!=='verified-pilot'||
     proof.tenantId?.toLowerCase()!==tenant||
     !Number.isSafeInteger(proof.checkedAt)||
     proof.checkedAt>Date.now()||Date.now()-proof.checkedAt>5000)
   throw Error('review-envelope-entitlement-denied');
  const secret=process.env.PORTAL_REPORT_CLAIM_SECRET;
  const expected=process.env.PORTAL_REPORT_READER_ROLE;
  if(typeof secret!=='string'||secret.length<32||
     secret===process.env.AUTH_SECRET||!ROLE.test(expected||''))
   throw Error('review-envelope-signing-unavailable');
  const claim=await signOneTimeReportClaim(tenant,secret);
  const tx=await reportPool.connect();
  if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
   tx?.release?.();
   throw Error('review-envelope-connection-invalid');
  }
  let begun=false;
  try{
   await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
   await tx.query("SET LOCAL lock_timeout = '2500ms'");
   await tx.query("SET LOCAL statement_timeout = '10000ms'");
   const row=(await tx.query(ROLE_PROBE)).rows?.[0];
   if(!isEnvelopeReaderRoleReview(row,expected))
    throw Error('review-envelope-role-unverified');
   const result=await tx.query(RPC,[claim.tenant,claim.expires,claim.claimId,claim.mac]);
   const report=decodeAuthorizedReportEnvelopeReview(result?.rows,tenant);
   await tx.query('COMMIT');begun=false;
   return report.reports;
  }catch(error){
   if(begun)await tx.query('ROLLBACK').catch(()=>{});
   throw error;
  }finally{tx.release()}
 };
}
