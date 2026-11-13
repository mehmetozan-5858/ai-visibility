import {verifyApplicantAssessmentGrant} from '../../../../lib/applicant-assessment-grant.mjs';
import {normalizedBusinessDomain} from '../../../../lib/customer-assessment-candidates.mjs';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {checkRateLimit,enforceSameOrigin} from '../../../../lib/api-security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0',
 'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const policy='provider-data-sharing-2026-11';
const reply=(body,status)=>Response.json(body,{status,headers});
async function handle(req,withdraw=false){
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:'applicant-provider-consent',limit:6,windowMs:15*60*1000});
 if(limited)return limited;
 const grant=verifyApplicantAssessmentGrant(req.headers.get('x-applicant-assessment-token'));
 if(!grant)return reply({error:'Invalid or expired applicant grant'},401);
 if(!withdraw && process.env.APPLICANT_FREE_PROVIDER_CONSENT_ENABLED!=='true')
    return reply({error:'Provider consent feature disabled'},503);
 let body;
 try{body=await req.json();}catch{return reply({error:'Invalid request'},400);}
 if(!body||Array.isArray(body)||body.provider!=='OpenRouter'||body.policyVersion!==policy||
    body.confirm!==(withdraw?'withdraw-openrouter-data-permission':'agree-to-openrouter-data-permission'))
    return reply({error:'Explicit provider permission action required'},400);
 try{
  const url=getDatabaseUrl();if(!url)return reply({error:'Consent storage unavailable'},503);
  const pool=databasePool(url);
  const row=(await pool.query(`SELECT l.website,p.domain,
    a.verified_domain AS "verifiedDomain",e.verified_at AS "emailVerifiedAt",
    e.consumed_at AS "emailConsumedAt"
    FROM public.applicant_assessment_links a
    INNER JOIN public.customer_leads l ON l.id=a.lead_id
    INNER JOIN public.prospects p ON p.id=a.prospect_id
    INNER JOIN public.lead_email_challenges e ON
      e.lead_id=l.id AND e.email=lower(l.email)
    WHERE a.lead_id=$1 AND a.prospect_id=$2 AND a.revoked_at IS NULL
      AND a.verified_at IS NOT NULL
    LIMIT 1`,[grant.leadId,grant.prospectId])).rows?.[0];
  const verifiedDomain=normalizedBusinessDomain(row?.website);
  if(!row?.emailVerifiedAt||!row?.emailConsumedAt||!verifiedDomain||
     verifiedDomain!==normalizedBusinessDomain(row.domain)||
     verifiedDomain!==row.verifiedDomain)
    return reply({error:'Applicant ownership verification required'},403);
  if(withdraw){
   const result=await pool.query(`UPDATE public.applicant_free_provider_consents
     SET revoked_at=NOW()
     WHERE lead_id=$1 AND prospect_id=$2 AND provider='OpenRouter'
     AND purpose='free-ai-assessment' AND revoked_at IS NULL`,
     [grant.leadId,grant.prospectId]);
   return reply({ok:true,permission:'withdrawn',changed:(result.rowCount||0)>0},200);
  }
  // Only the applicant's explicit opt-in action may create this record;
  // email/domain proof or admin approval never do so automatically.
  await pool.query(`INSERT INTO public.applicant_free_provider_consents
    (lead_id,prospect_id,provider,purpose,policy_version,source,granted_at,expires_at)
    VALUES ($1,$2,'OpenRouter','free-ai-assessment',$3,
      'verified-applicant-action',NOW(),NOW()+INTERVAL '30 days')
    ON CONFLICT(lead_id,prospect_id,provider,purpose) DO UPDATE
      SET policy_version=EXCLUDED.policy_version,source=EXCLUDED.source,
        granted_at=EXCLUDED.granted_at,expires_at=EXCLUDED.expires_at,
        revoked_at=NULL`,[grant.leadId,grant.prospectId,policy]);
  return reply({ok:true,permission:'recorded',
   provider:'OpenRouter',startsProviderRequest:false,paymentRequired:false},200);
 }catch{return reply({error:'Provider permission could not be persisted'},503);}
}
export async function POST(req){return handle(req,false);}
export async function DELETE(req){return handle(req,true);}
