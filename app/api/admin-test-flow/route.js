import {servicePrice} from "../../../lib/regional-pricing";
import {addClient,findClientByIdentity,createScan,completeScan,getLatestCompletedScan,getOrCreatePaymentIntent,recordPaymentConsent,reportPayment,confirmPayment} from "../../../lib/repository";
import {createPaymentAccessToken} from "../../../lib/admin-auth";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";

const TEST_NAME="AI Visibility Test Müşteri";
const TEST_DOMAIN="test.ai-visibility.local";

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"admin-test-flow",limit:6,windowMs:10*60*1000});if(limited)return limited;
  try{
    let client=await findClientByIdentity(TEST_NAME,TEST_DOMAIN);
    if(!client){
      client=await addClient({name:TEST_NAME,domain:TEST_DOMAIN,plan:"Test",competitors:[]});
    }

    let scan=await getLatestCompletedScan(client.id);
    if(!scan){
      const created=await createScan(client.id,["AI Visibility güvenli test akışı"]);
      scan=await completeScan(created.id,[{
        provider:"Test Provider",
        score:42,
        summary:"Yalnızca ödeme ve müşteri portalı uçtan uca testi için oluşturulmuş test taramasıdır.",
        findings:["Test müşteri kaydı gerçek müşteri verisi içermez."],
        recommendations:["Müşteri hesabı ve veri izolasyonu akışını doğrula."]
      }]);
    }

    const payment=await getOrCreatePaymentIntent(client.id,servicePrice({service:"business-diagnosis",country:"Türkiye"}).name,servicePrice({service:"business-diagnosis",country:"Türkiye"}).setupAmount,0,"TRY");
    await recordPaymentConsent(payment.id,"test-flow-2026-10-03");
    if(payment.status==="pending")await reportPayment(payment.id);
    const paid=await confirmPayment(payment.id);
    const token=await createPaymentAccessToken(client.id,7200,"business-diagnosis");

    return Response.json({
      ok:true,
      client:{id:client.id,name:client.name,domain:client.domain},
      payment:paid||payment,
      paymentUrl:"/odeme?token="+encodeURIComponent(token)
    });
  }catch(e){
    return Response.json({error:"Test akışı hazırlanamadı.",detail:String(e?.message||e).slice(0,220)},{status:500});
  }
}
