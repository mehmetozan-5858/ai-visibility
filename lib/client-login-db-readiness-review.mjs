// REVIEW ONLY — inspect login prerequisites without passwords, emails,
// customer rows, migrations, schema changes, session creation or payments.
// A passing result is a database READINESS probe, not successful login.
const QUERY=`SELECT current_user AS role,
 to_regclass('public.client_credentials') IS NOT NULL AS "tableExists",
 CASE WHEN to_regclass('public.client_credentials') IS NOT NULL
  THEN has_table_privilege(current_user,'public.client_credentials','SELECT')
  ELSE false END AS "canSelectCredential",
 has_schema_privilege(current_user,'public','USAGE') AS "schemaUsage",
 has_schema_privilege(current_user,'public','CREATE') AS "schemaCreate",
 r.rolsuper AS superuser,r.rolbypassrls AS "bypassRls",
 r.rolcreatedb AS "createDatabase",r.rolcreaterole AS "createRole"
 FROM pg_roles r WHERE r.rolname=current_user`;
export async function inspectLoginReadinessReview(pool){
 const denied={ready:false,reason:'login-reader-inspection-unavailable'};
 if(!pool||typeof pool.query!=='function')return denied;
 try{
  const rows=(await pool.query(QUERY)).rows;
  if(!Array.isArray(rows)||rows.length!==1)return denied;
  const r=rows[0];
  if(r.tableExists!==true)return {ready:false,reason:'credential-table-missing'};
  if(r.schemaUsage!==true||r.canSelectCredential!==true)
   return {ready:false,reason:'credential-select-unavailable'};
  if(r.superuser!==false||r.bypassRls!==false||r.createDatabase!==false||
     r.createRole!==false||r.schemaCreate!==false)
   return {ready:false,reason:'login-role-too-privileged'};
  return {ready:true,reason:'credential-select-only-ready'};
 }catch{return denied}
}
