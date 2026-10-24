import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {getClient} from '../../../../lib/repository';
import {compareCustomerProviders} from '../../../../lib/customer-provider-comparison.mjs';
/** Shared customer-neutral comparison, explicit admin-only and cost-gated. */
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const invalidOrigin=enforceSameOrigin(req);if(invalidOrigin)return invalidOrigin;
 if(process.env.CUSTOMER_AI_COMPARE_ENABLED!=='true')return Response.json({error:'Provider calls disabled until explicitly budget-authorized'},{status:409});
 try{
  const {clientId,query,providers}=await req.json();
  if(typeof clientId!=='string'||!clientId.trim())return Response.json({error:'Client ID required'},{status:400});
  const client=await getClient(clientId);
  if(!client)return Response.json({error:'Customer not found'},{status:404});
  const result=await compareCustomerProviders({client,query,providers,keys:{
   gemini:process.env.GEMINI_API_KEY,openai:process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY,perplexity:process.env.PERPLEXITY_API_KEY
  }});
  return Response.json({...result,stored:false,reportReady:false});
 }catch(e){return Response.json({error:'Provider comparison failed',detail:String(e?.message||e).slice(0,120)},{status:400})}
}
