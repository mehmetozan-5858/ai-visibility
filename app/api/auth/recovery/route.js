import {recoveryStatus,generateCode,sendRecoveryCode,verifyRecoveryTotp} from "../../../../lib/recovery-sender";
import {createResetRequest,verifyResetCode,finishReset,canRequestReset} from "../../../../lib/admin-password";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export const runtime="nodejs";

function json(data,init={}){
  const headers=new Headers(init.headers||{});headers.set("cache-control","no-store");
  return Response.json(data,{...init,headers});
}

export async function GET(){
  const channels=recoveryStatus();
  return json({channels,dualRequired:true,ready:Boolean(channels.email?.configured&&channels.totp?.configured)});
}

export async function POST(req){
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    const action=body?.action||"request";
    const status=recoveryStatus();
    if(!status.email?.configured||!status.totp?.configured){
      return json({error:"Yönetici kurtarma için e-posta ve Authenticator kanallarının ikisi de yapılandırılmalıdır."},{status:503});
    }
    if(action==="request"){
      const limited=checkRateLimit(req,{bucket:"admin-recovery-request",limit:5,windowMs:15*60*1000});if(limited)return limited;
      const channel=body?.channel;
      if(!["email","totp"].includes(channel))return json({error:"Geçersiz kurtarma kanalı."},{status:400});
      if(!(await canRequestReset(channel)))return json({error:"Yeni kod istemeden önce 60 saniye bekleyin."},{status:429});
      const code=channel==="email"?generateCode():String(body?.totpCode||"").replace(/\D/g,"").slice(0,6);
      if(channel==="totp"){
        const emailCheck=await verifyResetCode(String(body?.emailRequestId||""),String(body?.emailCode||""));
        if(!emailCheck.ok||emailCheck.channel!=="email"||!verifyRecoveryTotp(code))return json({error:"E-posta veya Authenticator kodu geçersiz."},{status:401});
      }else await sendRecoveryCode(channel,code);
      const reset=await createResetRequest(channel,code);
      return json({requestId:reset.id,expiresAt:reset.expiresAt,masked:status[channel].masked,channel});
    }
    if(action==="reset"){
      const limited=checkRateLimit(req,{bucket:"admin-recovery-reset",limit:12,windowMs:15*60*1000});if(limited)return limited;
      const emailRequestId=String(body?.emailRequestId||"");
      const totpRequestId=String(body?.totpRequestId||"");
      const emailCode=String(body?.emailCode||"").replace(/\D/g,"").slice(0,6);
      const totpCode=String(body?.totpCode||"").replace(/\D/g,"").slice(0,6);
      const password=String(body?.password||"");
      if(!emailRequestId||!totpRequestId||emailCode.length!==6||totpCode.length!==6)return json({error:"E-posta ve Authenticator doğrulama kodlarının ikisi de gereklidir."},{status:400});
      if(password.length<10)return json({error:"Yeni şifre en az 10 karakter olmalı."},{status:400});
      const emailCheck=await verifyResetCode(emailRequestId,emailCode);
      const totpCheck=await verifyResetCode(totpRequestId,totpCode);
      const invalid=(check,label)=>{
        if(check.ok)return null;
        const msg=check.reason==="expired"?"kodun süresi doldu":check.reason==="locked"?"çok fazla hatalı deneme yapıldı":check.reason==="used"?"kod daha önce kullanıldı":"kod yanlış";
        return label+" "+msg+".";
      };
      const emailError=invalid(emailCheck,"E-posta");
      const totpError=invalid(totpCheck,"Authenticator");
      if(emailError||totpError)return json({error:[emailError,totpError].filter(Boolean).join(" ")},{status:401});
      if(emailCheck.channel!=="email"||totpCheck.channel!=="totp")return json({error:"Kurtarma kanalı doğrulaması başarısız."},{status:401});
      await finishReset([emailRequestId,totpRequestId],password);
      return json({ok:true,message:"E-posta ve Authenticator doğrulandı. Şifreniz yenilendi."});
    }
    return json({error:"Geçersiz işlem."},{status:400});
  }catch(e){
    return json({error:"Şifre kurtarma işlemi tamamlanamadı."},{status:500});
  }
}
