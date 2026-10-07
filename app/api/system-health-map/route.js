import {listSystemWatchdog} from "../../../lib/agent-coordination";
import {requireAdmin} from "../../../lib/api-security";
import {getDatabaseUrl} from '../../../lib/db';
import {systemHealthSnapshot} from '../../../lib/system-health-rules';
export const runtime="nodejs";
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  if(!getDatabaseUrl())throw Error('database-required');
  const snapshot=systemHealthSnapshot(await listSystemWatchdog());
  return Response.json(snapshot,{headers:{"cache-control":"no-store"}});
 }catch{return Response.json({ok:false,error:'Sistem kontrol kayıtları alınamadı; durum ve sayımlar bilinmiyor.'},{status:503,headers:{'cache-control':'no-store'}})}
}
