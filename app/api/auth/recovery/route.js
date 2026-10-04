import {recoveryStatus,generateCode,sendRecoveryCode} from "../../../../lib/recovery-sender";
import {createResetRequest,verifyResetCode,finishReset,canRequestReset} from "../../../../lib/admin-password";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export const runtime="nodejs";

function json(data,init={}){
  const headers=new Headers(init.headers||{});headers.set("cache-control","no-store");
  return Response.json(data,{...init,headers});
}

export async function GET(){
  return json({channels:recoveryStatus()});
}

export async function POST(req){
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    const action=body?.action||"request";
    if(action==="request"){
      const limited=checkRateLimit(req,{bucket:"admin-recovery-request",limit:5,windowMs:15*60*1000});if(limited)return limited;
      const channel=body?.channel;
      const status=recoveryStatus();
      if(!status[channel]?.configured)return json({error:"Bu kurtarma yöntemi henüz yapılandırılmadı."},{status:503});
      if(!(await canRequestReset(channel)))return json({error:"Yeni kod istemeden önce 60 saniye bekleyin."},{status:429});
      const code=generateCode();
      await sendRecoveryCode(channel,code);
      const reset=await createResetRequest(channel,code);
      return json({requestId:reset.id,expiresAt:reset.expiresAt,masked:status[channel].masked});
    }
    if(action==="reset"){
      const limited=checkRateLimit(req,{bucket:"admin-recovery-reset",limit:12,windowMs:15*60*1000});if(limited)return limited;
      const requestId=String(body?.requestId||"");
      const code=String(body?.code||"").replace(/\D/g,"").slice(0,6);
      const password=String(body?.password||"");
      if(!requestId||code.length!==6)return json({error:"Doğrulama kodu eksik veya hatalı."},{status:400});
      if(password.length<10)return json({error:"Yeni şifre en az 10 karakter olmalı."},{status:400});
      const check=await verifyResetCode(requestId,code);
      if(!check.ok){
        const msg=check.reason==="expired"?"Kodun süresi doldu.":check.reason==="locked"?"Çok fazla hatalı deneme yapıldı. Yeni kod isteyin.":check.reason==="used"?"Bu kod daha önce kullanıldı.":"Kod yanlış.";
        return json({error:msg},{status:401});
      }
      await finishReset(requestId,password);
      return json({ok:true,message:"Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz."});
    }
    return json({error:"Geçersiz işlem."},{status:400});
  }catch(e){
    return json({error:"Şifre kurtarma işlemi tamamlanamadı."},{status:500});
  }
}
