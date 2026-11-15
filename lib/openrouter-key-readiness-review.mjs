// REVIEW ONLY: OpenRouter authenticated key preflight using a READ-ONLY GET.
// Never send prompts, incur model inference costs, print key identifiers,
// expose account balances or change production flags.
const ENDPOINT='https://openrouter.ai/api/v1/key';
export async function checkOpenRouterKeyReadiness({
 key=process.env.OPENROUTER_API_KEY,
 fetcher=globalThis.fetch,
 timeoutMs=5000
}={}){
 if(typeof key!=='string'||key.trim().length===0)
  return {status:'disabled',reason:'openrouter-key-missing',authenticated:false,modelVerified:false};
 if(typeof fetcher!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>15000)
  return {status:'blocked',reason:'openrouter-probe-invalid',authenticated:false,modelVerified:false};
 try{
  const response=await fetcher(ENDPOINT,{
   method:'GET',
   headers:{authorization:'Bearer '+key},
   signal:AbortSignal.timeout(timeoutMs),
   redirect:'error',
   cache:'no-store'
  });
  if(response.status===401||response.status===403)
   return {status:'blocked',reason:'openrouter-key-rejected',authenticated:false,modelVerified:false};
  if(response.status===429)
   return {status:'blocked',reason:'openrouter-probe-rate-limited',authenticated:false,modelVerified:false};
  if(response.status!==200)
   return {status:'error',reason:'openrouter-probe-http-'+response.status,authenticated:false,modelVerified:false};
  const body=await response.json();
  if(!body||typeof body.data!=='object'||body.data===null||Array.isArray(body.data))
   return {status:'error',reason:'openrouter-response-unverified',authenticated:false,modelVerified:false};
  // An authenticated key response proves key endpoint connectivity ONLY.
  // It does not prove inference, available credits, provider persistence or receipt.
  return {status:'recent-evidence',reason:'openrouter-key-endpoint-authenticated',
   authenticated:true,modelVerified:false};
 }catch{
  return {status:'error',reason:'openrouter-probe-network-unavailable',authenticated:false,modelVerified:false};
 }
}
