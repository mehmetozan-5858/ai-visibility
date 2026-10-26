import {requireAdmin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {assessZeraProviderSpendGate} from '../../../../lib/zera-provider-spend-gate.mjs';

/** Read-only operational gate status; never return credentials or call providers. */
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const spendGate=assessZeraProviderSpendGate();
 if(!spendGate.allowed)return Response.json({ready:false,conditions:{providerSpendReleased:false},
  customerReadiness:'not-checked',mode:'single-explicit-attempt',scanStarted:false,reason:spendGate.reason},
  {headers:{'Cache-Control':'private, no-store'}});
 try{
  const client=await findClientByIdentity('ZERA Clothing','');
  const customerReady=Boolean(client?.id&&client.name==='ZERA Clothing'&&client.plan==='Pilot');
  const conditions={
   production:process.env.VERCEL_ENV==='production',
   customerReady,
   singleScanEnabled:process.env.ZERA_SINGLE_SCAN_ENABLED==='true',
   freeTierConfirmed:process.env.ZERA_GEMINI_FREE_TIER_CONFIRMED==='true',
   geminiKeyConfigured:Boolean(process.env.GEMINI_API_KEY),
   unpaidGroundingDisabled:process.env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED!=='true',
  };
  const ready=Object.values(conditions).every(Boolean);
  return Response.json({ready,conditions,mode:'single-explicit-attempt',scanStarted:false,disclaimer:'Environment readiness is not a guarantee of zero provider charges or a successful model response.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({ready:false,error:'Readiness unavailable'},{status:503})}
}
