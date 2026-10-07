const base=()=>({runs:0,successful:0,neutralComplete:0,failed:0,prompted:0,incomplete:0,unknown:0,brandMentions:0,officialCitations:0,comparisonPairs:0,appeared:0,notRepeated:0,unchanged:0});
const key=x=>JSON.stringify([x.provider,x.model,x.mode,x.query]);
export function summarizeDailyAnswerEvidence(rows=[]){
 const counts=base(),groups={prospect:base(),client:base()},providers={};let automaticFirst=0,automaticRepeat=0,manual=0,unknownOrigin=0;
 const latest=[];
 for(const run of rows){
  const result=run.result||{},group=groups[run.entityType];counts.runs++;if(group)group.runs++;
  if(result.automationKind==='repeat')automaticRepeat++;else if(result.automationKind==='first')automaticFirst++;else if(result.measurementOrigin==='admin')manual++;else unknownOrigin++;
  const add=(field,provider)=>{counts[field]++;if(group)group[field]++;if(provider){providers[provider]??=base();providers[provider][field]++}};
  const eligible=new Map();
  for(const x of result.observations||[]){add('successful',x.provider||'Bilinmiyor');if(x.brandPrompted===true)add('prompted',x.provider);if(x.truncated===true)add('incomplete',x.provider);
   if(x.brandPrompted===false&&x.truncated===false&&typeof x.brandMentioned==='boolean'&&typeof x.officialCitation==='boolean'){add('neutralComplete',x.provider);if(x.brandMentioned===true)add('brandMentions',x.provider);if(x.officialCitation===true)add('officialCitations',x.provider);eligible.set(key(x),x)}else if(x.brandPrompted!==true&&x.truncated!==true)add('unknown',x.provider);
  }
  for(const error of result.errors||[])add('failed',error.provider||'Bilinmiyor');
  const seen=new Set();let pairs=0;
  for(const pair of result.comparison?.pairs||[]){const k=key(pair),observation=eligible.get(k);if(seen.has(k)||!observation||!pair.previousRunId||!pair.model||!pair.mode||typeof pair.before?.brandMentioned!=='boolean'||typeof pair.after?.brandMentioned!=='boolean'||pair.after.brandMentioned!==(observation.brandMentioned===true))continue;seen.add(k);pairs++;add('comparisonPairs',pair.provider);if(!pair.before.brandMentioned&&pair.after.brandMentioned)add('appeared',pair.provider);else if(pair.before.brandMentioned&&!pair.after.brandMentioned)add('notRepeated',pair.provider);else add('unchanged',pair.provider)}
  if(latest.length<5)latest.push({id:run.id,entityType:run.entityType,entityName:run.entityName,entityId:run.entityId,createdAt:run.createdAt,successful:(result.observations||[]).length,failed:(result.errors||[]).length,comparisonPairs:pairs,kind:result.automationKind||(result.measurementOrigin==='admin'?'manual':'unknown')});
 }
 return {available:true,counts,groups,providers:Object.entries(providers).map(([provider,counts])=>({provider,...counts})),automaticFirst,automaticRepeat,manual,unknownOrigin,latest,scope:'Kaydedilen API yanıt örnekleri ve eş koşullu yanıt çiftleri. Eşleşmenin yeni yanıtta görünmesi veya tekrarlanmaması, genel görünürlük artışı/düşüşü veya uygulanan çözümün etkisi olarak değerlendirilmez. Başarısız çağrılar yokluk kanıtı değildir.'};
}
