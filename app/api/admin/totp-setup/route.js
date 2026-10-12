import {verifyAdminPassword} from "../../../../lib/admin-password";
import {verifyTotp,totpUri} from "../../../../lib/admin-totp";
import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";
export const runtime="nodejs";
export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"admin-totp-setup",limit:6,windowMs:15*60*1000});if(limited)return limited;
  try{
    const {password,code,action}=await req.json();
    if(!await verifyAdminPassword(password||""))return Response.json({error:"Yönetici şifresi hatalı."},{status:401});
    const secret=process.env.ADMIN_RECOVERY_TOTP_SECRET||"";
    if(!secret)return Response.json({error:"Authenticator anahtarı henüz kurulmadı."},{status:503});
    if(action==="show")return Response.json({uri:totpUri(secret),secret},{headers:{"cache-control":"no-store"}});
    if(action==="verify")return Response.json({verified:verifyTotp(secret,code)});
    return Response.json({error:"Geçersiz işlem."},{status:400});
  }catch{return Response.json({error:"İşlem tamamlanamadı."},{status:500})}
}
