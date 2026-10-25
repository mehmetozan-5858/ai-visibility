import {requireAdmin} from '../../../../lib/api-security';
import {zeraRegistrationGate} from '../../../../pilot/zera-registration-gate.mjs';

/** Lists Google API model availability without generating or billing a prompt. */
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 if(!zeraRegistrationGate(process.env).allowed)
  return Response.json({error:'Isolated pilot preview required'},{status:403});
 const key=process.env.GEMINI_API_KEY;
 if(!key)return Response.json({error:'Gemini API key not configured'},{status:409});
 try{
  const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{
   headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(9000),cache:'no-store'
  });
  if(!res.ok)return Response.json({connected:false,providerStatus:res.status,models:[],warning:'Google denied model listing; no scan was made'},{headers:{'Cache-Control':'private, no-store'}});
  const data=await res.json();
  const models=(data.models||[]).filter(m=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent')).map(m=>m.name?.replace(/^models\//,'')).filter(Boolean).slice(0,100);
  return Response.json({connected:true,models,configuredModel:process.env.ZERA_GEMINI_MODEL||'gemini-3.8-flash',scanExecuted:false,notes:'Model listing verifies availability, not remaining free quota or search grounding eligibility.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({connected:false,error:'Model listing unavailable',scanExecuted:false},{status:502,headers:{'Cache-Control':'private, no-store'}})}
}
