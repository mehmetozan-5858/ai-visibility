import {createContactService,verifyContactSignature} from '../../../lib/broker-contact.mjs';
import {databasePool,initializeSchema} from '../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../lib/db';
import {deliverOnce} from '../../../lib/email-delivery';
import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
export const runtime='nodejs';
export const maxDuration=60;
function json(body,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}})}
function service(){const url=getDatabaseUrl();if(!url)throw Error('database-not-configured');return createContactService({pool:databasePool(url),initializeSchema,deliver:deliverOnce})}
export async function POST(req){
 try{
  const raw=await req.text();if(Buffer.byteLength(raw)>16000)return json({error:'invalid-contact'},413);
  if(!verifyContactSignature(raw,req.headers,process.env.BROKER_CONTACT_RELAY_SECRET))return json({error:'unauthorized'},401);
  const result=await service().receive(JSON.parse(raw));return json({ok:true,...result},result.state==='email_accepted'?200:202);
 }catch(error){const code={'invalid-contact':400,'contact-conflict':409,'contact-rate-limit':429};return json({error:code[error.message]?error.message:'contact-unavailable'},error instanceof SyntaxError?400:code[error.message]||503)}
}
export async function GET(req){const denied=await requireAdmin(req);if(denied)return denied;try{return json({messages:await service().list()})}catch{return json({error:'contact-unavailable'},503)}}
export async function PATCH(req){const denied=await requireAdmin(req)||enforceSameOrigin(req);if(denied)return denied;try{const {id}=await req.json();if(!/^[a-f0-9-]{36}$/i.test(id||''))return json({error:'invalid-contact'},400);return json(await service().forward(id))}catch{return json({error:'contact-unavailable'},503)}}
