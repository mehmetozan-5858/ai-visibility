import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {listInbound,processInbound} from '../../../lib/inbound-mail';
import {withRequestBudget} from '../../../lib/request-budget';
export async function GET(req){const denied=await requireAdmin(req);if(denied)return denied;try{return Response.json({messages:await listInbound()})}catch{return Response.json({error:'Gelen kutusu yüklenemedi.'},{status:500})}}
export async function POST(req){const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;return withRequestBudget(65000,async()=>{try{return Response.json(await processInbound())}catch{return Response.json({error:'Gelen kutusu işlenemedi.'},{status:500})}})}
