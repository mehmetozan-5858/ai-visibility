import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {exportInboxReviews,importInboxReviews} from '../../../lib/inbound-mail';
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{return Response.json(await exportInboxReviews(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'İnceleme kuyruğu yüklenemedi.'},{status:500})}
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 try{const text=await req.text();if(text.length>150000)return Response.json({error:'En fazla 10 değerlendirme aktarın.'},{status:413});return Response.json(await importInboxReviews(JSON.parse(text)))}
 catch(e){return Response.json({error:['invalid-reviews','stop-contact-draft'].includes(e.message)?'Geçersiz değerlendirme. Ret veya iletişimi durdurma yanıtına cevap taslağı eklemeyin.':'Değerlendirme kaydedilemedi.'},{status:['invalid-reviews','stop-contact-draft'].includes(e.message)||e instanceof SyntaxError?400:500})}
}
