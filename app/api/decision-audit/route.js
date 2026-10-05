import {listDecisionAudit} from "../../../lib/agent-coordination";
import {requireAdmin} from "../../../lib/api-security";
export const runtime="nodejs";
export async function GET(req){
 const auth=await requireAdmin(req);if(auth?.response)return auth.response;
 try{const url=new URL(req.url),limit=Math.min(200,Math.max(1,Number(url.searchParams.get("limit")||100)));const items=await listDecisionAudit(limit);
  return Response.json({ok:true,items,explainability:true,secretsRedacted:true});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
