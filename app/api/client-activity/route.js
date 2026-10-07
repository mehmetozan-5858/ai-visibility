import {addClientActivity,getClientAccount,getClient} from "../../../lib/repository";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

import {databaseStatus} from "../../../lib/db";
const headers={"cache-control":"no-store"};

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  if(!databaseStatus().configured)return Response.json({error:"İşletme kayıt kaynağı kullanılamıyor."},{status:503,headers});
  try{
    const clientId=new URL(req.url).searchParams.get("clientId")||"";
    if(!clientId)return Response.json({error:"Müşteri seçilmelidir."},{status:400,headers});
    const account=await getClientAccount(clientId);
    if(!account)return Response.json({error:"Müşteri bulunamadı."},{status:404,headers});
    return Response.json({account},{headers});
  }catch(e){
    return Response.json({error:"İşletme hesabı okunamadı."},{status:503,headers});
  }
}

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  if(!databaseStatus().configured)return Response.json({error:"İşletme kayıt kaynağı kullanılamıyor."},{status:503,headers});
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Müşteri seçilmelidir."},{status:400,headers});
    if(!await getClient(body.clientId))return Response.json({error:"Müşteri bulunamadı."},{status:404,headers});
    const activity=await addClientActivity(body.clientId,{
      eventType:body.eventType,
      title:body.title,
      detail:body.detail,
      metadata:{manual:true}
    });
    if(!activity?.id)throw new Error("activity-not-saved");
    return Response.json({activity},{status:201,headers});
  }catch(e){
    return Response.json({error:"Faaliyet kaydı eklenemedi."},{status:503,headers});
  }
}
