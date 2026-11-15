/**
 * Persist the accepted free-only provider usage receipt in the SAME PostgreSQL
 * transaction as its answer_evidence_runs row. A rollback then removes both.
 * The provider price/catalog response has already been verified upstream;
 * this is persistence atomicity, NOT independent provider billing proof.
 */
export async function recordFreeEvidenceCostTx(tx,entry={}){
 if(entry.costType!=='ai-provider'||entry.provider!=='OpenRouter'||entry.operation!=='answer-evidence'||entry.marketKey!=='business:ai'||
   entry.amount!==0||entry.currency!=='USD'||entry.estimated!==false||
   entry.metadata?.pricingSource!=='provider-reported-zero'||
   typeof entry.metadata?.responseId!=='string'||!entry.metadata.responseId.trim()||
   typeof entry.metadata?.model!=='string'||!entry.metadata.model.endsWith(':free'))
   throw Error('invalid-free-evidence-cost');
 const id=crypto.randomUUID();
 const result=await tx.query(`INSERT INTO cost_ledger(id,cost_type,provider,operation,market_key,prospect_id,amount,currency,estimated,metadata)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id`,
 [id,entry.costType,entry.provider,entry.operation,entry.marketKey,null,0,'USD',false,JSON.stringify(entry.metadata)]);
 if(result.rows?.[0]?.id!==id)throw Error('zero-cost-receipt-not-saved');
 return {id};
}
