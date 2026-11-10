import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";
import {verifyLeadEmailChallenge,leadEmailVerificationEnabled} from "../../../../lib/lead-email-verification.mjs";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(req){
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:"lead-email-verify",limit:10,windowMs:15*60*1000});if(limited)return limited;
 if(!leadEmailVerificationEnabled())return Response.json({error:"Verification not yet available"},{status:503,headers});
 try{
  const body=await req.json();
  const verified=await verifyLeadEmailChallenge({leadId:body?.leadId,email:body?.email,code:body?.code});
  if(!verified)return Response.json({ok:false,error:"Invalid or expired code"},{status:400,headers});
  return Response.json({ok:true,verified:true},{headers});
 }catch{
  return Response.json({error:"Verification unavailable"},{status:503,headers});
 }
}
