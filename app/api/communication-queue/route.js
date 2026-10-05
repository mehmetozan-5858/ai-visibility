import {requireAdmin} from "../../../lib/api-security";
import {listCommunicationQueue} from "../../../lib/prospects";
export const runtime="nodejs";
export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json({queue:await listCommunicationQueue(150)},{headers:{"cache-control":"no-store"}})}
  catch(e){return Response.json({error:String(e?.message||e)},{status:500})}
}
