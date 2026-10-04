import {getSalesCandidates,getOrCreatePaymentIntent,reportPayment,getPaymentById,recordPaymentConsent,getClientAccount} from "../../../lib/repository";
import {getClientProfile} from "../../../lib/client-profile";
import {verifyPaymentAccessToken} from "../../../lib/admin-auth";
import {priceFor,formatMoney} from "../../../lib/regional-pricing";

export async function GET(req){
  try{
    const url=new URL(req.url);
    const token=url.searchParams.get("token")||"";
    const access=await verifyPaymentAccessToken(token);
    if(!access)return Response.json({error:"Ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    const candidates=await getSalesCandidates(50),client=candidates.find(x=>x.id===access.clientId)||null;
    if(!client)return Response.json({error:"Müşteri bulunamadı."},{status:404});
    const profile=await getClientProfile(client.id).catch(()=>null);
    const selectedCountry=String(url.searchParams.get("country")||profile?.country||"Türkiye").trim();
    const plan=priceFor({score:Number(client.score)||0,country:selectedCountry});
    const locale=plan.currency==="TRY"?"tr-TR":plan.currency==="GBP"?"en-GB":plan.currency==="EUR"?"en-IE":"en-US";
    plan.setup=formatMoney(plan.setupAmount,plan.currency,locale);
    plan.monthly=formatMoney(plan.monthlyAmount,plan.currency,locale)+(plan.currency==="TRY"?"/ay":"/mo");
    const account=await getClientAccount(client.id);
    const paidPayment=(account?.payments||[]).find(x=>x.status==="paid")||null;
    const payment=paidPayment||await getOrCreatePaymentIntent(client.id,plan.name,plan.setupAmount,plan.monthlyAmount);
    return Response.json({
      client,
      profile:{country:selectedCountry,city:profile?.city||"",sector:profile?.sector||""},
      plan,
      payment:{...payment,currency:plan.currency},
      bank:{bankName:process.env.PAYMENT_BANK_NAME||"",accountHolder:process.env.PAYMENT_ACCOUNT_HOLDER||"",iban:process.env.PAYMENT_IBAN||""},
      transferReady:Boolean(process.env.PAYMENT_BANK_NAME&&process.env.PAYMENT_ACCOUNT_HOLDER&&process.env.PAYMENT_IBAN),
      cardReady:Boolean(process.env.PAYTR_MERCHANT_ID&&process.env.PAYTR_MERCHANT_KEY&&process.env.PAYTR_MERCHANT_SALT)
    });
  }catch(e){return Response.json({error:"Odeme bilgileri okunamadi.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}

// env-refresh: redeploy after payment variables were configured

export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.paymentId||!body?.token)return Response.json({error:"Ödeme kaydı veya güvenli bağlantı eksik."},{status:400});
    if(body?.consent!==true)return Response.json({error:"Hizmet başlangıcı ve sözleşme onayı gereklidir."},{status:400});
    const access=await verifyPaymentAccessToken(body.token);
    if(!access)return Response.json({error:"Ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    const current=await getPaymentById(body.paymentId);
    if(!current||current.clientId!==access.clientId)return Response.json({error:"Bu ödeme bağlantısı bu kayıt için geçerli değil."},{status:403});
    await recordPaymentConsent(body.paymentId,"2026-10-02");
    const payment=await reportPayment(body.paymentId);
    if(!payment)return Response.json({error:"Ödeme bildirimi alınamadı veya daha önce bildirildi."},{status:409});
    return Response.json({payment,message:"Ödeme bildiriminiz alındı. Banka kontrolünden sonra paket aktif edilecektir."});
  }catch(e){return Response.json({error:"Ödeme bildirimi alınamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
