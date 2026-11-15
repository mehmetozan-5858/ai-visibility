import {verifyClientToken} from './admin-auth.js';
import {comparisonReportRows} from './customer-comparison-report.mjs';

// REVIEW ONLY: not wired to production routes. The DB function below exists
// only on an isolated Neon test branch. Never use AUTH_SECRET as the DB key.
// The browser never receives the SQL credential, claim, signing key or SQL API.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE=/^portal_gateway_reader_[a-z0-9_]+$/;
const ENCODER=new TextEncoder();
const ROLE_SQL=`SELECT current_user AS "name",r.rolcanlogin AS login,
 r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",
 r.rolcreatedb AS "createDb",r.rolcreaterole AS "createRole",
 r.rolreplication AS replication,
 has_schema_privilege(current_user,'public','USAGE') AS "schemaUsage",
 has_schema_privilege(current_user,'public','CREATE') AS "schemaCreate",
 has_table_privilege(current_user,'public.ai_provider_comparisons','SELECT') AS "rawSelect",
 has_table_privilege(current_user,'public.client_credentials','SELECT') AS "credentialSelect",
 has_table_privilege(current_user,'public.payments','SELECT') AS "paymentSelect",
 has_table_privilege(current_user,'public.verified_customer_settlements','SELECT') AS "settlementSelect",
 has_schema_privilege(current_user,'portal_authz_trial','USAGE') AS "secretSchemaUsage",
 has_function_privilege(current_user,'public.portal_trial_verified_report(uuid,bigint,text)','EXECUTE') AS "functionExecute"
 FROM pg_roles r WHERE r.rolname=current_user`;
const REPORT_SQL='SELECT "clientId",query,results,"createdAt" FROM public.portal_trial_verified_report($1::uuid,$2::bigint,$3::text)';

export function isNarrowSignedClaimReader(role,expected){
 return Boolean(role&&ROLE.test(String(expected||''))&&role.name===expected&&
  role.login===true&&role.superuser===false&&role.bypassRls===false&&
  role.createDb===false&&role.createRole===false&&role.replication===false&&
  role.schemaUsage===true&&role.schemaCreate===false&&
  role.rawSelect===false&&role.credentialSelect===false&&
  role.paymentSelect===false&&role.settlementSelect===false&&
  role.secretSchemaUsage===false&&role.functionExecute===true);
}

export async function signTrialReportClaim(tenant,secret,nowSeconds=Math.floor(Date.now()/1000)){
 if(typeof tenant!=='string'||!UUID.test(tenant)||typeof secret!=='string'||secret.length<32||
  !Number.isSafeInteger(nowSeconds)||nowSeconds<1)
  throw Error('trial-claim-signing-unavailable');
 // Matches the isolated test-branch PostgreSQL HMAC verifier exactly.
 const expires=nowSeconds+90;
 const payload=`portal-report-v1|${tenant.toLowerCase()}|${expires}`;
 const key=await crypto.subtle.importKey('raw',ENCODER.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,ENCODER.encode(payload)));
 const mac=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return {tenant:tenant.toLowerCase(),expires,mac};
}

export async function readSignedDbClaimReportReview(pool,signedCookieToken,entitlementReady){
 if(!pool||typeof pool.connect!=='function')throw Error('trial-report-reader-unavailable');
 const session=await verifyClientToken(signedCookieToken);
 if(!session||typeof session.clientId!=='string'||!UUID.test(session.clientId))
  throw Error('verified-customer-session-required');
 if(entitlementReady!==true)throw Error('verified-customer-entitlement-required');
 const secret=process.env.PORTAL_REPORT_CLAIM_SECRET;
 const expected=process.env.PORTAL_REPORT_READER_ROLE;
 if(typeof secret!=='string'||secret.length<32||secret===process.env.AUTH_SECRET||
  !ROLE.test(String(expected||'')))
  throw Error('trial-report-signing-not-configured');
 // Claim never accepted from an HTTP body/header, query string or caller UUID.
 const claim=await signTrialReportClaim(session.clientId,secret);
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();
  throw Error('trial-report-connection-invalid');
 }
 let begun=false;
 try{
  await tx.query('BEGIN READ ONLY');begun=true;
  const attestation=await tx.query(ROLE_SQL);
  if(!isNarrowSignedClaimReader(attestation.rows?.[0],expected))
   throw Error('trial-report-reader-role-unverified');
  const result=await tx.query(REPORT_SQL,[claim.tenant,claim.expires,claim.mac]);
  if(!result||!Array.isArray(result.rows))throw Error('trial-report-query-unavailable');
  const report=comparisonReportRows(result.rows,claim.tenant);
  await tx.query('COMMIT');begun=false;
  return report;
 }catch(err){
  if(begun)await tx.query('ROLLBACK').catch(()=>{});
  throw err;
 }finally{tx.release()}
}
