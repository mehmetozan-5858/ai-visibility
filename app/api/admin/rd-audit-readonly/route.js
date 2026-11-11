import {requireAdmin,checkRateLimit} from '../../../../lib/api-security';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {readRealAudit} from '../../../../lib/rd-real-audit.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'};
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const limited=checkRateLimit(req,{bucket:'rd-real-audit',limit:5,windowMs:60000});if(limited)return limited;
 try{
  const url=getDatabaseUrl();if(!url)throw Error();
  return Response.json({ok:true,summary:await readRealAudit(databasePool(url))},{headers});
 }catch{return Response.json({ok:false,error:'Denetim özeti alınamadı; sonuç bilinmiyor.'},{status:503,headers})}
}
