import {addClient,findClientByIdentity,createScan,completeScan,getLatestCompletedScan,getOrCreatePaymentIntent,recordPaymentConsent,reportPayment,confirmPayment} from "../../../lib/repository";
import {createPaymentAccessToken} from "../../../lib/admin-auth";

const TEST_NAME="AI Visibility Test Müşteri";
const TEST_DOMAIN="test.ai-visibility.local";

export async function POST(){
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

    const payment=await getOrCreatePaymentIntent(client.id,"Test",1,1);
    await recordPaymentConsent(payment.id,"test-flow-2026-10-03");
    if(payment.status==="pending")await reportPayment(payment.id);
    const paid=await confirmPayment(payment.id,{plan:"Test",setupAmount:1,monthlyAmount:1});
    const token=await createPaymentAccessToken(client.id,7200);

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
