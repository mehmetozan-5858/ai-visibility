import {verifyClientToken} from './admin-auth.js';

// REVIEW ONLY: this helper is not connected to a production route.
// It binds a verified signed client session to a *transaction-local* tenant
// setting on a single acquired connection. SQL session settings alone are
// NOT an identity boundary against a compromised SQL client.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function withVerifiedClientTenantRead(pool,token,read,verify=verifyClientToken){
 if(!pool||typeof pool.connect!=='function'||typeof read!=='function')
  throw Error('tenant-reader-unavailable');
 // The tenant identifier MUST come only from the server-side signature check;
 // never from a query/body/header or a caller-supplied clientId.
 const session=await verify(token);
 if(!session||typeof session.clientId!=='string'||!UUID.test(session.clientId))
  throw Error('tenant-session-invalid');
 const tx=await pool.connect();
 let started=false;
 try{
  await tx.query('BEGIN READ ONLY');started=true;
  await tx.query("SELECT set_config('app.tenant_id',$1,true)",[session.clientId]);
  const result=await read(tx,session.clientId);
  await tx.query('COMMIT');started=false;
  return result;
 }catch(err){
  if(started)await tx.query('ROLLBACK').catch(()=>{});
  throw err;
 }finally{
  tx.release();
 }
}
