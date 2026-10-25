/** Provider comparison report for any customer. Never converts AI opinion into a measured search rank. */
export function buildCustomerComparisonReport({client,comparisons,language}={}){
 if(!client?.id||!client?.name)throw Error('Customer required');
 if(!Array.isArray(comparisons))throw Error('Comparisons required');
 const region=String(client.country||'').toLowerCase();
 const locale=language==='tr'||language==='en'?language:(['tr','turkey','türkiye'].includes(region)?'tr':'en');
 const items=comparisons.map(c=>{
  if(c?.clientId!==client.id||!Array.isArray(c.results)||typeof c.query!=='string')throw Error('Cross-customer or invalid comparison');
  return {query:c.query,providers:c.results.map(r=>({provider:r.provider,status:r.status,brandMention:r.brandMention||'unknown',citation:r.evidence?.sourceUrl||null,verified:Boolean(r.verified)}))};
 });
 const total=items.reduce((n,c)=>n+c.providers.length,0);
 const sourced=items.reduce((n,c)=>n+c.providers.filter(p=>p.verified).length,0);
 return {clientId:client.id,clientName:client.name,language:locale,queries:items,providerResponses:total,sourceSupportedResponses:sourced,visibilityScore:null,
  status:total?'preliminary-provider-comparison':'awaiting-provider-scans',
  note:locale==='tr'?'Kaynaklı cevap sayısı arama sıralaması veya görünürlük skoru değildir.':'Source-supported answers are not search rankings or a visibility score.'};
}
