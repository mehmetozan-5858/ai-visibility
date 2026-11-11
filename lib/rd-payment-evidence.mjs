// Metadata and bounded status counts only. Table presence never establishes payment acceptance.
export const PAYMENT_EVIDENCE_VIEW_SQL='SELECT * FROM rd_audit.payment_evidence_readiness';
export function normalizePaymentEvidence(row){
 const keys=['recordCount','paidLabelCount','bankPaidLabelCount','pendingCount','reportedCount'];
 if(!row||!keys.every(k=>Number.isInteger(row[k])&&row[k]>=0&&row[k]<=200)||
 !['limited','settlementTablePresent','eventTablePresent','entityTablePresent'].every(k=>typeof row[k]==='boolean')||
 row.bankPaidLabelCount>row.paidLabelCount||row.paidLabelCount+row.pendingCount+row.reportedCount>row.recordCount)throw Error('invalid-payment-aggregate');
 const checkedAt=row.checkedAt instanceof Date?row.checkedAt.toISOString():row.checkedAt;
 if(typeof checkedAt!=='string'||!Number.isFinite(Date.parse(checkedAt)))throw Error('invalid-payment-time');
 return {checkedAt,scope:'admin-only-latest-payment-labels',sampleLimit:200,limited:row.limited,
 records:{count:row.recordCount,paidLabel:row.paidLabelCount,bankPaidLabel:row.bankPaidLabelCount,pending:row.pendingCount,customerReported:row.reportedCount},
 sourceTables:{settlements:row.settlementTablePresent,providerEvents:row.eventTablePresent,providerEntities:row.entityTablePresent},
 acceptance:'not-verified',verifiedRevenue:null,signatureDeliveryVerified:false,
 transactionReadOnly:true,dedicatedReaderRole:true,connectionRoleIsDedicated:false,externalActions:false,paymentChanges:false};
}
export async function readPaymentEvidence(pool){
 const tx=await pool.connect();let discard=false;
 try{
  await tx.query('BEGIN READ ONLY');
  await tx.query("SET LOCAL statement_timeout='3000ms'");
  await tx.query('SET LOCAL ROLE rd_audit_reader');
  const mode=await tx.query("SELECT current_setting('transaction_read_only') AS mode,current_user AS role");
  if(mode.rows[0]?.mode!=='on'||mode.rows[0]?.role!=='rd_audit_reader')throw Error();
  const result=await tx.query(PAYMENT_EVIDENCE_VIEW_SQL);
  if(result.rows.length!==1)throw Error();
  const summary=normalizePaymentEvidence(result.rows[0]);
  await tx.query('COMMIT');return summary;
 }catch{try{await tx.query('ROLLBACK')}catch{discard=true}throw Error('payment-evidence-unavailable')}
 finally{tx.release(discard)}
}
