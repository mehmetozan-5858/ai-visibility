import {randomUUID} from 'node:crypto';
/** Keep the answer and the claimed task's stored status in the same transaction. */
export async function writeCustomerComparison(pool,{clientId,comparison,attemptTaskId}={}){
 if(!clientId||comparison?.clientId!==clientId)throw Error('Customer identity mismatch');
 if(!Array.isArray(comparison.results)||!comparison.results.length)throw Error('No provider results');
 if(attemptTaskId!==undefined&&(typeof attemptTaskId!=='string'||!attemptTaskId))throw Error('Invalid attempt task');
 const tx=await pool.connect(),id=randomUUID();
 let discard=false;
 try{
  await tx.query('BEGIN');
  await tx.query('INSERT INTO ai_provider_comparisons(id,client_id,query,results) VALUES($1,$2,$3,$4::jsonb)',
   [id,clientId,comparison.query,JSON.stringify(comparison.results)]);
  if(attemptTaskId!==undefined){
   const updated=await tx.query("UPDATE zera_ai_task_attempts SET status='stored',comparison_id=$3,failure_reason=NULL WHERE client_id=$1 AND task_id=$2 AND status='started' RETURNING task_id",[clientId,attemptTaskId,id]);
   if(updated.rows.length!==1)throw Error('Attempt is not exclusively claimed');
  }
  await tx.query('COMMIT');
  return {id,clientId,stored:true,visibilityScore:null};
 }catch(error){
  try{await tx.query('ROLLBACK')}catch{discard=true}
  throw error;
 }finally{tx.release(discard)}
}
