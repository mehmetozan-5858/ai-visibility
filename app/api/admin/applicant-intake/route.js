import {requireAdmin,enforceSameOrigin,checkRateLimit} from '../../../../lib/api-security';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {domainProofEnabled} from '../../../../lib/applicant-domain-proof.mjs';
import {prepareApplicantBusiness} from '../../../../lib/applicant-intake.mjs';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Cookie'};
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:'applicant-intake',limit:8,windowMs:15*60*1000});if(limited)return limited;
 if(!domainProofEnabled())return Response.json({error:'Başvuru kabulü etkin değil.'},{status:503,headers});
 try{
  const body=await req.json();
  if(body?.confirm!=='prepare-applicant-business')return Response.json({error:'İşletme kaydı onayı gerekli.'},{status:400,headers});
  const url=getDatabaseUrl();if(!url)throw Error('database-unavailable');
  return Response.json(await prepareApplicantBusiness(databasePool(url),body.leadId),{headers});
 }catch(error){
  const messages={'invalid-lead':'Geçerli başvuru referansı gerekli.','verified-email-and-domain-required':'Doğrulanmış e-posta ve geçerli web sitesi gerekli.','ambiguous-business':'Birden fazla işletme eşleşiyor; manuel inceleme gerekli.'};
  return Response.json({error:messages[error.message]||'İşletme kaydı hazırlanamadı.'},{status:messages[error.message]?409:503,headers});
 }
}
