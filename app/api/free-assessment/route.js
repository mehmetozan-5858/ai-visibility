import {verifyFreeAssessmentToken} from '../../../lib/free-assessment-token';
import {freeAssessmentEvidence} from '../../../lib/free-assessment-rules';
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
  const tables=(await pool.query("SELECT to_regclass('public.prospects') AS prospects,to_regclass('public.answer_evidence_runs') AS evidence")).rows[0];
  if(!tables?.prospects)throw Error('source-unavailable');
  const entity=(await pool.query('SELECT id,name,domain,country,city,sector FROM prospects WHERE id=$1',[grant.prospectId])).rows[0];
  if(!entity)return Response.json({error:'Ön değerlendirme kaydı bulunamadı.'},{status:404,headers});
  const runs=tables.evidence?(await pool.query(`SELECT entity_id AS "entityId",entity_type AS "entityType",domain,created_at AS "createdAt",result FROM answer_evidence_runs WHERE entity_id=$1 AND entity_type='prospect' AND created_at>=NOW()-INTERVAL '14 days' ORDER BY created_at DESC LIMIT 50`,[grant.prospectId])).rows:[];
  const language=/^(Türkiye|Turkey|TR)$/i.test(entity.country||'')?'tr':'en';
  const plans=['business-diagnosis','business-monitoring'].map(service=>{
   const price=servicePrice({service,country:entity.country,language});
   return {code:price.code,name:price.name,amount:price.amount,currency:price.currency,kind:price.kind,href:'/yeni-musteri?'+new URLSearchParams({service,country:entity.country||''})};
  });
  return Response.json({business:{name:entity.name,country:entity.country,city:entity.city,sector:entity.sector},language,assessment:freeAssessmentEvidence(entity,runs),plans},{headers});
 }catch{return Response.json({error:'Ön değerlendirme şu anda alınamadı. Lütfen daha sonra tekrar deneyin.'},{status:503,headers})}
}
