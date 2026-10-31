/** Provision and check comparison storage before consuming provider quota.
 * Metadata checks do not prove a later INSERT will succeed (for example RLS).
 */
export async function prepareCustomerComparisonStorage(pool,clientId){
 if(!clientId)throw Error('Customer identity required');
 await pool.query(`CREATE TABLE IF NOT EXISTS ai_provider_comparisons(
   id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
   query TEXT NOT NULL,results JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW())`);
 const columns=(await pool.query(`SELECT column_name,data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='ai_provider_comparisons'`)).rows;
 const fields=new Map(columns.map(c=>[c.column_name,c.data_type]));
 if(fields.get('id')!=='uuid'||fields.get('client_id')!=='uuid'||fields.get('query')!=='text'||fields.get('results')!=='jsonb'||!fields.has('created_at'))
  throw Error('Comparison schema incompatible');
 const privilege=await pool.query("SELECT has_table_privilege(current_user,'public.ai_provider_comparisons','INSERT') AS allowed");
 if(privilege.rows[0]?.allowed!==true)throw Error('Comparison insert unavailable');
 const customer=await pool.query('SELECT id FROM public.clients WHERE id=$1',[clientId]);
 if(customer.rows.length!==1)throw Error('Customer identity unavailable');
}
