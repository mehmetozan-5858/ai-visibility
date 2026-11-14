/**
 * Review-only attestation of a distinct, narrowly scoped report SQL login.
 * It protects against accidental use of the owner/writer or credential account,
 * NOT against a stolen reader SQL login issuing its own cross-tenant queries.
 */
const ROLE=/^portal_gateway_reader_[a-z0-9_]+$/;
export function evaluateTrustedReportReaderRole(role,expected){
 if(!role||!ROLE.test(String(expected||''))||role.name!==expected||
    role.login!==true||role.superuser!==false||role.bypassRls!==false||
    role.createDb!==false||role.createRole!==false||role.replication!==false||
    role.schemaUsage!==true||role.schemaCreate!==false||
    role.comparisonSelect!==true||role.comparisonInsert!==false||
    role.comparisonUpdate!==false||role.comparisonDelete!==false||
    role.credentialSelect!==false||role.paymentSelect!==false||
    role.settlementSelect!==false)
  return {ready:false,reason:'trusted-report-reader-role-unverified'};
 return {ready:true,reason:'narrow-report-reader-role-present'};
}
export async function inspectTrustedReportReaderRole(pool,expected){
 const denied={ready:false,reason:'trusted-report-reader-inspection-unavailable'};
 if(!pool||typeof pool.query!=='function')return denied;
 if(!ROLE.test(String(expected||'')))return {ready:false,reason:'trusted-report-reader-name-unconfigured'};
 try{
  const result=await pool.query(`SELECT current_user AS "name",
   r.rolcanlogin AS login,r.rolsuper AS superuser,
   r.rolbypassrls AS "bypassRls",r.rolcreatedb AS "createDb",
   r.rolcreaterole AS "createRole",r.rolreplication AS replication,
   has_schema_privilege(current_user,'public','USAGE') AS "schemaUsage",
   has_schema_privilege(current_user,'public','CREATE') AS "schemaCreate",
   has_table_privilege(current_user,'public.ai_provider_comparisons','SELECT') AS "comparisonSelect",
   has_table_privilege(current_user,'public.ai_provider_comparisons','INSERT') AS "comparisonInsert",
   has_table_privilege(current_user,'public.ai_provider_comparisons','UPDATE') AS "comparisonUpdate",
   has_table_privilege(current_user,'public.ai_provider_comparisons','DELETE') AS "comparisonDelete",
   has_table_privilege(current_user,'public.client_credentials','SELECT') AS "credentialSelect",
   has_table_privilege(current_user,'public.payments','SELECT') AS "paymentSelect",
   has_table_privilege(current_user,'public.verified_customer_settlements','SELECT') AS "settlementSelect"
   FROM pg_roles r WHERE r.rolname=current_user`);
  return evaluateTrustedReportReaderRole(result.rows?.[0],expected);
 }catch{return denied}
}
