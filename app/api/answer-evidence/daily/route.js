import {requireAdmin} from '../../../../lib/api-security';
import {reportDay,validReportDate} from '../../../../lib/reporting';
import {dailyAnswerEvidence} from '../../../../lib/answer-evidence-daily';
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const date=new URL(req.url).searchParams.get('date')||reportDay();
 if(!validReportDate(date))return Response.json({error:'Geçersiz ölçüm tarihi.'},{status:400});
 try{return Response.json({...await dailyAnswerEvidence(date),generatedAt:new Date().toISOString()},{headers:{'cache-control':'no-store'}})}catch{return Response.json({available:false,error:'Günlük AI yanıt ölçümleri alınamadı; sayımlar bilinmiyor.'},{status:503,headers:{'cache-control':'no-store'}})}
}
