import {listWorkItems,updateWorkItem} from "../../../lib/repository";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";
export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json({items:await listWorkItems(150)})}
  catch(e){return Response.json({error:"İş listesi okunamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
export async function PATCH(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  try{
    const body=await req.json();
    if(!body?.id||!body?.status)return Response.json({error:"Görev ve durum gerekli."},{status:400});
    const item=await updateWorkItem(body.id,body.status,body.evidence,body.expectedStatus);
    if(!item)return Response.json({error:"Görev bulunamadı."},{status:404});
    return Response.json({item});
  }catch(e){const messages={'completion-evidence-required':'En az 20 karakterlik uygulama kanıtı ve doğrulama onayı gerekli.','invalid-evidence-url':'Kanıt bağlantısı geçerli bir HTTPS adresi olmalı.','work-version-required':'Görev listesini yenileyin.','work-changed':'Görev durumu değişmiş; listeyi yenileyin.','work-not-in-progress':'Tamamlamadan önce görevi Uygulanıyor durumuna alın.','paid-real-client-required':'Tamamlama için aktif, ödeme onaylı gerçek müşteri gerekli.','invalid-work-status':'Geçersiz görev durumu.'};return Response.json({error:messages[e.message]||"Görev güncellenemedi."},{status:messages[e.message]?409:500})}
}
