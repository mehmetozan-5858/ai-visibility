import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {listInbound,processInbound,retryInboundReview,saveInboundDraft} from '../../../lib/inbound-mail';
import {withRequestBudget} from '../../../lib/request-budget';
export async function GET(req){const denied=await requireAdmin(req);if(denied)return denied;try{return Response.json({messages:await listInbound()})}catch{return Response.json({error:'Gelen kutusu yüklenemedi.'},{status:500})}}
export async function POST(req){const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;return withRequestBudget(65000,async()=>{try{const b=await req.json().catch(()=>({}));if(b.eventId){if(typeof b.eventId!=='string'||b.eventId.length>200)return Response.json({error:'Geçersiz kayıt.'},{status:400});if(!await retryInboundReview(b.eventId))return Response.json({error:'İnceleme bekleyen kayıt bulunamadı.'},{status:409})}return Response.json(await processInbound())}catch{return Response.json({error:'Gelen kutusu işlenemedi.'},{status:500})}})}

export async function PATCH(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 try{const b=await req.json();const saved=await saveInboundDraft(b.eventId,b.draft,b.version);if(!saved)return Response.json({error:'Taslak değişmiş veya kayıt düzenlemeye uygun değil. Gelen kutusunu yenileyin.'},{status:409});return Response.json({ok:true,draft:saved,sent:false})}
 catch(e){return Response.json({error:e.message==='invalid-draft'?'Geçersiz taslak.':'Taslak kaydedilemedi.'},{status:e.message==='invalid-draft'?400:500})}
}
