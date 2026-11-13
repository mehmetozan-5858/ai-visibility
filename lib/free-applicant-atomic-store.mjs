import {eligibleFreeApplicantEvidence} from './free-applicant-proof-policy.mjs';

/**
 * PROPOSED store for a future reviewed PostgreSQL schema. NOT wired into production.
 * The caller MUST derive scope and verified provider/cost evidence from trusted
 * server-side records; browser assertions can never be passed as trusted evidence.
 * Does not migrate tables, start provider calls, or decide customer access.
 * On any write failure the transaction rolls back both related rows.
 */
export async function persistVerifiedFreeApplicantPair({pool,observation,receipt,scope}={}) {
  if(!eligibleFreeApplicantEvidence(observation,receipt,scope))
    return Object.freeze({stored:false,reason:'unverified-proof'});
  if(!pool || typeof pool.connect!=='function')throw Error('trusted-database-pool-required');
  const connection=await pool.connect();
  let transaction=false;
  try{
    await connection.query('BEGIN');transaction=true;
    await connection.query(`INSERT INTO free_applicant_verified_receipts
      (id,tenant_id,domain,provider,model,response_id,query_text,amount,currency,estimated)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[
      receipt.id,scope.tenantId,scope.domain,receipt.provider,receipt.model,
      receipt.responseId,receipt.query,receipt.amount,receipt.currency,receipt.estimated
    ]);
    await connection.query(`INSERT INTO free_applicant_verified_observations
      (receipt_id,tenant_id,domain,provider,model,response_id,query_text,result_text,brand_mentioned)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[
      receipt.id,scope.tenantId,scope.domain,observation.provider,observation.model,
      observation.responseId,observation.query,observation.text,observation.brandMentioned
    ]);
    await connection.query('COMMIT');transaction=false;
    return Object.freeze({stored:true,receiptId:receipt.id});
  }catch{
    if(transaction)await connection.query('ROLLBACK');
    return Object.freeze({stored:false,reason:'transaction-failed'});
  }finally{connection.release?.();}
}
