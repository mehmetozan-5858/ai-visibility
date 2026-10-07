// This is a scoped frequency over recorded answers, never a general visibility rating.
export function freeAssessmentEvidence(entity,runs,{now=Date.now()}={}){
 const latest=new Map();let measuredAt=null;
 for(const run of runs){
  const at=new Date(run.createdAt).getTime();if(!Number.isFinite(at)||at>now||at<now-14*86400000)continue;
  if(run.entityId!==entity.id||run.entityType!=='prospect'||run.domain!==entity.domain)continue;
  for(const o of run.result?.observations||[]){
   if(o.brandPrompted!==false||o.truncated!==false||typeof o.brandMentioned!=='boolean'||!o.provider||!o.model||!o.mode||!o.query||!String(o.text||'').trim())continue;
   const key=JSON.stringify([o.provider,o.query.trim().toLocaleLowerCase()]);
   if(!latest.has(key)||latest.get(key).at<at)latest.set(key,{at,o});
  }
 }
 const sample=[...latest.values()],providers=new Set(sample.map(x=>x.o.provider)),queries=new Set(sample.map(x=>x.o.query));
 if(sample.length)measuredAt=new Date(Math.max(...sample.map(x=>x.at))).toISOString();
 const ready=sample.length>=6&&providers.size>=2&&queries.size>=2;
 const mentions=sample.filter(x=>x.o.brandMentioned).length;
 return {score:ready?Math.round(mentions*100/sample.length):null,status:ready?'ready':'insufficient',samples:sample.length,providers:providers.size,queries:queries.size,measuredAt,minimum:{samples:6,providers:2,queries:2},methodVersion:'sample-match-v1'};
}
