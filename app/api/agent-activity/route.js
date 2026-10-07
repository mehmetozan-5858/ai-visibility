import {requireAdmin} from '../../../lib/api-security';
import {getDatabaseUrl} from '../../../lib/db';
import {listSharedAgentEvents} from '../../../lib/agent-coordination';
import {agentActivitySnapshot} from '../../../lib/agent-activity-rules.js';
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{if(!getDatabaseUrl())throw Error('database-required');return Response.json(agentActivitySnapshot(await listSharedAgentEvents(200)),{headers:{'cache-control':'no-store'}})}catch{return Response.json({ok:false,error:'Ajan hareketleri alınamadı; durumlar bilinmiyor.'},{status:503,headers:{'cache-control':'no-store'}})}
}
