import {requireAdmin,checkRateLimit} from '../../../lib/api-security';
import {commandControlStatus} from '../../../lib/agent-command-control.js';
import {createAgentCommandHandler} from '../../../lib/agent-command-http.js';
import {createAgentIdentityResolver,resolveRegisteredAgent} from '../../../lib/agent-command-identity.js';
import {createPostgresCommandControl} from '../../../lib/agent-command-postgres.js';
import {databasePool} from '../../../lib/database-runtime';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Capabilities only: no model requests, DB schema changes, queue writes or credentials.
export async function GET(req){
 const denied=await requireAdmin(req);
 if(denied)return denied;
 const enabled=process.env.AGENT_COMMAND_CONTROL_ENABLED==='true';
 const readUrl=process.env.AGENT_COMMAND_READ_DATABASE_URL||process.env.AGENT_COMMAND_DATABASE_URL;
 const control={...commandControlStatus(),storage:'not-probed',reviewApiEnabled:enabled,
  configurationProvided:{database:Boolean(process.env.AGENT_COMMAND_DATABASE_URL),
   readDatabase:Boolean(process.env.AGENT_COMMAND_READ_DATABASE_URL),
   signingKeys:Boolean(process.env.AGENT_COMMAND_KEYS_JSON),registry:Boolean(process.env.AGENT_COMMAND_AGENTS_JSON),
   adminActor:Boolean(process.env.AGENT_COMMAND_ADMIN_ACTOR_ID)},queueStatus:'not-configured'};
 let snapshot=null;
 if(enabled&&readUrl&&control.configurationProvided.adminActor){
  try{
   const agents=JSON.parse(process.env.AGENT_COMMAND_AGENTS_JSON||'null');
   if(!agents||typeof agents!=='object'||Array.isArray(agents))throw Error();
   const principal=resolveRegisteredAgent(process.env.AGENT_COMMAND_ADMIN_ACTOR_ID,id=>Object.hasOwn(agents,id)?agents[id]:null);
   snapshot=await createPostgresCommandControl(databasePool(readUrl)).snapshot(principal);
   control.queueStatus='available';control.storage='postgresql';
  }catch{control.queueStatus='unavailable';}
 }
 return Response.json({ok:true,control,snapshot,checkedAt:new Date().toISOString()},
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
