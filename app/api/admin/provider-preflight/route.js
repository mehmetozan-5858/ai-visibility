import {requireAdmin,checkRateLimit} from '../../../../lib/api-security';
import {readGeminiModelAccess} from '../../../../lib/customer-provider-preflight.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'};
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const limited=checkRateLimit(req,{bucket:'provider-metadata-preflight',limit:2,windowMs:60000});if(limited)return limited;
 if(new URL(req.url).search)return Response.json({error:'Selectors are not accepted'},{status:400,headers});
 return Response.json(await readGeminiModelAccess({env:process.env}),{headers});
}
