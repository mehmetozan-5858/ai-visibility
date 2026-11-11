import {randomUUID} from "node:crypto";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../../lib/api-security";
import {databasePool} from "../../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../../lib/db";
import {checkDomainTxtProof,domainProofEnabled,domainProofRecord,matchingApplicantDomain,newDomainProofNonce,validUuid} from "../../../../lib/applicant-domain-proof.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer"};
function json(body,status=200){return Response.json(body,{status,headers});}
function safeDb(){const url=getDatabaseUrl();if(!url)throw Error("database-unavailable");return databasePool(url);}
async function ownershipContext(db,leadId,prospectId){
 const rows=await db.query(`SELECT l.id AS "leadId",l.website,l.email,p.id AS "prospectId",p.domain,
  c.verified_at AS "emailVerifiedAt",c.consumed_at AS "emailConsumedAt"
 FROM public.customer_leads l
 JOIN public.prospects p ON p.id=$2
 LEFT JOIN public.lead_email_challenges c ON c.lead_id=l.id AND c.email=lower(l.email)
 WHERE l.id=$1 LIMIT 1`,[leadId,prospectId]);
 const row=rows.rows[0];
 const domain=matchingApplicantDomain(row,{domain:row?.domain});
 return row?.emailVerifiedAt&&row?.emailConsumedAt&&domain?{row,domain}:null;
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limit=checkRateLimit(req,{bucket:"admin-domain-proof",limit:8,windowMs:15*60*1000});if(limit)return limit;
 if(!domainProofEnabled())return json({error:"DNS verification disabled"},503);
 let input;
 try{input=await req.json()}catch{return json({error:"Invalid request"},400)}
 if(!["issue","verify"].includes(input?.action)||!validUuid(input?.leadId)||!validUuid(input?.prospectId))return json({error:"Invalid request"},400);
 try{
  const db=safeDb(),context=await ownershipContext(db,input.leadId,input.prospectId);
  if(!context)return json({error:"Verified applicant email and exact domain required"},403);
  if(input.action==="issue"){
   const nonce=newDomainProofNonce(),conn=await db.connect();
   try{
    await conn.query("BEGIN");
    // Serialize issuance for this lead, disallow silently overwriting a verified binding.
    await conn.query("SELECT id FROM public.customer_leads WHERE id=$1 FOR UPDATE",[input.leadId]);
    const linked=(await conn.query("SELECT 1 FROM public.applicant_assessment_links WHERE lead_id=$1 OR prospect_id=$2 LIMIT 1",[input.leadId,input.prospectId])).rows.length;
    if(linked){await conn.query("ROLLBACK");return json({error:"Already linked; review manually"},409)}
    await conn.query(`INSERT INTO public.applicant_domain_challenges(lead_id,prospect_id,domain,nonce,expires_at,verified_at,review_id)
      VALUES($1,$2,$3,$4,NOW()+INTERVAL '24 hours',NULL,NULL)
      ON CONFLICT(lead_id) DO UPDATE SET prospect_id=EXCLUDED.prospect_id,domain=EXCLUDED.domain,
         nonce=EXCLUDED.nonce,expires_at=EXCLUDED.expires_at,created_at=NOW(),verified_at=NULL,review_id=NULL`,
      [input.leadId,input.prospectId,context.domain,nonce]);
    await conn.query("COMMIT");
   }catch(e){await conn.query("ROLLBACK").catch(()=>{});throw e}finally{conn.release()}
   return json({ok:true,challenge:domainProofRecord(context.domain,nonce),validForHours:24,delivery:"admin-to-applicant-manual-only"});
  }
  const challenge=(await db.query(`SELECT lead_id AS "leadId",prospect_id AS "prospectId",domain,nonce,expires_at AS "expiresAt",verified_at AS "verifiedAt"
    FROM public.applicant_domain_challenges WHERE lead_id=$1 AND prospect_id=$2 LIMIT 1`,[input.leadId,input.prospectId])).rows[0];
  if(!challenge||challenge.verifiedAt||new Date(challenge.expiresAt).getTime()<=Date.now()||challenge.domain!==context.domain)
   return json({error:"Active matching challenge required"},409);
  if(!await checkDomainTxtProof(challenge.domain,challenge.nonce))
   return json({ok:false,reason:"DNS TXT proof not confirmed"},422);
  const conn=await db.connect();
  try{
   await conn.query("BEGIN");
   await conn.query("SELECT id FROM public.customer_leads WHERE id=$1 FOR UPDATE",[input.leadId]);
   const row=(await conn.query(`SELECT nonce,domain,expires_at,verified_at FROM public.applicant_domain_challenges
      WHERE lead_id=$1 AND prospect_id=$2 FOR UPDATE`,[input.leadId,input.prospectId])).rows[0];
   const email=(await conn.query(`SELECT 1 FROM public.lead_email_challenges c
     JOIN public.customer_leads l ON l.id=c.lead_id AND lower(l.email)=c.email
     WHERE c.lead_id=$1 AND c.verified_at IS NOT NULL AND c.consumed_at IS NOT NULL`,[input.leadId])).rows.length;
   if(!email||!row||row.nonce!==challenge.nonce||row.domain!==context.domain||row.verified_at||new Date(row.expires_at).getTime()<=Date.now()){
    await conn.query("ROLLBACK");return json({error:"Verification state changed; retry review"},409);
   }
   const reviewId=randomUUID();
   const linked=await conn.query(`INSERT INTO public.applicant_assessment_links(lead_id,prospect_id,review_id,verified_domain,verified_at)
      VALUES($1,$2,$3,$4,NOW()) ON CONFLICT DO NOTHING RETURNING lead_id`,
      [input.leadId,input.prospectId,reviewId,context.domain]);
   if(linked.rowCount!==1){await conn.query("ROLLBACK");return json({error:"Conflicting applicant ownership"},409)}
   await conn.query("UPDATE public.applicant_domain_challenges SET verified_at=NOW(),review_id=$2 WHERE lead_id=$1",[input.leadId,reviewId]);
   await conn.query("COMMIT");
   return json({ok:true,verified:true,reviewId,accessGranted:false,tokenIssued:false,providerCalled:false});
  }catch(e){await conn.query("ROLLBACK").catch(()=>{});throw e}finally{conn.release()}
 }catch{return json({error:"DNS business ownership verification unavailable"},503)}
}
