import {checkRateLimit,enforceSameOrigin} from "../../../../lib/api-security";
import {sendVerificationEmail} from "../../../../lib/email-verification";
import {issueLeadEmailChallenge,leadEmailVerificationEnabled} from "../../../../lib/lead-email-verification.mjs";

export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(req){
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const limited=checkRateLimit(req,{bucket:"lead-email-issue",limit:4,windowMs:15*60*1000});if(limited)return limited;
 if(!leadEmailVerificationEnabled())return Response.json({error:"Verification not yet available"},{status:503,headers});
 try{
  const body=await req.json();
  await issueLeadEmailChallenge({leadId:body?.leadId,email:body?.email,send:sendVerificationEmail});
  return Response.json({ok:true,message:"If your application is eligible, check your email."},{headers});
 }catch(e){
  const error=String(e?.message||"");
  if(error==="invalid-request")return Response.json({error:"Invalid request"},{status:400,headers});
  if(["lead-verification-cooldown","lead-email-not-eligible","lead-already-verified"].includes(error))return Response.json({ok:true,message:"If your application is eligible, check your email."},{status:202,headers});
  // Never reveal if an applicant/lead exists, nor log secrets.
  return Response.json({error:"Verification is unavailable or could not be sent"},{status:503,headers});
 }
}
