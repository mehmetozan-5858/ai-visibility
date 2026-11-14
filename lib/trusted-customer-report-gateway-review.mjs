import {verifyClientToken} from './admin-auth.js';
import {comparisonReportRows} from './customer-comparison-report.mjs';
import {inspectTrustedReportReaderRole} from './trusted-report-reader-privileges-review.mjs';

// REVIEW ONLY. This gateway does NOT grant portal access or switch on any
// production feature. Only a server-side caller holding the verified cookie
// token may call it. The reader connection must never be available to browser
// clients, plugins, user-authored SQL, or arbitrary callbacks.
// A stolen SQL credential could still SELECT other rows: this is NOT a DB
// authorization boundary against a compromised gateway/credential.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_SQL='SELECT client_id AS "clientId",query,results,created_at AS "createdAt" FROM public.ai_provider_comparisons WHERE client_id=$1 ORDER BY created_at DESC LIMIT 20';

export async function readTrustedCustomerReportReview(pool,signedCookieToken,entitlementReady){
 if(!pool||typeof pool.connect!=='function')throw Error('report-reader-unavailable');
 // No client-supplied tenant ID is allowed. The session is authenticated by the
 // existing server verification code, before executing any DB query.
 const session=await verifyClientToken(signedCookieToken);
 if(!session||typeof session.clientId!=='string'||!UUID.test(session.clientId))
  throw Error('verified-customer-session-required');
 if(entitlementReady!==true)throw Error('verified-customer-entitlement-required');
 // A pool may route successive pool.query calls to different SQL logins.
 // Pin the permission probe and actual customer SELECT to one acquired
 // connection and one read-only transaction; never trust an earlier probe.
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();
  throw Error('report-reader-connection-invalid');
 }
 let started=false;
 try{
  await tx.query('BEGIN READ ONLY');started=true;
  const role=await inspectTrustedReportReaderRole(tx,process.env.PORTAL_REPORT_READER_ROLE);
  if(!role.ready)throw Error('trusted-report-reader-role-unverified');
  const result=await tx.query(REPORT_SQL,[session.clientId]);
  if(!result||!Array.isArray(result.rows))throw Error('report-query-unavailable');
  const report=comparisonReportRows(result.rows,session.clientId);
  await tx.query('COMMIT');started=false;
  return report;
 }catch(error){
  if(started)await tx.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{tx.release()}
}
