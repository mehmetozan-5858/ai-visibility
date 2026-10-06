import {deliverOnce} from "../../../lib/email-delivery";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";
import {getDatabaseUrl} from "../../../lib/db";

async function db(fn){const {Pool}=await import("pg");const p=new Pool({connectionString:getDatabaseUrl()});try{return await fn(p)}finally{await p.end()}}
function safeEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||""))}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:"sales-send",limit:10,windowMs:60*60*1000});if(limited)return limited;
 try{
  const {leadId,approve}=await req.json();if(!leadId||approve!==true)return Response.json({error:"Açık gönderim onayı gerekli."},{status:400});
  const lead=await db(async p=>(await p.query("SELECT * FROM discovered_leads WHERE id=$1 AND status='communication-queued' AND communication_status='awaiting-approval' LIMIT 1",[leadId])).rows[0]);
  if(!lead)return Response.json({error:"Onay bekleyen iletişim kaydı bulunamadı."},{status:404});
  if(lead.contact_channel!=="email"||!lead.contact_verified||!safeEmail(lead.contact_value))return Response.json({error:"Yalnız doğrulanmış kurumsal e-posta gönderilebilir."},{status:400});
  const key=process.env.RESEND_API_KEY,from=process.env.SALES_FROM_EMAIL;
  if(!key||!from)return Response.json({error:"Gönderim altyapısı hazır fakat RESEND_API_KEY ve SALES_FROM_EMAIL yapılandırılmalı."},{status:503});
  const payload=lead.communication_payload||{};const body=[payload.message,payload.cta,payload.offer?.amount?("Önerilen paket: "+payload.offer.package+" · "+payload.offer.amount+" "+payload.offer.currency):""].filter(Boolean).join("\n\n");
  const data=await deliverOnce(`sales-first/${leadId}`,{from,to:[lead.contact_value],subject:payload.subject||"AI görünürlük ön değerlendirmesi",text:body,...(process.env.INBOUND_EMAIL_ADDRESS?{reply_to:process.env.INBOUND_EMAIL_ADDRESS}:{})},()=>db(async p=>p.query("UPDATE discovered_leads SET communication_status='sent',status='contacted',updated_at=NOW() WHERE id=$1",[leadId])));
  return Response.json({ok:true,messageId:data.id||"",status:"sent"})
 }catch(e){return Response.json({error:"Gönderim gerçekleştirilemedi.",detail:String(e?.message||e).slice(0,160)},{status:500})}
}
