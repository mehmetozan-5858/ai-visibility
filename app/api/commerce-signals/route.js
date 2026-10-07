import {getCommerceSignals,upsertCommerceSignals} from "../../../lib/commerce-signals";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

const headers={"cache-control":"no-store"};

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{
    const {searchParams}=new URL(req.url);const clientId=searchParams.get("clientId");
    if(!clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400,headers});
    return Response.json({signals:await getCommerceSignals(clientId)},{headers});
  }catch(e){return Response.json({error:"Commerce sinyalleri okunamadı."},{status:503,headers})}
}
export async function PATCH(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400,headers});
    return Response.json({ok:true,signals:await upsertCommerceSignals(body.clientId,body)},{headers});
  }catch(e){return Response.json({error:"Commerce sinyalleri kaydedilemedi."},{status:503,headers})}
}
