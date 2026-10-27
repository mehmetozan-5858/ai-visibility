import {projectCustomerComparisons} from './customer-comparison-view.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
/** clientId must come from the verified customer session, never request JSON/query.
 * This reader issues SELECT only; a missing table never triggers migration.
 */
export async function readCustomerComparisons({pool,clientId,limit=20}={}){
 if(!uuid(clientId)||!Number.isInteger(limit)||limit<1||limit>20)throw Error('invalid-customer-scope');
 const exists=(await pool.query("SELECT to_regclass('public.ai_provider_comparisons') AS name")).rows[0]?.name;
 if(!exists)return {comparisons:[],sourceSupportedCount:0,visibilityScore:null,state:'no-recorded-results'};
 const rows=(await pool.query(`SELECT id,query,results,created_at AS "createdAt" FROM ai_provider_comparisons
  WHERE client_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,[clientId,limit])).rows;
 const comparisons=projectCustomerComparisons(rows);
 return {comparisons,sourceSupportedCount:comparisons.reduce((n,c)=>n+c.results.filter(r=>r.verified===true).length,0),
  visibilityScore:null,state:comparisons.length?'recorded-results':'no-recorded-results'};
}
