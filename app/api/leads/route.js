import {createLead,listLeads,updateLeadStatus,getLead} from "../../../lib/leads";
import {addClient,findClientByIdentity} from "../../../lib/repository";
import {upsertClientProfile} from "../../../lib/client-profile";
import {createPaymentAccessToken} from "../../../lib/admin-auth";
import {verifyAdminToken} from "../../../lib/admin-auth";
import {checkRateLimit,enforceSameOrigin} from "../../../lib/api-security";

async function isAdmin(req){
  const token=req.cookies.get("ai_admin")?.value||"";
  return await verifyAdminToken(token);
}

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"public-lead",limit:8,windowMs:30*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    const lead=await createLead(body||{});
    return Response.json({ok:true,lead:{id:lead.id,status:lead.status}});
  }catch(e){
    const code=e?.message==="invalid-lead"?400:500;
    return Response.json({error:code===400?"Ad, işletme adı ve geçerli e-posta zorunludur.":"Başvuru kaydedilemedi."},{status:code});
  }
}

export async function GET(req){
  if(!await isAdmin(req))return Response.json({error:"Yetkisiz erişim."},{status:401});
  try{return Response.json({leads:await listLeads(150)})}
  catch{return Response.json({error:"Lead listesi alınamadı."},{status:500})}
}

export async function PATCH(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  if(!await isAdmin(req))return Response.json({error:"Yetkisiz erişim."},{status:401});
  try{
    const body=await req.json();
    const lead=await updateLeadStatus(body?.id,body?.status);
    if(!lead)return Response.json({error:"Lead bulunamadı."},{status:404});
    return Response.json({ok:true,lead});
  }catch(e){return Response.json({error:e?.message==="invalid-lead-status"?"Geçersiz durum.":"Lead güncellenemedi."},{status:400})}
}

export async function PUT(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  if(!await isAdmin(req))return Response.json({error:"Yetkisiz erişim."},{status:401});
  try{
    const body=await req.json();const lead=await getLead(body?.id);if(!lead)return Response.json({error:"Lead bulunamadı."},{status:404});
    let client=await findClientByIdentity(lead.businessName,lead.website||"");
    if(!client)client=await addClient({name:lead.businessName,domain:lead.website||("lead-"+lead.id.slice(0,8)),plan:"Starter",competitors:[]});
    if(!client?.id)return Response.json({error:"Müşteri oluşturulamadı."},{status:500});
    await upsertClientProfile(client.id,{country:lead.country,city:lead.city,sector:lead.sector,phone:lead.phone,contactEmail:lead.email,requestedService:lead.requestedService});
    await updateLeadStatus(lead.id,"qualified");
    const service=["business-diagnosis","business-solution","business-monitoring"].includes(lead.requestedService)?lead.requestedService:"business-diagnosis";
    const token=await createPaymentAccessToken(client.id,604800,service);
    return Response.json({ok:true,clientId:client.id,service,paymentUrl:"/odeme?token="+encodeURIComponent(token)});
  }catch(e){return Response.json({error:"Başvuru müşteriye dönüştürülemedi.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
