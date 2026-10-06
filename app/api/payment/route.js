import {shopierProduct,paymentMatchesPlan} from "../../../lib/hosted-checkout";
import {bankTransfer} from "../../../lib/bank-transfer";
import {getClientCredential} from "../../../lib/client-credentials";
import {getSalesCandidates,getOrCreatePaymentIntent,reportPayment,getPaymentById,recordPaymentConsent,getClientAccount} from "../../../lib/repository";
import {getClientProfile} from "../../../lib/client-profile";
import {verifyPaymentAccessToken} from "../../../lib/admin-auth";
import {servicePrice,pricingCatalog,formatMoney,SERVICE_CODES,BUNDLE_DISCOUNT_RANGE} from "../../../lib/regional-pricing";

function languageFrom(req){
  return String(req.headers.get("accept-language")||"").toLowerCase().startsWith("en")?"en":"tr";
}
function formatPlan(plan,lang){
  const locale=plan.currency==="TRY"?"tr-TR":plan.currency==="GBP"?"en-GB":plan.currency==="EUR"?"en-IE":"en-US";
  const zero=formatMoney(0,plan.currency,locale);
  return {
    ...plan,
    setup:plan.setupAmount?formatMoney(plan.setupAmount,plan.currency,locale):zero,
    monthly:plan.monthlyAmount?formatMoney(plan.monthlyAmount,plan.currency,locale)+(lang==="tr"?"/ay":"/mo"):zero,
    displayAmount:formatMoney(plan.amount,plan.currency,locale)
  };
}

export async function GET(req){
  try{
    const url=new URL(req.url);
    const token=url.searchParams.get("token")||"";
    const access=await verifyPaymentAccessToken(token);
    if(!access)return Response.json({error:"Ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    const account=await getClientAccount(access.clientId);
    const client=account?.client||null;
    if(!client)return Response.json({error:"Müşteri bulunamadı."},{status:404});
    const profile=await getClientProfile(client.id).catch(()=>null);
    const selectedCountry=String(profile?.country||"Türkiye").trim();
    const lang=languageFrom(req);
    const tokenService=String(access?.service||"");
    const requestedService=tokenService||String(url.searchParams.get("service")||"business-diagnosis");
    if(tokenService&&!SERVICE_CODES.includes(tokenService))return Response.json({error:"Ödeme bağlantısındaki hizmet geçersiz."},{status:400});
    const service=SERVICE_CODES.includes(requestedService)?requestedService:"business-diagnosis";
    const plan=formatPlan(servicePrice({service,country:selectedCountry,language:lang}),lang);
    const catalog=pricingCatalog({country:selectedCountry,language:lang}).map(x=>formatPlan(x,lang));
    const canonicalPlan=servicePrice({service,country:selectedCountry,language:"tr"});
    const paidPayment=(account?.payments||[]).find(x=>x.status==="paid"&&paymentMatchesPlan(x,canonicalPlan))||null;
    const payment=paidPayment||await getOrCreatePaymentIntent(client.id,canonicalPlan.name,plan.setupAmount,plan.monthlyAmount,plan.currency);
    const tryRail=plan.currency==="TRY";
    const bank=bankTransfer(plan.currency);
    const hostedReady=Boolean(tokenService&&shopierProduct({...plan,code:service}));
    return Response.json({
      client,
      accountCreated:Boolean(await getClientCredential(client.id)),
      hostedReady,
      profile:{country:selectedCountry,city:profile?.city||"",sector:profile?.sector||""},
      plan,
      pricingCatalog:catalog,
      bundleDiscountRange:BUNDLE_DISCOUNT_RANGE,
      payment:{...payment,currency:plan.currency},
      bank:bank||{},
      transferReady:Boolean(bank),
      cardReady:tryRail&&Boolean(process.env.PAYTR_MERCHANT_ID&&process.env.PAYTR_MERCHANT_KEY&&process.env.PAYTR_MERCHANT_SALT),
      internationalPaymentPending:!tryRail&&!bank&&!hostedReady
    });
  }catch(e){return Response.json({error:"Odeme bilgileri okunamadi.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}

export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.paymentId||!body?.token)return Response.json({error:"Ödeme kaydı veya güvenli bağlantı eksik."},{status:400});
    if(body?.consent!==true)return Response.json({error:"Hizmet başlangıcı ve sözleşme onayı gereklidir."},{status:400});
    const access=await verifyPaymentAccessToken(body.token);
    if(!access)return Response.json({error:"Ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    if(access.service&&!SERVICE_CODES.includes(access.service))return Response.json({error:"Ödeme bağlantısındaki hizmet geçersiz."},{status:400});
    const current=await getPaymentById(body.paymentId);
    if(!current||current.clientId!==access.clientId)return Response.json({error:"Bu ödeme bağlantısı bu kayıt için geçerli değil."},{status:403});
    if(access.service){const profile=await getClientProfile(access.clientId),plan=servicePrice({service:access.service,country:profile?.country||"Türkiye",language:"tr"});if(!paymentMatchesPlan(current,plan))return Response.json({error:"Ödeme kaydı bağlantıdaki hizmetle eşleşmiyor."},{status:403});}
    await recordPaymentConsent(body.paymentId,"2026-10-02");
    const payment=await reportPayment(body.paymentId);
    if(!payment)return Response.json({error:"Ödeme bildirimi alınamadı veya daha önce bildirildi."},{status:409});
    return Response.json({payment,message:"Ödeme bildiriminiz alındı. Banka kontrolünden sonra paket aktif edilecektir."});
  }catch(e){return Response.json({error:"Ödeme bildirimi alınamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
