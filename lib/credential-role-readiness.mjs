/**
 * Review-only, SELECT-only credential verifier role readiness.
 * This is deliberately NOT connected to client login or deployed settings.
 * It checks permissions on the current authenticated SQL connection;
 * it never reads password hashes or mutates privileges.
 */
const EXPECTED_READER_TABLES=['clients','scans','client_activity','work_items','payments','client_profiles','client_pilot_access','findings','ai_provider_comparisons','verified_customer_settlements'];
const ROLE=/^[a-z][a-z0-9_]*$/;

export function evaluateCredentialReaderPrivileges(value){
 if(!value||typeof value!=='object'||!ROLE.test(String(value.role||'')))
  return {ready:false,reason:'credential-role-unverified'};
 if(value.canLogin!==true||value.superuser!==false||value.bypassRls!==false||
  value.schemaUsage!==true||value.canCreateSchema!==false)
  return {ready:false,reason:'credential-role-elevated-or-unverified'};
 const hash=value.credentialTable;
 if(!hash||hash.select!==true||hash.insert!==false||hash.update!==false||
  hash.delete!==false||hash.truncate!==false||hash.references!==false||hash.trigger!==false)
  return {ready:false,reason:'credential-table-privilege-unverified'};
 if(!Array.isArray(value.otherTables)||value.otherTables.length!==EXPECTED_READER_TABLES.length)
  return {ready:false,reason:'credential-isolation-unverified'};
 const seen=new Set();
 for(const table of value.otherTables){
  if(!table||!EXPECTED_READER_TABLES.includes(table.table)||seen.has(table.table)||
   table.select!==false||table.insert!==false||table.update!==false||
   table.delete!==false||table.truncate!==false||
   table.references!==false||table.trigger!==false)
   return {ready:false,reason:'credential-isolation-unverified'};
  seen.add(table.table);
 }
 return {ready:true,reason:'isolated-credential-role-pass'};
}

export async function inspectCredentialReaderPrivileges(pool){
 const denied={ready:false,reason:'credential-role-inspection-unavailable'};
 if(!pool||typeof pool.query!=='function')return denied;
 try{
  const r=await pool.query(`SELECT current_user AS role,
    p.rolcanlogin AS "canLogin",p.rolsuper AS superuser,
    p.rolbypassrls AS "bypassRls",
    has_schema_privilege(current_user,'public','USAGE') AS "schemaUsage",
    has_schema_privilege(current_user,'public','CREATE') AS "canCreateSchema"
    FROM pg_roles p WHERE p.rolname=current_user`);
  if(r.rows?.length!==1)return denied;
  const tables=await pool.query(`SELECT t.name AS "table",
    has_table_privilege(current_user,format('public.%I',t.name),'SELECT') AS "select",
    has_table_privilege(current_user,format('public.%I',t.name),'INSERT') AS "insert",
    has_table_privilege(current_user,format('public.%I',t.name),'UPDATE') AS "update",
    has_table_privilege(current_user,format('public.%I',t.name),'DELETE') AS "delete",
    has_table_privilege(current_user,format('public.%I',t.name),'TRUNCATE') AS "truncate",
    has_table_privilege(current_user,format('public.%I',t.name),'REFERENCES') AS "references",
    has_table_privilege(current_user,format('public.%I',t.name),'TRIGGER') AS "trigger"
    FROM unnest($1::text[]) AS t(name)`,
   [['client_credentials',...EXPECTED_READER_TABLES]]);
  const hashes=tables.rows?.filter(t=>t.table==='client_credentials')||[];
  return evaluateCredentialReaderPrivileges({...r.rows[0],credentialTable:hashes.length===1?hashes[0]:null,
    otherTables:tables.rows?.filter(t=>t.table!=='client_credentials')});
 }catch{return denied}
}
