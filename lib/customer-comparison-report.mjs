/** Read-only customer-scoped evidence; no ranks or scores are inferred. */
export function comparisonReportRows(rows,clientId){
 if(!clientId)return [];
 return (Array.isArray(rows)?rows:[]).filter(row=>row.clientId===clientId).slice(0,20).map(row=>({
  clientId,query:String(row.query||'').slice(0,500),createdAt:row.createdAt,
  results:(Array.isArray(row.results)?row.results:[]).filter(r=>r&&['gemini','openai','perplexity'].includes(r.provider)&&['source-supported-answer','answer-received-unverified'].includes(r.status)&&typeof r.answer==='string'&&r.answer.trim()).slice(0,3).map(r=>{
   let sourceUrl=null;
   try{const u=new URL(r.evidence?.sourceUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2000)sourceUrl=u.href}catch{}
   const observation=typeof r.evidence?.observation==='string'?r.evidence.observation.trim().slice(0,1200):'';
   const supported=r.verified===true&&r.status==='source-supported-answer'&&Boolean(sourceUrl&&observation)&&r.answer.slice(0,2000).includes(observation);
   return {status:supported?'source-supported-answer':'answer-received-unverified',verified:supported,evidence:supported?{sourceUrl,observation}:null,provider:r.provider,answer:r.answer.slice(0,2000),supported,sourceUrl:supported?sourceUrl:null,observation:supported?observation:null};
  })
 })).filter(row=>row.results.length);
}
function freeEvidenceReportRows(runs,clientId){
 return runs.filter(run=>run.clientId===clientId&&run.result?.measurementPolicy==='verified-zero-price-only')
  .flatMap(run=>(Array.isArray(run.result.observations)?run.result.observations:[]).slice(0,2)
   .filter(item=>item?.provider==='OpenRouter'&&item.mode==='openrouter-free-api-no-search'
    &&typeof item.model==='string'&&item.model.endsWith(':free')
    &&typeof item.responseId==='string'&&item.responseId.trim()
    &&item.usage?.cost?.total_cost===0&&item.truncated===false&&item.brandPrompted===false
    &&typeof item.query==='string'&&item.query.trim()&&typeof item.text==='string'&&item.text.trim())
   .map(item=>({clientId,query:item.query.slice(0,500),createdAt:run.createdAt,results:[{
    provider:'openrouter',answer:item.text.slice(0,2000),status:'answer-received-unverified',
    verified:false,supported:false,evidence:null,sourceUrl:null,observation:null
   }]})));
}
export async function readCustomerComparisonReport(pool,clientId){
 if(!clientId)throw Error('Customer identity required');
 const exists=await pool.query("SELECT to_regclass('public.ai_provider_comparisons') AS name,to_regclass('public.answer_evidence_runs') AS free_evidence");
 const tables=exists.rows[0]||{};
 const [legacy,free]=await Promise.all([
  tables.name?pool.query('SELECT client_id AS "clientId",query,results,created_at AS "createdAt" FROM public.ai_provider_comparisons WHERE client_id=$1 ORDER BY created_at DESC LIMIT 20',[clientId]):{rows:[]},
  tables.free_evidence?pool.query(`SELECT entity_id AS "clientId",created_at AS "createdAt",result FROM public.answer_evidence_runs
   WHERE entity_type='client' AND entity_id=$1 AND result->>'measurementPolicy'='verified-zero-price-only'
   ORDER BY created_at DESC LIMIT 20`,[clientId]):{rows:[]}
 ]);
 return [...comparisonReportRows(legacy.rows,clientId),...freeEvidenceReportRows(free.rows,clientId)]
  .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,20);
}
