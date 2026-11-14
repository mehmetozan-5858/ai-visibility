/**
 * Review-only, read-only PostgreSQL permission probe.
 * The caller must provide an already authenticated server-side pool.
 * It neither selects customer rows nor changes role, schema or privileges.
 * A passing probe is not proof of which DATABASE_URL a deployed app uses.
 */
const REQUIRED=['clients','scans','client_activity','work_items','payments','client_profiles','client_pilot_access','findings'];
const IDENTIFIER=/^[a-z][a-z0-9_]*$/;
export const portalReaderRequiredTables=Object.freeze([...REQUIRED]);

export function evaluatePortalReaderPrivileges(data){
 if(!data||typeof data!=='object'||!IDENTIFIER.test(String(data.role||'')))
  return {ready:false,reason:'role-unverified'};
 if(data.canLogin!==true||data.superuser!==false||data.bypassRls!==false||
    data.canCreateSchema!==false||data.schemaUsage!==true)
  return {ready:false,reason:'role-privilege-unverified'};
 if(!Array.isArray(data.tables)||data.tables.length!==REQUIRED.length)
  return {ready:false,reason:'table-scope-unverified'};
 const seen=new Set();
 for(const item of data.tables){
  if(!item||!REQUIRED.includes(item.table)||seen.has(item.table))
   return {ready:false,reason:'table-scope-unverified'};
  seen.add(item.table);
  if(item.select!==true||item.insert!==false||item.update!==false||
     item.delete!==false||item.truncate!==false||item.references!==false||
     item.trigger!==false)
   return {ready:false,reason:'table-privilege-unverified'};
 }
 if(data.credentialsSelect!==false)
  return {ready:false,reason:'credential-hash-access-unverified'};
 return {ready:true,reason:'isolated-role-permissions-pass'};
}

export async function inspectPortalReaderPrivileges(pool){
 const denied={ready:false,reason:'role-inspection-unavailable'};
 if(!pool||typeof pool.query!=='function')return denied;
 try{
  const meta=await pool.query(`SELECT current_user AS role,
   r.rolcanlogin AS "canLogin",
   r.rolsuper AS superuser,
   r.rolbypassrls AS "bypassRls",
   has_schema_privilege(current_user,'public','USAGE') AS "schemaUsage",
   has_schema_privilege(current_user,'public','CREATE') AS "canCreateSchema",
   has_table_privilege(current_user,'public.client_credentials','SELECT') AS "credentialsSelect"
   FROM pg_roles r WHERE r.rolname=current_user`);
  if(meta.rows?.length!==1)return denied;
  const grants=await pool.query(`SELECT t.name AS "table",
    has_table_privilege(current_user,format('public.%I',t.name),'SELECT') AS "select",
    has_table_privilege(current_user,format('public.%I',t.name),'INSERT') AS "insert",
    has_table_privilege(current_user,format('public.%I',t.name),'UPDATE') AS "update",
    has_table_privilege(current_user,format('public.%I',t.name),'DELETE') AS "delete",
    has_table_privilege(current_user,format('public.%I',t.name),'TRUNCATE') AS "truncate",
    has_table_privilege(current_user,format('public.%I',t.name),'REFERENCES') AS "references",
    has_table_privilege(current_user,format('public.%I',t.name),'TRIGGER') AS "trigger"
   FROM unnest($1::text[]) t(name)`,[REQUIRED]);
  return evaluatePortalReaderPrivileges({...meta.rows[0],tables:grants.rows});
 }catch{return denied}
}
