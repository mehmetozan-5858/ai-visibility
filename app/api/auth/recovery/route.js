import {recoveryStatus,generateCode,sendRecoveryCode} from "../../../../lib/recovery-sender";
import {createResetRequest,verifyResetCode,finishReset,canRequestReset} from "../../../../lib/admin-password";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export const runtime="nodejs";

function json(data,init={}){
  const headers=new Headers(init.headers||{});headers.set("cache-control","no-store");
  return Response.json(data,{...init,headers});
}

export async function GET(){
  const channels=recoveryStatus();
  return json({channels,dualRequired:true,ready:Boolean(channels.email?.configured&&channels.phone?.configured)});
}

export async function POST(req){
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    const action=body?.action||"request";
    const status=recoveryStatus();
    if(!status.email?.configured||!status.phone?.configured){
      return json({error:"Yönetici kurtarma için e-posta ve telefon kanallarının ikisi de yapılandırılmalıdır."},{status:503});
    }
    if(action==="request"){
      const limited=checkRateLimit(req,{bucket:"admin-recovery-request",limit:5,windowMs:15*60*1000});if(limited)return limited;
      const channel=body?.channel;
      if(!["email","phone"].includes(channel))return json({error:"Geçersiz kurtarma kanalı."},{status:400});
      if(!(await canRequestReset(channel)))return json({error:"Yeni kod istemeden önce 60 saniye bekleyin."},{status:429});
      const code=generateCode();
      await sendRecoveryCode(channel,code);
      const reset=await createResetRequest(channel,code);
      return json({requestId:reset.id,expiresAt:reset.expiresAt,masked:status[channel].masked,channel});
    }
    if(action==="reset"){
      const limited=checkRateLimit(req,{bucket:"admin-recovery-reset",limit:12,windowMs:15*60*1000});if(limited)return limited;
      const emailRequestId=String(body?.emailRequestId||"");
      const phoneRequestId=String(body?.phoneRequestId||"");
      const emailCode=String(body?.emailCode||"").replace(/\D/g,"").slice(0,6);
      const phoneCode=String(body?.phoneCode||"").replace(/\D/g,"").slice(0,6);
      const password=String(body?.password||"");
      if(!emailRequestId||!phoneRequestId||emailCode.length!==6||phoneCode.length!==6)return json({error:"E-posta ve SMS doğrulama kodlarının ikisi de gereklidir."},{status:400});
      if(password.length<10)return json({error:"Yeni şifre en az 10 karakter olmalı."},{status:400});
      const emailCheck=await verifyResetCode(emailRequestId,emailCode);
      const phoneCheck=await verifyResetCode(phoneRequestId,phoneCode);
      const invalid=(check,label)=>{
        if(check.ok)return null;
        const msg=check.reason==="expired"?"kodun süresi doldu":check.reason==="locked"?"çok fazla hatalı deneme yapıldı":check.reason==="used"?"kod daha önce kullanıldı":"kod yanlış";
        return label+" "+msg+".";
      };
      const emailError=invalid(emailCheck,"E-posta");
      const phoneError=invalid(phoneCheck,"SMS");
      if(emailError||phoneError)return json({error:[emailError,phoneError].filter(Boolean).join(" ")},{status:401});
      if(emailCheck.channel!=="email"||phoneCheck.channel!=="phone")return json({error:"Kurtarma kanalı doğrulaması başarısız."},{status:401});
      await finishReset([emailRequestId,phoneRequestId],password);
      return json({ok:true,message:"E-posta ve telefon doğrulandı. Şifreniz yenilendi."});
    }
    return json({error:"Geçersiz işlem."},{status:400});
  }catch(e){
    return json({error:"Şifre kurtarma işlemi tamamlanamadı."},{status:500});
  }
}
