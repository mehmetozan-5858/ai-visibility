/**
 * REVIEW-ONLY structural RLS preflight for the opt-in customer report path.
 * No table writes, role changes, customer rows or credentials are read.
 * Passing structural checks cannot prove the SQL client cannot forge
 * app.tenant_id, nor substitute for signed-session E2E verification.
 */
export function evaluateComparisonRlsPolicy({table,policies}={}){
 if(!table||table.enabled!==true||table.forced!==true)
  return {ready:false,reason:'comparison-rls-not-enforced'};
 if(!Array.isArray(policies)||policies.length!==1)
  return {ready:false,reason:'comparison-policy-set-unverified'};
 const p=policies[0];
 if(p.policyname!=='portal_verified_tenant_comparison_select'||
    p.permissive!=='PERMISSIVE'||p.cmd!=='SELECT'||
    !Array.isArray(p.roles)||p.roles.length!==1||p.roles[0]!=='public')
  return {ready:false,reason:'comparison-policy-shape-unverified'};
 const q=String(p.qual||'').toLowerCase().replace(/\s+/g,'');
 // Allow only the reviewed tenant equality, not keyword matches in unrelated
 // boolean expressions. pg_get_expr may print extra grouping and ::text casts.
 // This is a fail-closed shape guard, NOT semantic proof of RLS isolation.
 const canonical=q.replace(/::text/g,'').replace(/[()]/g,'');
 if(canonical!=="client_id=nullifcurrent_setting'app.tenant_id',true,''::uuid")
  return {ready:false,reason:'comparison-policy-tenant-scope-unverified'};
 return {ready:true,reason:'comparison-rls-structure-present'};
}

export async function inspectComparisonRlsPolicy(pool){
 const unavailable={ready:false,reason:'comparison-rls-inspection-unavailable'};
 if(!pool||typeof pool.query!=='function')return unavailable;
 try{
  const table=await pool.query(`SELECT c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='ai_provider_comparisons'
      AND c.relkind IN ('r','p')`);
  if(table.rows?.length!==1)
   return {ready:false,reason:'comparison-table-missing'};
  const policies=await pool.query(`SELECT policyname,permissive,roles,cmd,qual
    FROM pg_policies WHERE schemaname='public'
    AND tablename='ai_provider_comparisons' ORDER BY policyname`);
  return evaluateComparisonRlsPolicy({table:table.rows[0],policies:policies.rows});
 }catch{return unavailable}
}
