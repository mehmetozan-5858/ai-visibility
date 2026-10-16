import {verifyPaymentAccessToken} from '../../../../lib/admin-auth';
import {getClientProfile} from '../../../../lib/client-profile';
import {getOrCreatePaymentIntent,recordPaymentConsent} from '../../../../lib/repository';
import {servicePrice,SERVICE_CODES} from '../../../../lib/regional-pricing';
import {paymentMatchesPlan} from '../../../../lib/hosted-checkout';
import {checkRateLimit,enforceSameOrigin} from '../../../../lib/api-security';
import {buildPaddleTransactionPayload,createPaddleLiveTransaction} from '../../../../lib/paddle-checkout';

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:'paddle-live-checkout',limit:8,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    if(body?.consent!==true)return Response.json({error:'Sözleşme ve hizmet başlangıcı onayı gerekli.'},{status:400});
    const access=await verifyPaymentAccessToken(body?.token||'');
    if(!access)return Response.json({error:'Ödeme bağlantısı geçersiz veya süresi dolmuş.'},{status:401});
    if(!SERVICE_CODES.includes(access.service))return Response.json({error:'Paddle ödemesi için hizmete bağlı ödeme bağlantısı gerekli.'},{status:400});
    const profile=await getClientProfile(access.clientId);
    const plan=servicePrice({service:access.service,country:profile?.country||'Türkiye',language:'tr'});
    const payment=await getOrCreatePaymentIntent(access.clientId,plan.name,plan.setupAmount,plan.monthlyAmount,plan.currency);
    if(!paymentMatchesPlan(payment,plan))return Response.json({error:'Ödeme kaydı paketle eşleşmiyor.'},{status:409});
    if(!['pending','customer-reported'].includes(payment.status))return Response.json({error:'Bu ödeme için yeni kart işlemi başlatılamaz.'},{status:409});
    const apiKey=process.env.PADDLE_LIVE_API_KEY||'';
    const clientToken=process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN||'';
    if(!apiKey||!clientToken)return Response.json({error:'Paddle canlı ödeme yapılandırması tamamlanmamış.'},{status:503});
    const payload=buildPaddleTransactionPayload({
      plan,payment,clientId:access.clientId,
      taxCategory:process.env.PADDLE_LIVE_TAX_CATEGORY||'professional-services'
    });
    const transaction=await createPaddleLiveTransaction({apiKey,payload});
    await recordPaymentConsent(payment.id,'2026-10-16');
    return Response.json({transactionId:transaction.transactionId,status:transaction.status});
  }catch(error){
    console.error('Paddle live checkout creation failed',String(error?.message||error).slice(0,120));
    return Response.json({error:'Paddle güvenli ödeme oturumu hazırlanamadı.'},{status:502});
  }
}
