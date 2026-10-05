import {cookies} from "next/headers";
import {verifyClientToken} from "../../../../lib/admin-auth";
import {getClientAccount} from "../../../../lib/repository";
import {enforceSameOrigin,checkRateLimit} from "../../../../lib/api-security";

export async function POST(req){
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:"customer-message",limit:5,windowMs:10*60*1000});if(limited)return limited;
 try{
  const store=await cookies(),session=await verifyClientToken(store.get("ai_client")?.value||"");
  if(!session)return Response.json({error:"Müşteri oturumu geçersiz."},{status:401});
  const account=await getClientAccount(session.clientId);if(!account)return Response.json({error:"Müşteri bulunamadı."},{status:404});
  const body=await req.json(),message=String(body?.message||"").trim().slice(0,3000);
  if(message.length<3)return Response.json({error:"Lütfen mesajınızı yazın."},{status:400});
  const to=process.env.ADMIN_RECOVERY_EMAIL,from=process.env.RESEND_FROM_EMAIL,key=process.env.RESEND_API_KEY;
  if(!to||!from||!key)return Response.json({error:"Mesaj e-posta servisi henüz yapılandırılmadı."},{status:503});
  const esc=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({from,to:[to],subject:"AI Visibility müşteri mesajı — "+account.client.name,html:`<div style="font-family:Arial,sans-serif"><h2>Yeni müşteri mesajı / talebi</h2><p><b>Müşteri:</b> ${esc(account.client.name)}</p><p><b>Site:</b> ${esc(account.client.domain)}</p><p><b>Tarih:</b> ${esc(new Date().toISOString())}</p><hr/><p style="white-space:pre-wrap">${esc(message)}</p></div>`})});
  if(!r.ok)return Response.json({error:"Mesaj e-posta olarak gönderilemedi."},{status:502});
  return Response.json({ok:true,message:"Mesajınız iletildi."});
 }catch{return Response.json({error:"Mesaj gönderilemedi."},{status:500})}
}