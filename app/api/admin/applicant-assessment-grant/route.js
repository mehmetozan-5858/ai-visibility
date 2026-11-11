import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../../lib/api-security";
import {databasePool} from "../../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../../lib/db";
import {createApplicantAssessmentGrant,linkedApplicantAssessmentEnabled} from "../../../../lib/applicant-assessment-grant.mjs";
import {normalizedBusinessDomain} from "../../../../lib/customer-assessment-candidates.mjs";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer"};
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const badOrigin=enforceSameOrigin(req);if(badOrigin)return badOrigin;
 const limited=checkRateLimit(req,{bucket:"admin-applicant-preview-issue",limit:6,windowMs:15*60*1000});if(limited)return limited;
 if(!linkedApplicantAssessmentEnabled())return Response.json({error:"Applicant preview disabled"},{status:503,headers});
 try{
  const body=await req.json();
  if(!id.test(body?.leadId||""))return Response.json({error:"Invalid lead"},{status:400,headers});
  const url=getDatabaseUrl();if(!url)throw Error("no-database");
  const db=databasePool(url);
  const row=(await db.query(`SELECT l.id AS "leadId",l.email,l.website,
    p.id AS "prospectId",p.domain,a.verified_domain AS "verifiedDomain",
    c.verified_at AS "emailVerifiedAt",c.consumed_at AS "emailConsumedAt"
    FROM public.applicant_assessment_links a
    JOIN public.customer_leads l ON l.id=a.lead_id
    JOIN public.prospects p ON p.id=a.prospect_id
    JOIN public.lead_email_challenges c ON c.lead_id=l.id AND c.email=lower(l.email)
    WHERE a.lead_id=$1 AND a.revoked_at IS NULL AND a.verified_at IS NOT NULL
    LIMIT 1`,[body.leadId])).rows[0];
  const validDomain=normalizedBusinessDomain(row?.website);
  if(!row||!row.emailVerifiedAt||!row.emailConsumedAt||!validDomain||
   validDomain!==normalizedBusinessDomain(row.domain)||validDomain!==row.verifiedDomain)
    return Response.json({error:"Verified ownership and email required"},{status:403,headers});
  const token=createApplicantAssessmentGrant({leadId:row.leadId,prospectId:row.prospectId});
  // Admin-only issuance. Never email automatically or log this short-lived token.
  return Response.json({ok:true,token,expiresInSeconds:900,delivery:"manual-approved-only"},{headers});
 }catch{return Response.json({error:"Preview authorization unavailable"},{status:503,headers})}
}
