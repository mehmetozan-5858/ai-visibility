import {getClientCredentialByEmail,withClientCredentialDatabase,hashPassword} from "../../../../lib/client-credentials";
import {createVerificationCode,sendVerificationEmail} from "../../../../lib/email-verification";
import {completeCustomerPasswordReset} from "../../../../lib/customer-password-reset";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const requestMessage="Bu e-posta ile kayıtlı hesap varsa doğrulama kodu gönderildi.";

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"client-password-reset",limit:10,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    if(!body||typeof body!=="object"||Array.isArray(body)||!["request","confirm"].includes(body.action))return json({error:"Geçersiz işlem."},400);
    const email=String(body?.email||"").trim().toLowerCase();
    if(!email.includes("@"))return json({error:"Geçerli bir e-posta girin."},400);
    const credential=await getClientCredentialByEmail(email);
    if(!credential){
      return body.action==="request"?json({ok:true,message:requestMessage}):json({error:"Kod geçersiz veya süresi dolmuş."},400);
    }
    if(body?.action==="request"){
      const {code}=await createVerificationCode(credential.clientId,email);
      await sendVerificationEmail(email,code);
      return json({ok:true,message:requestMessage});
    }
    if(body?.action==="confirm"){
      if(String(body?.password||"").length<10)return json({error:"Yeni şifre en az 10 karakter olmalıdır."},400);
      await withClientCredentialDatabase(pool=>completeCustomerPasswordReset(pool,{clientId:credential.clientId,email,code:String(body?.code||""),password:body.password,hashPassword}));
      return json({ok:true,message:"Şifreniz yenilendi. Artık giriş yapabilirsiniz."});
    }
    return json({error:"Geçersiz işlem."},400);
  }catch(e){
    const m=String(e?.message||"");
    if(e instanceof SyntaxError)return json({error:"Geçersiz işlem."},400);
    if(m==="verification-invalid-or-expired")return json({error:"Kod geçersiz veya süresi dolmuş."},400);
    if(m==="verification-rate-limit")return json({error:"Yeni kod istemeden önce 60 saniye bekleyin."},429);
    if(m.startsWith("email-send-failed")||m==="email-provider-not-configured")return json({error:"Doğrulama e-postası gönderilemedi."},503);
    return json({error:"Şifre sıfırlama işlemi tamamlanamadı."},500);
  }
}
