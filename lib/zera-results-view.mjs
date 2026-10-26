/** Read-only projection of persisted provider output; storage is not a trust grant. */
const providers=new Set(['gemini','openai','perplexity']);
const states=new Set(['not-configured','source-supported-answer','answer-received-unverified','empty-answer','failed']);
const mentions=new Set(['possible-mention','not-observed','unknown']);
const failures=new Set(['provider-temporarily-unavailable','provider-quota-or-rate-limit','provider-model-not-found','provider-permission-denied']);
function sourceUrl(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{
  const u=new URL(value),host=u.hostname;
  const publicName=host.includes('.')&&!/^[0-9.]+$/.test(host)&&!host.includes(':')&&
   !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host);
  return u.protocol==='https:'&&!u.username&&!u.password&&publicName?u.href:null;
 }catch{return null}
}
export function projectZeraResults(rows){
 if(!Array.isArray(rows))return [];
 return rows.slice(0,20).filter(row=>row&&typeof row==='object').map(row=>({
  id:row.id,query:typeof row.query==='string'?row.query.slice(0,500):'',createdAt:row.createdAt,
  results:(Array.isArray(row.results)?row.results:[]).slice(0,3)
   .filter((v,i,all)=>v&&typeof v==='object'&&providers.has(v.provider)&&all.findIndex(x=>x?.provider===v.provider)===i).map(v=>{
    const url=sourceUrl(v.evidence?.sourceUrl);
    const supported=v.verified===true&&v.status==='source-supported-answer'&&url!==null&&
     typeof v.evidence?.observation==='string'&&v.evidence.observation.trim().length>0&&
     typeof v.answer==='string'&&v.answer.trim().length>0;
    return {provider:v.provider,status:v.status==='source-supported-answer'&&!supported?'answer-received-unverified':states.has(v.status)?v.status:'invalid-result',verified:supported,
     brandMention:mentions.has(v.brandMention)?v.brandMention:'unknown',sourceUrl:url,
     answer:typeof v.answer==='string'?v.answer.slice(0,2000):null,
     reason:failures.has(v.reason)?v.reason:v.status==='failed'?'provider-failure-undetermined':null};
   })
 }));
}
