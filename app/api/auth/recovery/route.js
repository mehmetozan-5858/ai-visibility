import {recoveryStatus,generateCode,sendRecoveryCode} from "../../../../lib/recovery-sender";
import {createResetRequest,verifyResetCode,finishReset} from "../../../../lib/admin-password";

export const runtime="nodejs";

export async function GET(){
  return Response.json({channels:recoveryStatus()},{headers:{"cache-control":"no-store"}});
}

export async function POST(req){
  try{
    const body=await req.json();
    const action=body?.action||"request";
    if(action==="request"){
      const channel=body?.channel;
      const status=recoveryStatus();
      if(!status[channel]?.configured)return Response.json({error:"Bu kurtarma yöntemi henüz yapılandırılmadı."},{status:503});
      const code=generateCode();
      await sendRecoveryCode(channel,code);
      const reset=await createResetRequest(channel,code);
      return Response.json({requestId:reset.id,expiresAt:reset.expiresAt,masked:status[channel].masked});
    }
    if(action==="reset"){
      const requestId=String(body?.requestId||"");
      const code=String(body?.code||"").replace(/\D/g,"").slice(0,6);
      const password=String(body?.password||"");
      if(!requestId||code.length!==6)return Response.json({error:"Doğrulama kodu eksik veya hatalı."},{status:400});
      if(password.length<10)return Response.json({error:"Yeni şifre en az 10 karakter olmalı."},{status:400});
      const check=await verifyResetCode(requestId,code);
      if(!check.ok){
        const msg=check.reason==="expired"?"Kodun süresi doldu.":check.reason==="locked"?"Çok fazla hatalı deneme yapıldı. Yeni kod isteyin.":check.reason==="used"?"Bu kod daha önce kullanıldı.":"Kod yanlış.";
        return Response.json({error:msg},{status:401});
      }
      await finishReset(requestId,password);
      return Response.json({ok:true,message:"Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz."});
    }
    return Response.json({error:"Geçersiz işlem."},{status:400});
  }catch(e){
    return Response.json({error:"Şifre kurtarma işlemi tamamlanamadı.",detail:String(e?.message||e).slice(0,180)},{status:500});
  }
}
