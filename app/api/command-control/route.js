import {requireAdmin,checkRateLimit} from '../../../lib/api-security';
import {commandControlStatus} from '../../../lib/agent-command-control.js';
import {createAgentCommandHandler} from '../../../lib/agent-command-http.js';
import {createAgentIdentityResolver} from '../../../lib/agent-command-identity.js';
import {createPostgresCommandControl} from '../../../lib/agent-command-postgres.js';
import {databasePool} from '../../../lib/database-runtime';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Capabilities only: no model requests, DB schema changes, queue writes or credentials.
export async function GET(req){
 const denied=await requireAdmin(req);
 if(denied)return denied;
 return Response.json({ok:true,control:{...commandControlStatus(),storage:'not-probed',
  reviewApiEnabled:process.env.AGENT_COMMAND_CONTROL_ENABLED==='true'}},
  {headers:{'Cache-Control':'no-store'}});
}

export async function POST(req){
 const limited=checkRateLimit(req,{bucket:'agent-command-control',limit:30,windowMs:60000});
 if(limited)return limited;
 return createAgentCommandHandler({
  enabled:()=>process.env.AGENT_COMMAND_CONTROL_ENABLED==='true',
  resolvePrincipal:token=>{
   const keys=JSON.parse(process.env.AGENT_COMMAND_KEYS_JSON||'null');
   const agents=JSON.parse(process.env.AGENT_COMMAND_AGENTS_JSON||'null');
   if(!agents || typeof agents!=='object' || Array.isArray(agents))throw Error('invalid-identity-config');
   return createAgentIdentityResolver({keys,getAgent:id=>Object.hasOwn(agents,id)?agents[id]:null}).resolve(token);
  },
  getControl:()=>{
   const url=process.env.AGENT_COMMAND_DATABASE_URL;
   if(!url)throw Error('database-unconfigured');
   return createPostgresCommandControl(databasePool(url));
  }
 })(req);
}
