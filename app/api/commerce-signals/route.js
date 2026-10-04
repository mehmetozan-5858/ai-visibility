import {getCommerceSignals,upsertCommerceSignals} from "../../../lib/commerce-signals";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{
    const {searchParams}=new URL(req.url);const clientId=searchParams.get("clientId");
    if(!clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400});
    return Response.json({signals:await getCommerceSignals(clientId)});
  }catch(e){return Response.json({error:"Commerce sinyalleri okunamadı.",detail:e?.message||""},{status:500})}
}
export async function PATCH(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400});
    return Response.json({ok:true,signals:await upsertCommerceSignals(body.clientId,body)});
  }catch(e){return Response.json({error:"Commerce sinyalleri kaydedilemedi.",detail:e?.message||""},{status:500})}
}
