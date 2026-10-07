import {getBusinessImpactMetrics,upsertBusinessImpactMetrics} from "../../../lib/business-impact";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

const headers={"cache-control":"no-store"};

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{
    const {searchParams}=new URL(req.url);const clientId=searchParams.get("clientId");
    if(!clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400,headers});
    return Response.json({metrics:await getBusinessImpactMetrics(clientId)},{headers});
  }catch(e){return Response.json({error:"Business Impact verileri okunamadı."},{status:503,headers})}
}
export async function PATCH(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400,headers});
    return Response.json({ok:true,metrics:await upsertBusinessImpactMetrics(body.clientId,body)},{headers});
  }catch(e){return Response.json({error:"Business Impact verileri kaydedilemedi."},{status:503,headers})}
}
