/** Read-only customer-scoped evidence; no ranks or scores are inferred. */
export function comparisonReportRows(rows,clientId){
 if(!clientId)return [];
 return (Array.isArray(rows)?rows:[]).filter(row=>row.clientId===clientId).slice(0,20).map(row=>({
  clientId,query:String(row.query||'').slice(0,500),createdAt:row.createdAt,
  results:(Array.isArray(row.results)?row.results:[]).filter(r=>r&&['gemini','openai','perplexity'].includes(r.provider)&&['source-supported-answer','answer-received-unverified'].includes(r.status)&&typeof r.answer==='string'&&r.answer.trim()).slice(0,3).map(r=>{
   let sourceUrl=null;
   try{const u=new URL(r.evidence?.sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2000)sourceUrl=u.href}catch{}
   const observation=typeof r.evidence?.observation==='string'?r.evidence.observation.trim().slice(0,1200):'';
   const supported=r.verified===true&&r.status==='source-supported-answer'&&Boolean(sourceUrl&&observation);
   return {status:supported?'source-supported-answer':'answer-received-unverified',verified:supported,evidence:supported?{sourceUrl,observation}:null,provider:r.provider,answer:r.answer.slice(0,2000),supported,sourceUrl:supported?sourceUrl:null,observation:supported?observation:null};
  })
 })).filter(row=>row.results.length);
}
export async function readCustomerComparisonReport(pool,clientId){
 if(!clientId)throw Error('Customer identity required');
 const exists=await pool.query("SELECT to_regclass('public.ai_provider_comparisons') AS name");
 if(!exists.rows[0]?.name)return [];
 const result=await pool.query('SELECT client_id AS "clientId",query,results,created_at AS "createdAt" FROM public.ai_provider_comparisons WHERE client_id=$1 ORDER BY created_at DESC LIMIT 20',[clientId]);
 return comparisonReportRows(result.rows,clientId);
}
