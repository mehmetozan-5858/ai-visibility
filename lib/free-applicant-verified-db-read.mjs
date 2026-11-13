import {verifiedFreeApplicantAssessment} from './free-applicant-verified-read.mjs';

/**
 * DRAFT ONLY — NOT WIRED TO ANY HTTP ROUTE.
 * `entity` MUST come from a separately authorized server-side lead/prospect
 * lookup. This function DOES NOT authenticate users or grant permissions.
 * Only reads the proposed proof tables; it never creates schema, provider
 * requests, receipts, accounts or payments. Never supply browser-selected scope.
 */
const canonicalTenantId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonicalDomain=/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])*$/;
export async function readVerifiedFreeApplicantAssessment(pool, entity, options={}) {
  const unavailable=Object.freeze({status:'unavailable',score:null,reason:'trusted-proof-read-unavailable'});
  if(!pool || typeof pool.query!=='function' ||
     !entity || typeof entity.id!=='string' || !canonicalTenantId.test(entity.id) ||
     typeof entity.domain!=='string' || !canonicalDomain.test(entity.domain))
    return unavailable;
  try {
    const rows=await pool.query(`SELECT
      o.receipt_id AS "receiptId",o.tenant_id AS "tenantId",
      o.domain,o.provider,o.model,o.response_id AS "responseId",
      o.query_text AS "query",o.result_text AS "text",
      o.brand_mentioned AS "brandMentioned",o.brand_prompted AS "brandPrompted",
      o.truncated,o.mode,o.recorded_at AS "recordedAt",
      r.id AS "proofId",r.tenant_id AS "proofTenantId",r.domain AS "proofDomain",
      r.provider AS "proofProvider",r.model AS "proofModel",
      r.response_id AS "proofResponseId",r.query_text AS "proofQuery",
      r.amount,r.currency,r.estimated,r.operation,
      r.verified_zero_price AS "verifiedZeroPriceAtRequest",
      r.response_complete AS "responseComplete",
      r.verified_model_identity AS "verifiedModelIdentity"
      FROM free_applicant_verified_observations o
      INNER JOIN free_applicant_verified_receipts r ON
        r.id=o.receipt_id AND r.tenant_id=o.tenant_id
        AND r.domain=o.domain AND r.provider=o.provider
        AND r.model=o.model AND r.response_id=o.response_id
        AND r.query_text=o.query_text
      WHERE o.tenant_id=$1 AND o.domain=$2
        AND o.recorded_at >= NOW() - INTERVAL '14 days'
        AND o.recorded_at <= NOW()
      ORDER BY o.recorded_at DESC LIMIT 100`,[entity.id,entity.domain]);
    if(!Array.isArray(rows?.rows))return unavailable;
    const observations=[],receipts=[];
    for(const x of rows.rows) {
      observations.push({receiptId:x.receiptId,tenantId:x.tenantId,domain:x.domain,
        provider:x.provider,model:x.model,responseId:x.responseId,
        query:x.query,text:x.text,brandMentioned:x.brandMentioned,
        brandPrompted:x.brandPrompted,truncated:x.truncated,mode:x.mode,
        recordedAt:x.recordedAt instanceof Date?x.recordedAt.toISOString():String(x.recordedAt)});
      // Numeric must be *exactly* zero, never assume SQL NUMERIC string '0' is free.
      const zeroAmount=(typeof x.amount==='number'&&x.amount===0)||
        (typeof x.amount==='string'&&/^0+(?:\.0+)?$/.test(x.amount));
      receipts.push({id:x.proofId,tenantId:x.proofTenantId,domain:x.proofDomain,
        provider:x.proofProvider,model:x.proofModel,responseId:x.proofResponseId,
        query:x.proofQuery,amount:zeroAmount?0:null,currency:x.currency,
        estimated:x.estimated,operation:x.operation,persisted:true,
        verifiedZeroPriceAtRequest:x.verifiedZeroPriceAtRequest,
        responseComplete:x.responseComplete,verifiedModelIdentity:x.verifiedModelIdentity});
    }
    return verifiedFreeApplicantAssessment(entity,{observations,receipts},options);
  } catch {
    return unavailable;
  }
}
