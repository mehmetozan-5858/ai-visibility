import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {createWordpressDraft,listCmsDeliveries,reconcileWordpressDelivery} from '../../../../lib/wordpress-drafts';
import {withRequestBudget} from '../../../../lib/request-budget';
export async function GET(req){const denied=await requireAdmin(req);if(denied)return denied;try{return Response.json({deliveries:await listCmsDeliveries()},{headers:{"cache-control":"no-store"}})}catch{return Response.json({error:'Taslak teslim kayıtları yüklenemedi.'},{status:503,headers:{'cache-control':'no-store'}})}}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 return withRequestBudget(45000,async()=>{try{const body=await req.json();if(body.approved!==true)return Response.json({error:'Taslak teslimi için açık onay gerekli.'},{status:400});if(!/^[0-9a-f-]{36}$/i.test(body.workId||''))return Response.json({error:'Geçerli görev gerekli.'},{status:400});return Response.json(await createWordpressDraft(body.workId))}
 catch(e){const messages={'cms-not-configured':'WordPress bağlantı bilgileri henüz yapılandırılmadı.','client-site-mismatch':'Görev müşterisi ile WordPress sitesi eşleşmiyor.','work-not-ready':'Görev teslim için hazır değil.','content-task-required':'Bu bağlantı içerik, FAQ ve lokasyon metinlerini taslak olarak teslim eder.','paid-service-required':'Müşteri için onaylanmış ödeme gerekli.'};return Response.json({error:messages[e.message]||'WordPress taslağı teslim edilemedi. Tekrar denemeden önce teslim durumunu kontrol edin.'},{status:409})}});
}

export async function PATCH(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 return withRequestBudget(30000,async()=>{try{const body=await req.json();if(!/^[0-9a-f-]{36}$/i.test(body.workId||''))return Response.json({error:'Geçerli görev gerekli.'},{status:400});return Response.json(await reconcileWordpressDelivery(body.workId))}
 catch(e){const messages={'cms-not-configured':'WordPress bağlantısı henüz yapılandırılmadı.','client-site-mismatch':'Müşteri ile WordPress sitesi eşleşmiyor.','delivery-not-found':'Bu görev için teslim kaydı yok.','wordpress-http-401':'WordPress bağlantı yetkisi geçersiz.','wordpress-http-403':'WordPress bu kaydı okumaya izin vermedi.','wordpress-http-404':'WordPress kaydı bulunamadı; teslimi elle kontrol edin.'};return Response.json({error:messages[e.message]||'Teslim doğrulanamadı. Yeniden oluşturmadan önce WordPress kaydını kontrol edin.'},{status:409})}});
}
