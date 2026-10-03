import {createLead,listLeads,updateLeadStatus} from "../../../lib/leads";
import {verifyAdminToken} from "../../../lib/admin-auth";

async function isAdmin(req){
  const token=req.cookies.get("ai_admin")?.value||"";
  return await verifyAdminToken(token);
}

export async function POST(req){
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
  if(!await isAdmin(req))return Response.json({error:"Yetkisiz erişim."},{status:401});
  try{
    const body=await req.json();
    const lead=await updateLeadStatus(body?.id,body?.status);
    if(!lead)return Response.json({error:"Lead bulunamadı."},{status:404});
    return Response.json({ok:true,lead});
  }catch(e){return Response.json({error:e?.message==="invalid-lead-status"?"Geçersiz durum.":"Lead güncellenemedi."},{status:400})}
}
