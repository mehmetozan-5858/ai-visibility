const PROVIDERS=['Gemini','ChatGPT','Perplexity'];
/** Summarize dated stored answer evidence, never live connectivity or configuration. */
export function dailyProviderEvidence(data){
 if(data?.available!==true||!Array.isArray(data.providers))return PROVIDERS.map(provider=>({provider,status:'unknown',successful:null,failed:null}));
 return PROVIDERS.map(provider=>{
  const item=data.providers.find(p=>p?.provider===provider);
  if(!item)return {provider,status:'no-measurement',successful:0,failed:0};
  const good=Number.isInteger(item.successful)&&item.successful>=0;
  const bad=Number.isInteger(item.failed)&&item.failed>=0;
  if(!good||!bad)return {provider,status:'unknown',successful:null,failed:null};
  return {provider,status:item.successful>0?'recorded-answers':item.failed>0?'failed-attempts':'no-measurement',successful:item.successful,failed:item.failed};
 });
}
