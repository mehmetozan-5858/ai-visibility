import {getClientCredential} from "../../../../lib/client-credentials";
import {verifyPaymentAccessToken} from "../../../../lib/admin-auth";
import {getClientAccount} from "../../../../lib/repository";
import {createVerificationCode,sendVerificationEmail} from "../../../../lib/email-verification";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"client-send-code",limit:8,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    const access=await verifyPaymentAccessToken(body?.token||"");
    if(!access)return Response.json({error:"Bağlantı geçersiz veya süresi dolmuş."},{status:401});
    if(await getClientCredential(access.clientId))return Response.json({error:"Hesap zaten oluşturulmuş. Şifre sıfırlamayı kullanın."},{status:409});
    const account=await getClientAccount(access.clientId);
    if(!account||(account.payments||[]).every(x=>x.status!=="paid"))return Response.json({error:"Ödeme onayı gerekli."},{status:403});
    const v=await createVerificationCode(access.clientId,body?.email);
    await sendVerificationEmail(v.email,v.code);
    return Response.json({ok:true});
  }catch(e){
    const m=String(e?.message||"");
    if(m==="invalid-email")return Response.json({error:"Geçerli bir e-posta adresi girin."},{status:400});
    if(m==="verification-rate-limit")return Response.json({error:"Yeni kod istemeden önce 60 saniye bekleyin."},{status:429});
    if(m==="email-provider-not-configured")return Response.json({error:"E-posta gönderimi henüz yapılandırılmadı."},{status:503});
    if(m.startsWith("email-send-failed"))return Response.json({error:"Doğrulama e-postası gönderilemedi."},{status:503});
    return Response.json({error:"Kod gönderilemedi."},{status:500});
  }
}
