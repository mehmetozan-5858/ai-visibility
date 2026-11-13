import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../../lib/api-security";
import {databasePool} from "../../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../../lib/db";
import {validUuid,domainProofEnabled} from "../../../../lib/applicant-domain-proof.mjs";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:"admin-applicant-link-revoke",limit:6,windowMs:15*60*1000});if(limited)return limited;
 if(!domainProofEnabled())return Response.json({error:"Ownership controls disabled"},{status:503,headers});
 try{
  const body=await req.json();
  if(!validUuid(body?.leadId)||body?.confirm!=="revoke-applicant-assessment")
   return Response.json({error:"Explicit revocation confirmation required"},{status:400,headers});
  const url=getDatabaseUrl();if(!url)throw Error("no-database");
  const db=databasePool(url);
  const updated=await db.query(`UPDATE public.applicant_assessment_links SET revoked_at=NOW()
    WHERE lead_id=$1 AND revoked_at IS NULL RETURNING lead_id`,[body.leadId]);
  return Response.json({ok:true,revoked:updated.rowCount===1,
   // Previously signed applicant links fail closed because the GET handler rechecks revoked_at.
   existingTokensInvalidated:updated.rowCount===1},{headers});
 }catch{return Response.json({error:"Revocation unavailable"},{status:503,headers})}
}
