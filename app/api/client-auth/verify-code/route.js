import {getClientCredential} from "../../../../lib/client-credentials";
import {verifyPaymentAccessToken} from "../../../../lib/admin-auth";
import {verifyEmailCode} from "../../../../lib/email-verification";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"client-verify-code",limit:12,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    const access=await verifyPaymentAccessToken(body?.token||"");
    if(!access)return Response.json({error:"Bağlantı geçersiz veya süresi dolmuş."},{status:401});
    if(await getClientCredential(access.clientId))return Response.json({error:"Hesap zaten oluşturulmuş. Şifre sıfırlamayı kullanın."},{status:409});
    const verified=await verifyEmailCode(access.clientId,body?.email,body?.code);
    if(!verified)return Response.json({error:"Kod hatalı veya süresi dolmuş."},{status:400});
    return Response.json({ok:true,email:verified.email});
  }catch{
    return Response.json({error:"Kod doğrulanamadı."},{status:500});
  }
}
