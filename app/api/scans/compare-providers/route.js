import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {getClient} from '../../../../lib/repository';
import {compareCustomerProviders} from '../../../../lib/customer-provider-comparison.mjs';
import {storeCustomerComparison} from '../../../../lib/customer-comparison-storage.mjs';
import {reservePilotAiAllowance} from '../../../../lib/customer-ai-allowance.mjs';
import {zeraRegistrationGate} from '../../../../pilot/zera-registration-gate.mjs';
/** Shared customer-neutral comparison, explicit admin-only and cost-gated. */
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const invalidOrigin=enforceSameOrigin(req);if(invalidOrigin)return invalidOrigin;
 if(process.env.CUSTOMER_AI_COMPARE_ENABLED!=='true')return Response.json({error:'Provider calls disabled until explicitly budget-authorized'},{status:409});
 try{
  const {clientId,query,providers,persist=false,confirmPilotBudget=false}=await req.json();
  const gate=zeraRegistrationGate(process.env);
  if(!gate.allowed)return Response.json({error:'Isolated pilot environment not enabled',reason:gate.reason},{status:409});
  if(typeof clientId!=='string'||!clientId.trim())return Response.json({error:'Client ID required'},{status:400});
  const client=await getClient(clientId);
  if(!client)return Response.json({error:'Customer not found'},{status:404});
  if(confirmPilotBudget!==true)return Response.json({error:'Explicit pilot budget confirmation required'},{status:409});

  if(String(client.name).trim().toLowerCase()!=='zera clothing'||client.plan!=='Pilot')return Response.json({error:'Budget authorization limited to ZERA pilot'},{status:403});
  const selected=providers??['gemini','openai','perplexity'];
  if(!Array.isArray(selected)||!selected.length||selected.length>3||new Set(selected).size!==selected.length||selected.some(p=>!['gemini','openai','perplexity'].includes(p)))return Response.json({error:'Invalid provider selection'},{status:400});
  const providerKeys={gemini:process.env.GEMINI_API_KEY,openai:process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY,perplexity:process.env.PERPLEXITY_API_KEY};
  const unavailable=selected.filter(p=>!providerKeys[p]);
  if(unavailable.length)return Response.json({error:'Provider credentials unavailable',providers:unavailable},{status:409});
  const reservation=await reservePilotAiAllowance({pilotId:'ZERA-DE-001',providerCount:selected.length});
  if(!reservation.allowed)return Response.json({error:'Pilot request allowance exhausted'},{status:429});
  const result=await compareCustomerProviders({client,query,providers:selected,keys:providerKeys});
  if(persist===true){
   const storage=await storeCustomerComparison({clientId,comparison:result});
   return Response.json({...result,storage,stored:true,reportReady:false});
  }
  return Response.json({...result,stored:false,reportReady:false});
 }catch(e){return Response.json({error:'Provider comparison failed',detail:String(e?.message||e).slice(0,120)},{status:400})}
}
