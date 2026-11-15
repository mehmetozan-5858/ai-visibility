import {randomUUID} from 'node:crypto';
import {verifyClientToken} from './admin-auth.js';
import {comparisonReportRows} from './customer-comparison-report.mjs';

// REVIEW ONLY — this code is not wired to a live HTTP route.
// The isolated Neon function consumes a one-time claim (a bounded DB write).
// Never reuse AUTH_SECRET; the dedicated signing key belongs in a trusted
// server and private DB verifier, never a browser, SQL reader, or source code.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE=/^portal_gateway_reader_[a-z0-9_]+$/;
const encoder=new TextEncoder();
const PROBE=`SELECT current_user AS "name",r.rolcanlogin AS login,
 r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",
 r.rolcreatedb AS "createDb",r.rolcreaterole AS "createRole",
 r.rolreplication AS replication,
 has_schema_privilege(current_user,'public','USAGE') AS "schemaUsage",
 has_schema_privilege(current_user,'public','CREATE') AS "schemaCreate",
 has_table_privilege(current_user,'public.ai_provider_comparisons','SELECT') AS "rawSelect",
 has_table_privilege(current_user,'public.client_credentials','SELECT') AS "credentialSelect",
 has_table_privilege(current_user,'public.payments','SELECT') AS "paymentSelect",
 has_table_privilege(current_user,'public.verified_customer_settlements','SELECT') AS "settlementSelect",
 has_schema_privilege(current_user,'portal_authz_trial','USAGE') AS "privateSchemaUsage",
 has_function_privilege(current_user,'public.portal_trial_verified_report(uuid,bigint,text)','EXECUTE') AS "legacyReplayExecute",
 has_function_privilege(current_user,'public.portal_trial_one_time_report(uuid,bigint,uuid,text)','EXECUTE') AS "oneTimeExecute",
 has_table_privilege(current_user,'portal_authz_trial.consumed_claims','INSERT') AS "claimLedgerInsert",
 has_table_privilege(current_user,'portal_authz_trial.consumed_claims','SELECT') AS "claimLedgerSelect"
 FROM pg_roles r WHERE r.rolname=current_user`;
const CALL='SELECT "clientId",query,results,"createdAt" FROM public.portal_trial_one_time_report($1::uuid,$2::bigint,$3::uuid,$4::text)';

export function isOneTimeReportReader(v,expected){
 return Boolean(v&&ROLE.test(String(expected||''))&&v.name===expected&&
  v.login===true&&v.superuser===false&&v.bypassRls===false&&
  v.createDb===false&&v.createRole===false&&v.replication===false&&
  v.schemaUsage===true&&v.schemaCreate===false&&v.rawSelect===false&&
  v.credentialSelect===false&&v.paymentSelect===false&&v.settlementSelect===false&&
  v.privateSchemaUsage===false&&v.legacyReplayExecute===false&&
  v.oneTimeExecute===true&&v.claimLedgerInsert===false&&v.claimLedgerSelect===false);
}

export async function signOneTimeReportClaim(tenant,secret,at=Math.floor(Date.now()/1000),nonce=randomUUID()){
 if(typeof tenant!=='string'||!UUID.test(tenant)||typeof secret!=='string'||
  secret.length<32||!Number.isSafeInteger(at)||at<1||!UUID.test(nonce))
  throw Error('one-time-claim-unavailable');
 const expires=at+90;
 const normalizedTenant=tenant.toLowerCase(),claimId=nonce.toLowerCase();
 const body=`portal-one-time-report-v1|${normalizedTenant}|${expires}|${claimId}`;
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(body)));
 return {tenant:normalizedTenant,expires,claimId,
  mac:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
}

// The callback MUST be a trusted server-side authority that re-reads current
// entitlement for this signed tenant (pilot not revoked/not expired, or verified
// signed settlement). Do not accept request-body fields as this callback.
export async function readOneTimeDbReportReview(pool,cookie,entitlementVerifier){
 if(!pool||typeof pool.connect!=='function')throw Error('one-time-reader-unavailable');
 const session=await verifyClientToken(cookie);
 if(!session||typeof session.clientId!=='string'||!UUID.test(session.clientId))
  throw Error('verified-customer-session-required');
 if(typeof entitlementVerifier!=='function')
  throw Error('verified-customer-entitlement-required');
 let proof;
 try{proof=await entitlementVerifier(session.clientId)}
 catch{throw Error('verified-customer-entitlement-required')}
 const checkedAt=proof?.checkedAt;
 const now=Date.now();
 if(!proof||proof.tenantId!==session.clientId||proof.active!==true||
  // The current one-time database RPC enforces pilot rows only; paid
  // entitlement needs a separate reviewed database-side authorization path.
  proof.source!=='verified-pilot'||
  !Number.isSafeInteger(checkedAt)||checkedAt>now||
  now-checkedAt>5000)
  throw Error('verified-customer-entitlement-required');
 const secret=process.env.PORTAL_REPORT_CLAIM_SECRET;
 const expected=process.env.PORTAL_REPORT_READER_ROLE;
 if(typeof secret!=='string'||secret.length<32||secret===process.env.AUTH_SECRET||
  !ROLE.test(String(expected||'')))throw Error('one-time-signing-not-configured');
 const claim=await signOneTimeReportClaim(session.clientId,secret);
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();throw Error('one-time-connection-invalid');
 }
 let begun=false;
 try{
  // A one-use nonce requires a DB INSERT inside the security-definer function.
  // READ ONLY would reject it. The login has EXECUTE only, no table writes.
  // Pilot-row FOR SHARE may wait behind an administrator's revocation.
  // Pin READ COMMITTED and bound waits; a timeout must roll back, not
  // fall through as a verified empty report.
  await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
  await tx.query("SET LOCAL lock_timeout = '2500ms'");
  await tx.query("SET LOCAL statement_timeout = '10000ms'");
  const role=await tx.query(PROBE);
  if(!isOneTimeReportReader(role.rows?.[0],expected))
   throw Error('one-time-reader-role-unverified');
  const result=await tx.query(CALL,[claim.tenant,claim.expires,claim.claimId,claim.mac]);
  if(!result||!Array.isArray(result.rows))throw Error('one-time-report-unavailable');
  // REVIEW-ONLY fail-closed boundary: this SQL function returns zero rows
  // both for a denied claim and for a valid tenant with no comparisons.
  // Without a separate explicit authorization verdict, never present an
  // ambiguous zero-row response as a successfully authorized report.
  if(result.rows.length===0)throw Error('one-time-report-authorization-unproven');
  const report=comparisonReportRows(result.rows,claim.tenant);
  await tx.query('COMMIT');begun=false;
  return report;
 }catch(error){
  if(begun)await tx.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{tx.release()}
}
