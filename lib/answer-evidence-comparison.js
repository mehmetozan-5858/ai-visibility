const host=value=>String(value||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
export function sameEvidenceIdentity(entity,run){return entity.entityType===run.entityType&&entity.id===run.entityId&&entity.name===run.entityName&&host(entity.domain)===host(run.domain)}
const eligible=x=>x&&x.brandPrompted===false&&x.truncated===false&&x.query&&x.provider&&x.model&&x.mode;
const key=x=>JSON.stringify([x.query,x.provider,x.model,x.mode]);
export function compareAnswerEvidence(entity,result,previous=[]){
 const pairs=[],unmatched=[];
 for(const current of result.observations||[]){
  if(!eligible(current)){unmatched.push({provider:current.provider,query:current.query,reason:'ineligible-response'});continue}
  let found;
  for(const run of previous){if(!sameEvidenceIdentity(entity,run))continue;const before=(run.result?.observations||[]).find(x=>eligible(x)&&key(x)===key(current));if(before){found={run,before};break}}
  if(!found){unmatched.push({provider:current.provider,query:current.query,reason:'no-matching-history'});continue}
  pairs.push({previousRunId:found.run.id,previousDate:found.before.checkedAt||found.run.createdAt,currentDate:current.checkedAt,provider:current.provider,model:current.model,mode:current.mode,query:current.query,before:{brandMentioned:found.before.brandMentioned===true,officialCitation:found.before.officialCitation===true},after:{brandMentioned:current.brandMentioned===true,officialCitation:current.officialCitation===true}});
 }
 return {pairs,unmatched,failed:(result.errors||[]).length,scope:'Yalnız aynı işletme kimliği, tam sorgu, sağlayıcı, model ve mod eşleştirilir. Değişim bu iki API yanıtına aittir; genel görünürlük artışı veya düşüşü değildir. Hatalı ve eksik yanıtlar yokluk sayılmaz.'};
}
export function repeatEvidenceOptions(entity,run,available){
 if(!sameEvidenceIdentity(entity,run))throw Error('repeat-identity-mismatch');
 const queries=run.result?.queries,providers=[...new Set([...(run.result?.observations||[]),...(run.result?.errors||[])].map(x=>x.provider))];
 if(!Array.isArray(queries)||!queries.length||queries.length>2||queries.some(q=>typeof q!=='string'||q.length<8||q.length>500)||!providers.length||providers.some(p=>!available.includes(p)))throw Error('repeat-configuration-unavailable');
 return {queries,providers,repeatRunId:run.id};
}
