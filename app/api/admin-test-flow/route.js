import crypto from "node:crypto";
import {servicePrice} from "../../../lib/regional-pricing";
import {addClient,findClientByIdentity,createScan,completeScan,getLatestCompletedScan,getOrCreatePaymentIntent,recordPaymentConsent,reportPayment,confirmPayment} from "../../../lib/repository";
import {createPaymentAccessToken} from "../../../lib/admin-auth";
import {createClientCredential,getClientCredential,resetClientPassword} from "../../../lib/client-credentials";
import {createVerificationCode,sendVerificationEmail,verifyEmailCode} from "../../../lib/email-verification";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";

const TEST_NAME="AI Visibility Test Müşteri";
const TEST_DOMAIN="test.ai-visibility.local";
const TEST_TERMS="test-flow-2026-10-13";

function testEmail(){return String(process.env.ADMIN_RECOVERY_EMAIL||"").trim().toLowerCase()}
function maskEmail(email=""){
  const [name,domain]=String(email).split("@");
  if(!name||!domain)return "";
  return `${name.slice(0,2)}***@${domain}`;
}

async function ensureTestClient(){
  let client=await findClientByIdentity(TEST_NAME,TEST_DOMAIN);
  if(!client)client=await addClient({name:TEST_NAME,domain:TEST_DOMAIN,plan:"Test",competitors:[]});
  return client;
}

async function ensureTestData(client){
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
  const price=servicePrice({service:"business-diagnosis",country:"Türkiye"});
  const payment=await getOrCreatePaymentIntent(client.id,price.name,price.setupAmount,0,"TRY");
  await recordPaymentConsent(payment.id,TEST_TERMS);
  if(payment.status==="pending")await reportPayment(payment.id);
  const paid=payment.status==="paid"?payment:await confirmPayment(payment.id);
  return {scan,payment:paid||payment};
}

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"admin-test-flow",limit:8,windowMs:10*60*1000});if(limited)return limited;
  try{
    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||"start");
    const email=testEmail();
    if(!email)return Response.json({error:"Kontrollü test için yönetici e-posta adresi yapılandırılmamış."},{status:503});

    if(action==="finish"){
      const client=await findClientByIdentity(TEST_NAME,TEST_DOMAIN);
      if(!client)return Response.json({error:"Önce müşteri E2E testini başlatın."},{status:409});
      const code=String(body?.code||"").replace(/\D/g,"").slice(0,6);
      if(code.length!==6)return Response.json({error:"6 haneli doğrulama kodunu girin."},{status:400});
      const verified=await verifyEmailCode(client.id,email,code);
      if(!verified)return Response.json({error:"Kod hatalı veya süresi dolmuş."},{status:400});

      const password=`AivTest!${crypto.randomBytes(12).toString("base64url")}`;
      const existing=await getClientCredential(client.id);
      if(existing)await resetClientPassword(client.id,email,password);
      else await createClientCredential(client.id,email,password);
      return Response.json({ok:true,action:"finish",email,password,client:{id:client.id,name:client.name,domain:client.domain}});
    }

    if(action!=="start")return Response.json({error:"Geçersiz test işlemi."},{status:400});
    const client=await ensureTestClient();
    const {scan,payment}=await ensureTestData(client);
    const token=await createPaymentAccessToken(client.id,7200,"business-diagnosis");
    const verification=await createVerificationCode(client.id,email);
    await sendVerificationEmail(verification.email,verification.code);

    return Response.json({
      ok:true,
      action:"start",
      emailMasked:maskEmail(email),
      expectedScore:Number(scan?.score),
      client:{id:client.id,name:client.name,domain:client.domain},
      paymentStatus:payment?.status||"",
      paymentUrl:"/odeme?token="+encodeURIComponent(token)
    });
  }catch(e){
    const m=String(e?.message||"");
    if(m==="verification-rate-limit")return Response.json({error:"Yeni kod istemeden önce 60 saniye bekleyin."},{status:429});
    if(m==="email-provider-not-configured"||m.startsWith("email-send-failed"))return Response.json({error:"Doğrulama e-postası gönderilemedi."},{status:503});
    return Response.json({error:"Test akışı hazırlanamadı.",detail:m.slice(0,220)},{status:500});
  }
}
