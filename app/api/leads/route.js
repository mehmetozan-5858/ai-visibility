import {createLead,listLeads,updateLeadStatus,getLead} from "../../../lib/leads";
import {addClient,findClientByIdentity} from "../../../lib/repository";
import {upsertClientProfile} from "../../../lib/client-profile";
import {createPaymentAccessToken,verifyAdminToken} from "../../../lib/admin-auth";
import {checkRateLimit,enforceSameOrigin} from "../../../lib/api-security";

async function isAdmin(req){
  const token=req.cookies.get("ai_admin")?.value||"";
  return await verifyAdminToken(token);
}

function json(body,status=200){return Response.json(body,{status,headers:{"Cache-Control":"no-store"}})}
async function readObject(req){
  const body=await req.json();
  if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("invalid-request");
  return body;
}

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"public-lead",limit:10,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await readObject(req);
    const lead=await createLead(body||{});
    return json({ok:true,lead:{id:lead.id,status:lead.status}});
  }catch(e){
    const code=e instanceof SyntaxError||["invalid-lead","invalid-request"].includes(e?.message)?400:500;
    return json({error:code===400?"Ad, işletme adı ve geçerli e-posta zorunludur.":"Başvuru kaydedilemedi."},code);
  }
}

export async function GET(req){
  if(!await isAdmin(req))return Response.json({error:"Yetkisiz erişim."},{status:401});
  try{return json({leads:await listLeads(150)})}
  catch{return json({error:"Lead listesi alınamadı."},500)}
}

export async function PATCH(req){
  if(!await isAdmin(req))return Response.json({error:"Yetkisiz erişim."},{status:401});
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"admin-lead-status",limit:30,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await readObject(req);
    const lead=await updateLeadStatus(body?.id,body?.status);
    if(!lead)return Response.json({error:"Lead bulunamadı."},{status:404});
    return json({ok:true,lead});
  }catch(e){const status=e instanceof SyntaxError||["invalid-lead-status","invalid-request"].includes(e?.message)?400:500;return json({error:e?.message==="invalid-lead-status"?"Geçersiz durum.":"Lead güncellenemedi."},status)}
}

export async function PUT(req){
  if(!await isAdmin(req))return Response.json({error:"Yetkisiz erişim."},{status:401});
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"admin-lead-convert",limit:10,windowMs:15*60*1000});if(limited)return limited;
  try{
    const body=await readObject(req);const lead=await getLead(body?.id);if(!lead)return json({error:"Lead bulunamadı."},404);
    let client=await findClientByIdentity(lead.businessName,lead.website||"");
    if(!client)client=await addClient({name:lead.businessName,domain:lead.website||("lead-"+lead.id.slice(0,8)),plan:"Starter",competitors:[]});
    if(!client?.id)return Response.json({error:"Müşteri oluşturulamadı."},{status:500});
    await upsertClientProfile(client.id,{country:lead.country,city:lead.city,sector:lead.sector,phone:lead.phone,contactEmail:lead.email,requestedService:lead.requestedService});
    await updateLeadStatus(lead.id,"qualified");
    const service=["business-diagnosis","business-solution","business-monitoring"].includes(lead.requestedService)?lead.requestedService:"business-diagnosis";
    const token=await createPaymentAccessToken(client.id,604800,service);
    return json({ok:true,clientId:client.id,service,paymentUrl:"/odeme?token="+encodeURIComponent(token)});
  }catch(e){return json({error:"Başvuru müşteriye dönüştürülemedi."},e instanceof SyntaxError||e?.message==="invalid-request"?400:500)}
}
