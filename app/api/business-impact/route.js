import {getBusinessImpactMetrics,upsertBusinessImpactMetrics} from "../../../lib/business-impact";

export async function GET(req){
  try{
    const {searchParams}=new URL(req.url);const clientId=searchParams.get("clientId");
    if(!clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400});
    return Response.json({metrics:await getBusinessImpactMetrics(clientId)});
  }catch(e){return Response.json({error:"Business Impact verileri okunamadı.",detail:e?.message||""},{status:500})}
}
export async function PATCH(req){
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400});
    return Response.json({ok:true,metrics:await upsertBusinessImpactMetrics(body.clientId,body)});
  }catch(e){return Response.json({error:"Business Impact verileri kaydedilemedi.",detail:e?.message||""},{status:500})}
}
