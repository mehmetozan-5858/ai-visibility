import {createAdminToken,authConfigured} from "../../../../lib/admin-auth";
import {verifyAdminPassword} from "../../../../lib/admin-password";
import {checkRateLimit,clearRateLimit,enforceSameOrigin} from "../../../../lib/api-security";

export async function POST(req){
  try{
    if(!authConfigured())return Response.json({error:"Yönetici girişi henüz yapılandırılmadı."},{status:503});
    const originError=enforceSameOrigin(req);if(originError)return originError;
    const limited=checkRateLimit(req,{bucket:"admin-login",limit:8,windowMs:15*60*1000});if(limited)return limited;
    const body=await req.json();
    if(!(await verifyAdminPassword(body?.password||"")))return Response.json({error:"Şifre yanlış."},{status:401});
    clearRateLimit(req,"admin-login");
    const token=await createAdminToken();
    const res=Response.json({ok:true});
    res.headers.append("Set-Cookie",`ai_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
    return res;
  }catch(e){return Response.json({error:"Giriş yapılamadı."},{status:500})}
}
export async function DELETE(){
  const res=Response.json({ok:true});
  res.headers.append("Set-Cookie","ai_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return res;
}
