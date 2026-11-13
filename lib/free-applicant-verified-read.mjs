import {eligibleFreeApplicantEvidence} from './free-applicant-proof-policy.mjs';
import {freeAssessmentEvidence} from './free-assessment-rules.js';

/**
 * READ-SIDE PROTOTYPE ONLY. The caller must load observations and receipts
 * from trusted tenant-scoped DB queries, never from browser JSON. This helper
 * performs no SQL, provider call, or permission grant, and is not wired to
 * the live applicant route. Legacy unlinked runs are intentionally excluded.
 */
export function verifiedFreeApplicantAssessment(entity,{observations=[],receipts=[]}={},options={}) {
  const empty=()=>freeAssessmentEvidence(entity,[],options);
  if(!entity || typeof entity.id!=='string' || !entity.id ||
      typeof entity.domain!=='string'||!entity.domain ||
      !Array.isArray(observations)||!Array.isArray(receipts))return empty();
  const receiptsById=new Map();
  for(const receipt of receipts){
    if(!receipt || typeof receipt.id!=='string'||!receipt.id)continue;
    if(receiptsById.has(receipt.id)){
      receiptsById.set(receipt.id,null); // ambiguous proof fails closed
    }else receiptsById.set(receipt.id,receipt);
  }
  const runs=[];
  for(const row of observations){
    if(!row || typeof row!=='object'||typeof row.receiptId!=='string')continue;
    const receipt=receiptsById.get(row.receiptId);
    if(!receipt||!eligibleFreeApplicantEvidence(row,receipt,{tenantId:entity.id,domain:entity.domain}))continue;
    if(typeof row.recordedAt!=='string'||!Number.isFinite(Date.parse(row.recordedAt)))continue;
    runs.push({entityId:entity.id,entityType:'prospect',domain:entity.domain,
      createdAt:row.recordedAt,result:{observations:[row]}});
  }
  const result=freeAssessmentEvidence(entity,runs,options);
  return {...result,proofPolicy:'linked-receipt-only-v1',eligibleReceiptRows:runs.length};
}
