/** Read-only, independently scoped applicant consent gate.
 * The caller supplies the authorized prospect loaded server-side, not a
 * browser-selected tenant. Does not issue consent or trigger inference.
 * Missing schema, unverified email, revoked link or expired consent fail closed.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const domain=/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
export async function readApplicantProviderConsent(pool,{prospectId,businessDomain,provider}={}){
 const deny=reason=>Object.freeze({authorized:false,reason});
 if(!pool||typeof pool.query!=='function')return deny('consent-storage-unavailable');
 if(!uuid.test(prospectId||'')||typeof businessDomain!=='string'||
    !domain.test(businessDomain)||!['OpenRouter','Gemini'].includes(provider))
    return deny('invalid-trusted-scope');
 try{
  const result=await pool.query(`SELECT COUNT(*)::int AS eligible
   FROM public.applicant_free_provider_consents c
   INNER JOIN public.applicant_assessment_links a ON
     a.lead_id=c.lead_id AND a.prospect_id=c.prospect_id
   INNER JOIN public.customer_leads l ON l.id=c.lead_id
   INNER JOIN public.prospects p ON p.id=c.prospect_id
   INNER JOIN public.lead_email_challenges e ON
     e.lead_id=l.id AND e.email=lower(l.email)
   WHERE c.prospect_id=$1 AND c.provider=$2
     AND c.purpose='free-ai-assessment'
     AND c.source='verified-applicant-action'
     AND c.granted_at<=NOW() AND c.expires_at>NOW()
     AND c.revoked_at IS NULL
     AND a.revoked_at IS NULL AND a.verified_at IS NOT NULL
     AND e.verified_at IS NOT NULL AND e.consumed_at IS NOT NULL
     AND lower(p.domain)=$3 AND lower(a.verified_domain)=$3
     AND lower(c.provider) = lower($2)`,[prospectId,provider,businessDomain]);
  const count=result?.rows?.[0]?.eligible;
  return count===1?Object.freeze({authorized:true,reason:'verified-consent-and-scope'}):
   deny('verified-consent-not-found');
 }catch{return deny('consent-storage-unavailable');}
}
