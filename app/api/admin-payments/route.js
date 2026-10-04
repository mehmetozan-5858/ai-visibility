import {listPayments,confirmPayment} from "../../../lib/repository";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json({payments:await listPayments(150)})}
  catch(e){return Response.json({error:"Ödemeler okunamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
export async function PATCH(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    if(!body?.id)return Response.json({error:"Ödeme kaydı gerekli."},{status:400});
    const payment=await confirmPayment(body.id,{plan:body.plan,setupAmount:body.setupAmount,monthlyAmount:body.monthlyAmount});
    if(!payment)return Response.json({error:"Ödeme onaylanamadı."},{status:409});
    return Response.json({payment});
  }catch(e){return Response.json({error:"Ödeme onaylanamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
