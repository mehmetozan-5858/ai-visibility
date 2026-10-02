import {createAdminToken,authConfigured} from "../../../../lib/admin-auth";
import {verifyAdminPassword} from "../../../../lib/admin-password";
export async function POST(req){
  try{
    if(!authConfigured())return Response.json({error:"Yönetici girişi henüz yapılandırılmadı."},{status:503});
    const body=await req.json();
    if(!(await verifyAdminPassword(body?.password||"")))return Response.json({error:"Şifre yanlış."},{status:401});
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
