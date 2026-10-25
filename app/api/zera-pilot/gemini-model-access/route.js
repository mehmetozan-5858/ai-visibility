import {requireAdmin} from '../../../../lib/api-security';
import {zeraRegistrationGate} from '../../../../pilot/zera-registration-gate.mjs';
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 if(!zeraRegistrationGate(process.env).allowed)return Response.json({error:'Isolated preview only'},{status:403});
 if(!process.env.GEMINI_API_KEY)return Response.json({error:'Gemini key not configured'},{status:409});
 try{
  const result=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{
   headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!result.ok)return Response.json({available:false,providerHttpStatus:result.status,generationExecuted:false},{status:502});
  const data=await result.json();
  const targets=['gemini-3.8-flash','gemini-3.5-flash-lite','gemini-3.6-flash'];
  const available=(data.models||[]).filter(m=>targets.includes(String(m.name||'').replace(/^models\//,''))&&(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace(/^models\//,''));
  return Response.json({availableModels:available,currentConfiguredModel:process.env.ZERA_GEMINI_MODEL||'gemini-3.8-flash',generationExecuted:false,paidScanExecuted:false,notice:'Model discovery is not proof of free-tier access or a successful generation.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Model discovery unavailable',generationExecuted:false},{status:503})}
}
