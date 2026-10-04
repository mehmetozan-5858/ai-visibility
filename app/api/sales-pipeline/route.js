import {listSalesPipeline,updateSalesOpportunity} from "../../../lib/repository";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json({opportunities:await listSalesPipeline(150)})}
  catch(e){return Response.json({error:"Satış takibi okunamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}

export async function PATCH(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    if(!body?.id)return Response.json({error:"Fırsat kaydı gerekli."},{status:400});
    const opportunity=await updateSalesOpportunity(body.id,{stage:body.stage,nextFollowUp:body.nextFollowUp,notes:body.notes});
    if(!opportunity)return Response.json({error:"Fırsat bulunamadı."},{status:404});
    return Response.json({opportunity});
  }catch(e){return Response.json({error:"Satış takibi güncellenemedi.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
