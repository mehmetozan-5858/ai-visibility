import {freeMeasurementStatus} from './free-answer-evidence.mjs';
import {selectFreeModel} from './ai-bridge-free-inference.mjs';
// Fixed read-only endpoints. Never return key/account payloads, retry or request inference.
export async function readFreeProviderAccess({env={},fetchImpl=fetch}={}){
 const config=freeMeasurementStatus(env);
 const base={provider:'OpenRouter',model:config.model,inferenceRequests:0,credentialAccepted:false,modelFree:false,quotaVerified:false};
 if(!config.ready)return {...base,state:'not-configured'};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const opts={method:'GET',redirect:'error',cache:'no-store',signal:controller.signal};
  const [auth,catalog]=await Promise.allSettled([
   fetchImpl('https://openrouter.ai/api/v1/key',{...opts,headers:{Authorization:'Bearer '+env.OPENROUTER_API_KEY,Accept:'application/json'}}),
   fetchImpl('https://openrouter.ai/api/v1/models',{...opts,headers:{Accept:'application/json'}})
  ]);
  if(auth.status!=='fulfilled')return {...base,state:'credential-check-unavailable'};
  const response=auth.value;
  if(!response.ok)return {...base,state:[401,403].includes(response.status)?'credential-rejected':'credential-check-unavailable',providerStatus:response.status};
  // Authentication endpoint status is sufficient; never parse or expose account details.
  await response.body?.cancel();
  if(catalog.status!=='fulfilled'||!catalog.value.ok)return {...base,credentialAccepted:true,state:'catalog-unavailable'};
  const data=await catalog.value.json();
  const modelFree=!!selectFreeModel(data?.data,config.model);
  return {...base,credentialAccepted:true,modelFree,state:modelFree?'credential-and-price-confirmed':'model-not-verified-free'};
 }catch{return {...base,state:'preflight-unavailable'}}finally{clearTimeout(timer)}
}
