import {getClientCredentialByEmail,createOrUpdateClientCredential} from "../../../../lib/client-credentials";
import {createVerificationCode,sendVerificationEmail,verifyEmailCode} from "../../../../lib/email-verification";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"client-password-reset",limit:10,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    const email=String(body?.email||"").trim().toLowerCase();
    if(!email.includes("@"))return Response.json({error:"Geçerli bir e-posta girin."},{status:400});
    const credential=await getClientCredentialByEmail(email);
    if(!credential){
      return Response.json({ok:true,message:"Bu e-posta ile kayıtlı hesap varsa doğrulama kodu gönderildi."});
    }
    if(body?.action==="request"){
      const {code}=await createVerificationCode(credential.clientId,email);
      await sendVerificationEmail(email,code);
      return Response.json({ok:true,message:"6 haneli doğrulama kodu e-posta adresinize gönderildi."});
    }
    if(body?.action==="confirm"){
      if(String(body?.password||"").length<10)return Response.json({error:"Yeni şifre en az 10 karakter olmalıdır."},{status:400});
      const verified=await verifyEmailCode(credential.clientId,email,String(body?.code||""));
      if(!verified)return Response.json({error:"Kod geçersiz veya süresi dolmuş."},{status:400});
      await createOrUpdateClientCredential(credential.clientId,email,body.password);
      return Response.json({ok:true,message:"Şifreniz yenilendi. Artık giriş yapabilirsiniz."});
    }
    return Response.json({error:"Geçersiz işlem."},{status:400});
  }catch(e){
    const m=String(e?.message||"");
    if(m==="verification-rate-limit")return Response.json({error:"Yeni kod istemeden önce 60 saniye bekleyin."},{status:429});
    if(m.startsWith("email-send-failed")||m==="email-provider-not-configured")return Response.json({error:"Doğrulama e-postası gönderilemedi."},{status:503});
    return Response.json({error:"Şifre sıfırlama işlemi tamamlanamadı."},{status:500});
  }
}
