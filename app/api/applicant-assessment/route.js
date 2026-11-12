import {verifyApplicantAssessmentGrant,linkedApplicantAssessmentEnabled} from "../../../lib/applicant-assessment-grant.mjs";
import {normalizedBusinessDomain} from "../../../lib/customer-assessment-candidates.mjs";
import {freeAssessmentEvidence} from "../../../lib/free-assessment-rules";
import {databasePool} from "../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../lib/db";
import {checkRateLimit} from "../../../lib/api-security";
import {buildApplicantAssessmentPdf} from "../../../lib/applicant-assessment-pdf.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow","Vary":"x-applicant-assessment-token","X-Content-Type-Options":"nosniff"};
export async function GET(req){
 const limited=checkRateLimit(req,{bucket:"applicant-assessment-preview",limit:20,windowMs:60000});if(limited){for(const [key,value] of Object.entries(headers))limited.headers.set(key,value);return limited;}
 if(!linkedApplicantAssessmentEnabled())return Response.json({error:"Preview not enabled"},{status:503,headers});
 const grant=verifyApplicantAssessmentGrant(req.headers.get("x-applicant-assessment-token"));
 if(!grant)return Response.json({error:"Invalid or expired preview grant"},{status:401,headers});
 const format=new URL(req.url).searchParams.get('format');
 if(format!==null&&format!=='pdf')return Response.json({error:"Unsupported assessment format"},{status:400,headers});
 try{
  const url=getDatabaseUrl();if(!url)throw Error("no-database");const pool=databasePool(url);
  const row=(await pool.query(`SELECT l.website,l.email,p.id,p.name,p.domain,p.country,p.city,p.sector,
    a.verified_domain AS "verifiedDomain",c.verified_at AS "emailVerifiedAt",c.consumed_at AS "emailConsumedAt"
    FROM public.applicant_assessment_links a
    JOIN public.customer_leads l ON l.id=a.lead_id
    JOIN public.prospects p ON p.id=a.prospect_id
    JOIN public.lead_email_challenges c ON c.lead_id=l.id AND c.email=lower(l.email)
    WHERE a.lead_id=$1 AND a.prospect_id=$2 AND a.revoked_at IS NULL AND a.verified_at IS NOT NULL
    LIMIT 1`,[grant.leadId,grant.prospectId])).rows[0];
  const domain=normalizedBusinessDomain(row?.website);
  if(!row||!row.emailVerifiedAt||!row.emailConsumedAt||!domain||
     domain!==normalizedBusinessDomain(row.domain)||domain!==row.verifiedDomain)
    return Response.json({error:"Preview is not authorized"},{status:403,headers});
  const runs=(await pool.query(`SELECT entity_id AS "entityId",entity_type AS "entityType",
    domain,created_at AS "createdAt",result
    FROM public.answer_evidence_runs
    WHERE entity_id=$1 AND entity_type='prospect' AND created_at>=NOW()-INTERVAL '14 days'
    ORDER BY created_at DESC LIMIT 50`,[row.id])).rows;
  const assessment=freeAssessmentEvidence(row,runs);
  // Never expose source provider text, internal prospect fields, customer PII or unverified recommendations.
  const language=/^(Türkiye|Turkey|TR)$/i.test(row.country||"")?"tr":"en";
  const business={name:row.name,country:row.country,city:row.city,sector:row.sector};
  if(format==='pdf'){
   const bytes=await buildApplicantAssessmentPdf({business,assessment,language});
   return new Response(bytes,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="ai-visibility-free-assessment.pdf"'}});
  }
  return Response.json({business,
   assessment,language,kind:"limited-sample-only",paidAccess:false,providerCallStarted:false},{headers});
 }catch{return Response.json({error:"Preview currently unavailable"},{status:503,headers})}
}
