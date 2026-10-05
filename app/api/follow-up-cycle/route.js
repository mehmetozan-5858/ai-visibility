import {listFollowUpQueue,markProspectFollowUpSent} from "../../../lib/prospects";
import {sendBrandedOutreach} from "../../../lib/outreach-email";
export const runtime="nodejs";export const maxDuration=120;
function authorized(req){const a=req.headers.get("authorization")||"";return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a===`Bearer ${x}`)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:"unauthorized"},{status:401});
 const rows=await listFollowUpQueue(25),out={ok:true,due:rows.length,sent:0,errors:[]};
 for(const x of rows){
  try{
   if(!x.contactEmail){out.errors.push({id:x.id,error:"verified-email-required"});continue}
   const follow={...x,outreachDraft:`Merhaba, daha önce paylaştığımız ${x.proposalPackage||"AI görünürlük"} mini analizini görme fırsatınız oldu mu? Uygunsa tespit ettiğimiz alanları kısa ve somut biçimde paylaşabiliriz. İlgilenmiyorsanız tekrar iletişim kurmayacağız.`};
   await sendBrandedOutreach(follow);await markProspectFollowUpSent(x.id);out.sent++;
  }catch(e){out.errors.push({id:x.id,error:String(e?.message||e).slice(0,120)})}
 }
 return Response.json(out,{headers:{"cache-control":"no-store"}});
}
