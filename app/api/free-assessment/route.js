import {verifyFreeAssessmentToken} from '../../../lib/free-assessment-token';
import {readVerifiedFreeApplicantAssessment} from '../../../lib/free-applicant-verified-db-read.mjs';
import {databasePool} from '../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../lib/db';
import {checkRateLimit} from '../../../lib/api-security';
import {servicePrice} from '../../../lib/regional-pricing';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'};
export async function GET(req){
 const grant=verifyFreeAssessmentToken(req.headers.get('x-preview-token'));
 if(!grant)return Response.json({error:'Bu ön değerlendirme bağlantısı geçersiz veya süresi dolmuş.'},{status:401,headers});
 const limited=checkRateLimit(req,{bucket:'free-assessment',limit:30,windowMs:60000});if(limited)return limited;
 try{
  const url=getDatabaseUrl();if(!url)throw Error('database-unavailable');const pool=databasePool(url);
  const tables=(await pool.query("SELECT to_regclass('public.prospects') AS prospects")).rows[0];
  if(!tables?.prospects)throw Error('source-unavailable');
  const entity=(await pool.query('SELECT id,name,domain,country,city,sector FROM prospects WHERE id=$1',[grant.prospectId])).rows[0];
  if(!entity)return Response.json({error:'Ön değerlendirme kaydı bulunamadı.'},{status:404,headers});
  // Authorized prospect comes from the signed preview grant and trusted database.
  // Legacy answer_evidence_runs cannot certify zero-cost provider receipts.
  const proof=await readVerifiedFreeApplicantAssessment(pool,entity);
  const assessment=proof.status==='ready'?proof:{score:null,status:'insufficient',samples:0,providers:0,queries:0,measuredAt:null,
    minimum:{samples:6,providers:2,queries:2},methodVersion:'linked-receipt-only-v1',
    reason:proof.status==='unavailable'?'verified-proof-unavailable':'verified-proof-insufficient'};
  const language=/^(Türkiye|Turkey|TR)$/i.test(entity.country||'')?'tr':'en';
  const plans=['business-diagnosis','business-monitoring'].map(service=>{
   const price=servicePrice({service,country:entity.country,language});
   return {code:price.code,name:price.name,amount:price.amount,currency:price.currency,kind:price.kind,href:'/yeni-musteri?'+new URLSearchParams({service,country:entity.country||''})};
  });
  return Response.json({business:{name:entity.name,country:entity.country,city:entity.city,sector:entity.sector},language,assessment,plans},{headers});
 }catch{return Response.json({error:'Ön değerlendirme şu anda alınamadı. Lütfen daha sonra tekrar deneyin.'},{status:503,headers})}
}
