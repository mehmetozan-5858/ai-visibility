import {databasePool} from './database-runtime.js';
import {getDatabaseUrl} from './db.js';
import {randomUUID} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Called only after route authorization, before claims or provider requests. */
export async function prepareCustomerComparisonStorage({pool,clientId}){
 if(!UUID.test(clientId||''))throw Error('Customer identity mismatch');
 const client=(await pool.query('SELECT id FROM clients WHERE id=$1',[clientId])).rows[0];
 if(!client){const error=Error('Customer reference missing');error.code='23503';throw error}
 const exists=(await pool.query("SELECT to_regclass('public.ai_provider_comparisons') AS name")).rows[0]?.name;
 if(!exists)await pool.query(`CREATE TABLE IF NOT EXISTS public.ai_provider_comparisons(
   id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
   query TEXT NOT NULL,results JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW())`);
 const columns=(await pool.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_provider_comparisons'")).rows;
 const fields=new Map(columns.map(c=>[c.column_name,c.data_type]));
 if(fields.get('id')!=='uuid'||fields.get('client_id')!=='uuid'||fields.get('query')!=='text'||fields.get('results')!=='jsonb'||!fields.has('created_at')){
  const error=Error('Comparison schema mismatch');error.code='42703';throw error;
 }
 const permission=(await pool.query("SELECT has_table_privilege(current_user,'public.ai_provider_comparisons','INSERT') AS allowed")).rows[0]?.allowed;
 if(permission!==true){const error=Error('Comparison insert unavailable');error.code='42501';throw error}
 return {ready:true};
}

function payload(clientId,comparison){
 if(!UUID.test(clientId||'')||comparison?.clientId!==clientId)throw Error('Customer identity mismatch');
 if(typeof comparison.query!=='string'||!comparison.query.trim()||comparison.query.length>500)throw Error('Invalid comparison query');
 if(!Array.isArray(comparison.results)||!comparison.results.length||comparison.results.length>3)throw Error('No provider results');
 const results=JSON.stringify(comparison.results);
 if(Buffer.byteLength(results)>65536)throw Error('Comparison payload too large');
 return results;
}
/** Store provider comparisons separately from scored scans. Never fabricate a rank/score. */
export async function storeCustomerComparison({clientId,comparison}){
 const url=getDatabaseUrl();if(!url)throw Error('Database unavailable');
 return storeCustomerComparisonWithPool({pool:databasePool(url),clientId,comparison});
}

/** Internal pool seam for isolated SQL acceptance; never request-selectable. */
export async function storeCustomerComparisonWithPool({pool,clientId,comparison}){
 const results=payload(clientId,comparison);
 await prepareCustomerComparisonStorage({pool,clientId});
 const id=randomUUID();
 await pool.query('INSERT INTO public.ai_provider_comparisons(id,client_id,query,results) VALUES($1,$2,$3,$4::jsonb)',
  [id,clientId,comparison.query,results]);
 return {id,clientId,stored:true,visibilityScore:null};
}

/** Commit an owned task's answer and completion together; no provider retry. */
export async function storeClaimedCustomerComparison({pool,clientId,taskId,comparison}){
 const results=payload(clientId,comparison);
 if(typeof taskId!=='string'||!taskId||taskId.length>128)throw Error('Invalid comparison task');
 const tx=await pool.connect();
 try{
  await tx.query('BEGIN');
  const claim=(await tx.query('SELECT status,comparison_id FROM zera_ai_task_attempts WHERE client_id=$1 AND task_id=$2 FOR UPDATE',[clientId,taskId])).rows[0];
  if(claim?.status==='stored'&&UUID.test(claim.comparison_id||'')){
   await tx.query('COMMIT');return {id:claim.comparison_id,clientId,stored:true,duplicate:true,visibilityScore:null};
  }
  if(claim?.status!=='started')throw Error('Owned started comparison task required');
  const id=randomUUID();
  await tx.query('INSERT INTO public.ai_provider_comparisons(id,client_id,query,results) VALUES($1,$2,$3,$4::jsonb)',[id,clientId,comparison.query,results]);
  const changed=(await tx.query("UPDATE zera_ai_task_attempts SET status='stored',comparison_id=$3 WHERE client_id=$1 AND task_id=$2 AND status='started' RETURNING task_id",[clientId,taskId,id])).rows[0];
  if(!changed)throw Error('Comparison task state changed');
  await tx.query('COMMIT');return {id,clientId,stored:true,visibilityScore:null};
 }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error}finally{tx.release()}
}
