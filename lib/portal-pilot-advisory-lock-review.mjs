/**
 * REVIEW ONLY. Alternative to FOR SHARE when the SECURITY DEFINER function
 * owner has SELECT-only permissions and cannot lock a row without UPDATE.
 *
 * This helper is not connected to any live grant/revoke/report endpoint.
 * Every entitlement writer (grant, revoke, expiry adjustment, suspension,
 * delete, admin SQL, migration) MUST participate in identical keying/order
 * before this alternative can be used to protect customer access.
 * Advisory locks are cooperative, not row-level security controls.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PILOT_LOCK_SQL=`SELECT pg_catalog.pg_advisory_xact_lock(
 pg_catalog.hashtextextended('portal-pilot-lock-v1:'||$1::uuid::text,0))`;
export const REPORT_LOCK_SQL=`PERFORM pg_catalog.pg_advisory_xact_lock(
 pg_catalog.hashtextextended('portal-pilot-lock-v1:'||p_tenant::text,0));`;

export async function acquirePilotAdvisoryLockReview(tx,tenantId){
 if(!tx||typeof tx.query!=='function'||typeof tenantId!=='string'||!UUID.test(tenantId))
  throw Error('pilot-lock-unavailable');
 const normalized=tenantId.toLowerCase();
 // Only call inside a pre-started transaction, using its pinned connection.
 // Caller must COMMIT/ROLLBACK; on error it MUST fail closed.
 await tx.query(PILOT_LOCK_SQL,[normalized]);
 return normalized;
}

/**
 * REVIEW ONLY: a trusted, server-only pilot writer transaction.
 * The callback is an internal repository operation and MUST NOT be passed
 * from HTTP input. Both grant and revoke must operate using this same
 * acquired connection, and the report RPC must take the matching lock.
 * A transaction-local lock is automatically released at COMMIT/ROLLBACK.
 */
export async function withPilotWriteLockReview(pool,tenantId,write){
 if(!pool||typeof pool.connect!=='function'||typeof write!=='function')
  throw Error('pilot-writer-transaction-unavailable');
 if(typeof tenantId!=='string'||!UUID.test(tenantId))
  throw Error('pilot-writer-tenant-invalid');
 const tx=await pool.connect();
 if(!tx||typeof tx.query!=='function'||typeof tx.release!=='function'){
  tx?.release?.();
  throw Error('pilot-writer-connection-invalid');
 }
 let begun=false;
 try{
  await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  begun=true;
  await tx.query("SET LOCAL lock_timeout = '2500ms'");
  await tx.query("SET LOCAL statement_timeout = '10000ms'");
  const tenant=await acquirePilotAdvisoryLockReview(tx,tenantId);
  const result=await write(tx,tenant);
  await tx.query('COMMIT');
  begun=false;
  return result;
 }catch(err){
  if(begun)await tx.query('ROLLBACK').catch(()=>{});
  throw err;
 }finally{
  tx.release();
 }
}
