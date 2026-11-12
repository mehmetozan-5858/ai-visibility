import {randomUUID} from 'node:crypto';
import {normalizedBusinessDomain} from './customer-assessment-candidates.mjs';
import {validUuid,matchingApplicantDomain} from './applicant-domain-proof.mjs';

// Only creates/reuses a research business row. Ownership, accounts and provider calls remain separate.
export async function prepareApplicantBusiness(pool,leadId){
 if(!validUuid(leadId))throw Error('invalid-lead');
 const conn=await pool.connect();
 try{
  await conn.query('BEGIN');
  const lead=(await conn.query(`SELECT l.id,l.business_name,l.website,l.sector,l.country,
   c.verified_at,c.consumed_at FROM public.customer_leads l
   LEFT JOIN public.lead_email_challenges c ON c.lead_id=l.id AND c.email=lower(l.email)
   WHERE l.id=$1 FOR UPDATE OF l`,[leadId])).rows[0];
  const domain=normalizedBusinessDomain(lead?.website);
  if(!lead?.verified_at||!lead.consumed_at||!domain||!matchingApplicantDomain(lead,{domain}))throw Error('verified-email-and-domain-required');
  await conn.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[domain]);
  const rows=(await conn.query('SELECT id,domain FROM public.prospects LIMIT 5001')).rows;
  if(rows.length>5000)throw Error('review-capacity-required');
  const candidates=rows.filter(p=>normalizedBusinessDomain(p.domain)===domain);
  if(candidates.length>1)throw Error('ambiguous-business');
  let prospectId=candidates[0]?.id;const created=!prospectId;
  if(created){
   prospectId=randomUUID();
   await conn.query(`INSERT INTO public.prospects(id,name,domain,sector,city,country,source)
    VALUES($1,$2,$3,$4,'',$5,'applicant-intake')`,[prospectId,lead.business_name,domain,lead.sector||'',lead.country||'']);
  }
  await conn.query('COMMIT');
  return {ok:true,leadId,prospectId,domain,created,ownershipVerified:false,accessGranted:false,providerCalled:false};
 }catch(error){await conn.query('ROLLBACK').catch(()=>{});throw error}finally{conn.release()}
}
