import {listWorkItems,updateWorkItem} from "../../../lib/repository";
export async function GET(){
  try{return Response.json({items:await listWorkItems(150)})}
  catch(e){return Response.json({error:"İş listesi okunamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
export async function PATCH(req){
  try{
    const body=await req.json();
    if(!body?.id||!body?.status)return Response.json({error:"Görev ve durum gerekli."},{status:400});
    const item=await updateWorkItem(body.id,body.status);
    if(!item)return Response.json({error:"Görev bulunamadı."},{status:404});
    return Response.json({item});
  }catch(e){return Response.json({error:"Görev güncellenemedi.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
