import {requireAdmin} from '../../../lib/api-security';
import {commandControlStatus} from '../../../lib/agent-command-control.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Capabilities only: no model requests, DB schema changes, queue writes or credentials.
export async function GET(req){
 const denied=await requireAdmin(req);
 if(denied)return denied;
 return Response.json({ok:true,control:commandControlStatus()},
  {headers:{'Cache-Control':'no-store'}});
}
