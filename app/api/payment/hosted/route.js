import {verifyPaymentAccessToken} from '../../../../lib/admin-auth';
import {getPaymentById,recordPaymentConsent} from '../../../../lib/repository';
import {getClientProfile} from '../../../../lib/client-profile';
import {servicePrice,SERVICE_CODES} from '../../../../lib/regional-pricing';
import {shopierProduct,paymentMatchesPlan} from '../../../../lib/hosted-checkout';
import {enforceSameOrigin,checkRateLimit} from '../../../../lib/api-security';
export async function POST(req){
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:'hosted-checkout',limit:20});if(limited)return limited;
 try{const body=await req.json(),access=await verifyPaymentAccessToken(body.token||'');
  if(!access)return Response.json({error:'Ödeme bağlantısı geçersiz.'},{status:401});
  if(body.consent!==true)return Response.json({error:'Sözleşme ve hizmet başlangıcı onayı gerekli.'},{status:400});
  if(!SERVICE_CODES.includes(access.service))return Response.json({error:'Hizmete bağlı ödeme bağlantısı gerekli.'},{status:400});
  const payment=await getPaymentById(body.paymentId);
  if(!payment||payment.clientId!==access.clientId)return Response.json({error:'Ödeme kaydı eşleşmiyor.'},{status:403});
  if(!['pending','customer-reported'].includes(payment.status))return Response.json({error:'Bu ödeme için yeni işlem başlatılamaz.'},{status:409});
  const profile=await getClientProfile(access.clientId),plan=servicePrice({service:access.service,country:profile?.country||'Türkiye',language:'tr'});
  if(!paymentMatchesPlan(payment,plan))return Response.json({error:'Hizmet, tutar veya para birimi eşleşmiyor.'},{status:409});
  const product=shopierProduct(plan);if(!product)return Response.json({error:'Bu hizmet için doğrulanmış Shopier ürün bağlantısı henüz yapılandırılmadı.'},{status:503});
  await recordPaymentConsent(payment.id);
  return Response.json({url:product.url,referenceCode:payment.referenceCode,automaticApproval:false});
 }catch{return Response.json({error:'Ödeme bağlantısı hazırlanamadı.'},{status:500})}
}
