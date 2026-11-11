import {createHash,randomUUID} from "node:crypto";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../../lib/api-security";
import {databasePool} from "../../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../../lib/db";
import {createApplicantAssessmentGrant,linkedApplicantAssessmentEnabled} from "../../../../lib/applicant-assessment-grant.mjs";
import {matchingApplicantDomain,domainProofEnabled,validUuid} from "../../../../lib/applicant-domain-proof.mjs";
import {applicantDeliveryEnabled,applicantAssessmentLink,sendApplicantAssessmentLink} from "../../../../lib/applicant-assessment-delivery.mjs";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer"};
const json=(body,status=200)=>Response.json(body,{status,headers});
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const rate=checkRateLimit(req,{bucket:"admin-applicant-delivery",limit:4,windowMs:15*60*1000});if(rate)return rate;
 if(!linkedApplicantAssessmentEnabled()||!domainProofEnabled()||!applicantDeliveryEnabled())return json({error:"Applicant delivery disabled"},503);
 let body;
 try{body=await req.json()}catch{return json({error:"Invalid request"},400)}
 if(!validUuid(body?.leadId)||body?.confirm!=="send-one-applicant-assessment-email")return json({error:"Explicit delivery confirmation required"},400);
 let db;
 try{const url=getDatabaseUrl();if(!url)throw Error("no-database");db=databasePool(url)}catch{return json({error:"Delivery unavailable"},503)}
 const conn=await db.connect().catch(()=>null);
 if(!conn)return json({error:"Delivery unavailable"},503);
 let recipient,leadId,prospectId,deliveryId;
 try{
  await conn.query("BEGIN");
  // Row lock serializes separate operator requests; no second automatic attempt.
  const record=(await conn.query(`SELECT l.id AS "leadId",l.email,l.website,p.id AS "prospectId",p.domain,
    a.review_id AS "reviewId",a.verified_domain AS "verifiedDomain",
    c.verified_at AS "emailVerifiedAt",c.consumed_at AS "emailConsumedAt",
    d.review_id AS "dnsReviewId",d.verified_at AS "dnsVerifiedAt"
    FROM public.customer_leads l
    JOIN public.applicant_assessment_links a ON a.lead_id=l.id
    JOIN public.prospects p ON p.id=a.prospect_id
    JOIN public.lead_email_challenges c ON c.lead_id=l.id AND c.email=lower(l.email)
    JOIN public.applicant_domain_challenges d ON d.lead_id=l.id
      AND d.prospect_id=p.id AND d.review_id=a.review_id
    WHERE l.id=$1 AND a.revoked_at IS NULL AND a.verified_at IS NOT NULL
    FOR UPDATE OF l`,[body.leadId])).rows[0];
  const domain=matchingApplicantDomain(record,{domain:record?.domain});
  if(!record||!domain||domain!==record.verifiedDomain||!record.emailVerifiedAt||
      !record.emailConsumedAt||!record.dnsVerifiedAt||record.reviewId!==record.dnsReviewId){
   await conn.query("ROLLBACK");return json({error:"Applicant verification incomplete"},403);
  }
  recipient=String(record.email||"").trim().toLowerCase();
  const hash=createHash("sha256").update(recipient).digest("hex");
  deliveryId=randomUUID();leadId=record.leadId;prospectId=record.prospectId;
  const reserved=await conn.query(`INSERT INTO public.applicant_assessment_deliveries
    (id,lead_id,prospect_id,review_id,email_fingerprint,status)
    VALUES($1,$2,$3,$4,$5,'reserved') ON CONFLICT(lead_id) DO NOTHING RETURNING id`,
    [deliveryId,leadId,prospectId,record.reviewId,hash]);
  if(reserved.rowCount!==1){
   await conn.query("ROLLBACK");
   return json({error:"Assessment delivery already attempted; manual status review required"},409);
  }
  await conn.query("COMMIT");
 }catch{
  await conn.query("ROLLBACK").catch(()=>{});
  return json({error:"Delivery review unavailable"},503);
 }finally{conn.release()}
 // No token or recipient in the audit ledger or response.
 let outcome="failed";
 try{
  const token=createApplicantAssessmentGrant({leadId,prospectId});
  const link=applicantAssessmentLink(token);
  await sendApplicantAssessmentLink({email:recipient,link});
  outcome="provider-accepted";
 }catch{}
 try{
  await db.query(`UPDATE public.applicant_assessment_deliveries SET status=$2,completed_at=NOW(),
    error_code=CASE WHEN $2='failed' THEN 'provider-unconfirmed' ELSE NULL END
    WHERE id=$1 AND status='reserved'`,[deliveryId,outcome]);
 }catch{return json({error:"Delivery outcome could not be recorded; manual review required"},503)}
 if(outcome==="failed")return json({error:"Delivery unconfirmed; automatic retry disabled"},503);
 return json({ok:true,deliveryId,status:"provider-accepted",expiryMinutes:15,automaticRetry:false});
}
