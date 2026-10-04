import {createOrUpdateClientCredential} from "../../../../lib/client-credentials";
import {createClientToken,verifyPaymentAccessToken} from "../../../../lib/admin-auth";
import {getClientAccount} from "../../../../lib/repository";
import {isEmailVerified} from "../../../../lib/email-verification";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"client-setup",limit:8,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    const access=await verifyPaymentAccessToken(body?.token||"");
    if(!access)return Response.json({error:"Güvenli ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    const account=await getClientAccount(access.clientId);
    if(!account)return Response.json({error:"Müşteri hesabı bulunamadı."},{status:404});
    const paid=(account.payments||[]).some(x=>x.status==="paid");
    if(!paid)return Response.json({error:"Müşteri hesabı yalnızca ödeme onaylandıktan sonra oluşturulabilir."},{status:403});
    const verified=await isEmailVerified(access.clientId,body?.email);
    if(!verified)return Response.json({error:"Önce e-posta adresinizi doğrulama koduyla doğrulayın."},{status:403});
    const credential=await createOrUpdateClientCredential(access.clientId,body?.email,body?.password);
    const session=await createClientToken(access.clientId);
    const res=Response.json({ok:true,clientId:access.clientId,email:credential.email});
    res.headers.append("Set-Cookie",`ai_client=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
    return res;
  }catch(e){
    const m=String(e?.message||"");
    if(m==="invalid-email")return Response.json({error:"Geçerli bir e-posta adresi girin."},{status:400});
    if(m==="password-too-short")return Response.json({error:"Şifre en az 10 karakter olmalıdır."},{status:400});
    return Response.json({error:"Müşteri hesabı oluşturulamadı."},{status:500});
  }
}
