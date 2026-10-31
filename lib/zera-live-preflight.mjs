import {prepareCustomerComparisonStorage} from './customer-comparison-schema.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
const json=(body,status=200)=>Response.json(body,{status,headers});
async function fixedPilot(pool){
 const matches=await pool.query('SELECT id,plan FROM public.clients WHERE name=$1 LIMIT 2',['ZERA Clothing']);
 if(matches.rows.length!==1||matches.rows[0].plan!=='Pilot')throw Error('pilot-unavailable');
 return matches.rows[0];
}
export async function inspectGeminiModel({env={},fetchImpl=fetch}={}){
 const model=env.ZERA_GEMINI_MODEL||'gemini-3.8-flash';
 const base={contentGenerationRequests:0,quotaVerified:false,freeTierVerified:false};
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(model))return {...base,model:null,modelAccessible:false,providerRequests:0,reason:'invalid-model-setting'};
 if(!env.GEMINI_API_KEY)return {...base,model,modelAccessible:false,providerRequests:0,reason:'key-not-configured'};
 try{
  const response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+model,{method:'GET',headers:{'x-goog-api-key':env.GEMINI_API_KEY},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok){
   const reason=response.status===401?'provider-authentication-failed':response.status===403?'provider-permission-denied':response.status===404?'provider-model-not-found':response.status===429?'provider-rate-limited':'provider-metadata-unavailable';
   return {...base,model,modelAccessible:false,providerRequests:1,reason};
  }
  const data=await response.json();
  const available=data?.name==='models/'+model&&Array.isArray(data.supportedGenerationMethods)&&data.supportedGenerationMethods.includes('generateContent');
  return {...base,model,modelAccessible:available,providerRequests:1,reason:available?null:'generate-content-not-advertised'};
 }catch{return {...base,model,modelAccessible:false,providerRequests:1,reason:'provider-metadata-unavailable'}}
}
export function createZeraLivePreflight({authorize,guard,getPool,getSettings,fetchImpl=fetch}){
 return {
  GET:async req=>{
   const denied=await authorize(req);if(denied)return denied;
   const rejected=await guard(req);if(rejected)return rejected;
   if(new URL(req.url).search)return json({error:'selectors-not-accepted'},400);
   const env=getSettings();if(env.VERCEL_ENV!=='production')return json({error:'production-required'},403);
   try{
    await fixedPilot(getPool());
    const result=await inspectGeminiModel({env,fetchImpl});
    return json(result,result.modelAccessible?200:503);
   }catch{return json({error:'pilot-or-storage-unavailable',providerRequests:0,contentGenerationRequests:0},503)}
  },
  POST:async req=>{
   const denied=await authorize(req);if(denied)return denied;
   const rejected=await guard(req);if(rejected)return rejected;
   if(new URL(req.url).search)return json({error:'selectors-not-accepted'},400);
   if(getSettings().VERCEL_ENV!=='production')return json({error:'production-required'},403);
   let body;try{body=await req.json()}catch{return json({error:'invalid-json'},400)}
   if(body?.confirmPrepareStorage!==true||Object.keys(body).length!==1)return json({error:'explicit-storage-confirmation-required'},400);
   try{
    const pool=getPool(),client=await fixedPilot(pool);
    await prepareCustomerComparisonStorage(pool,client.id);
    const attempts=await pool.query("SELECT to_regclass('public.zera_ai_task_attempts') AS name");
    if(attempts.rows[0]?.name)await pool.query('ALTER TABLE public.zera_ai_task_attempts ADD COLUMN IF NOT EXISTS failure_reason TEXT');
    return json({storageReady:true,attemptHistoryPreserved:true,providerRequests:0,contentGenerationRequests:0,insertActuallyTested:false});
   }catch{return json({error:'storage-preparation-unavailable',providerRequests:0,contentGenerationRequests:0},503)}
  }
 };
}
