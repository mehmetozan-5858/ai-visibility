// Fixed provider metadata lookup only: no inference, retries, storage writes or caller-selected URLs.
export async function readGeminiModelAccess({env={},fetchImpl=fetch}={}){
 const model=env.ZERA_GEMINI_MODEL||'gemini-3.8-flash';
 const base={provider:'gemini',model:/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(model)?model:null,
  inferenceRequests:0,quotaVerified:false,freeTierVerified:false,customerDataSent:false};
 if(!base.model)return {...base,state:'invalid-model-setting',accessible:false};
 if(!env.GEMINI_API_KEY)return {...base,state:'not-configured',accessible:false};
 try{
  const response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+model,
   {method:'GET',headers:{'x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.timeout(8000),cache:'no-store',redirect:'error'});
  if(!response.ok)return {...base,state:response.status===401||response.status===403?'access-denied':response.status===404?'model-not-found':response.status===429?'rate-limited':'provider-unavailable',accessible:false};
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))return {...base,state:'metadata-unverified',accessible:false};
  const text=await response.text();if(Buffer.byteLength(text)>65536)return {...base,state:'metadata-unverified',accessible:false};
  const data=JSON.parse(text);
  const verified=data?.name==='models/'+model&&Array.isArray(data.supportedGenerationMethods)&&data.supportedGenerationMethods.includes('generateContent');
  return {...base,state:verified?'metadata-access-confirmed':'metadata-unverified',accessible:verified};
 }catch{return {...base,state:'provider-unavailable',accessible:false}}
}
