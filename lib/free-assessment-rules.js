// This is a scoped frequency over recorded answers, never a general visibility rating.
export function freeAssessmentEvidence(entity,runs,{now=Date.now()}={}){
 const latest=new Map();let measuredAt=null;
 for(const run of runs){
  const at=new Date(run.createdAt).getTime();if(!Number.isFinite(at)||at>now||at<now-14*86400000)continue;
  if(run.entityId!==entity.id||run.entityType!=='prospect'||run.domain!==entity.domain)continue;
  for(const o of Array.isArray(run.result?.observations)?run.result.observations:[]){
   // The run date alone cannot make a stale, future-dated or unverifiable answer current.
   const checked=Date.parse(o?.checkedAt);
   if(!Number.isFinite(checked)||checked<now-14*86400000||checked>now||checked>at+5*60000)continue;
   if(typeof o.responseId!=='string'||!o.responseId.trim())continue;
   if(o.brandPrompted!==false||o.truncated!==false||typeof o.brandMentioned!=='boolean'||!o.provider||!o.model||!o.mode||typeof o.query!=='string'||!o.query.trim()||!String(o.text||'').trim())continue;
   const key=JSON.stringify([o.provider,o.query.trim().toLocaleLowerCase()]);
   if(!latest.has(key)||latest.get(key).at<checked)latest.set(key,{at:checked,o});
  }
 }
 const sample=[...latest.values()],providers=new Set(sample.map(x=>x.o.provider)),queries=new Set(sample.map(x=>x.o.query.trim().toLocaleLowerCase()));
 if(sample.length)measuredAt=new Date(Math.max(...sample.map(x=>x.at))).toISOString();
 const ready=sample.length>=6&&providers.size>=2&&queries.size>=2;
 const mentions=sample.filter(x=>x.o.brandMentioned).length;
 return {score:ready?Math.round(mentions*100/sample.length):null,status:ready?'ready':'insufficient',samples:sample.length,providers:providers.size,queries:queries.size,measuredAt,minimum:{samples:6,providers:2,queries:2},methodVersion:'sample-match-v1'};
}
