export function safeEvidenceUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}
}
const statements=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim().length>=12):[];
export function prospectEvidence(x){
 const score=x.scanScore,findings=statements(x.scanFindings),recommendations=statements(x.scanRecommendations);
 const analyzed=score!==null&&score!==undefined&&Number.isFinite(Number(score))&&Number(score)>=0&&Number(score)<=100&&!!x.scanProvider&&!/test|demo|synthetic/i.test(x.scanProvider)&&findings.length>0&&recommendations.length>0;
 const specialty=String(x.source||'').match(/^specialist-evidence: (.{30,}) \| (https:\/\/\S+)$/);
 const sourceUrl=safeEvidenceUrl(specialty?.[2]||x.source);
 let officialSource=false;
 try{const source=new URL(sourceUrl),domain=new URL(/^https?:\/\//i.test(x.domain)?x.domain:'https://'+x.domain).hostname.replace(/^www\./,'').toLowerCase();officialSource=source.hostname===domain||source.hostname.endsWith('.'+domain)}catch{}
 return {analyzed,sourceUrl,officialSource,specialty:officialSource?specialty?.[1]||'':'',provider:analyzed?x.scanProvider:'',score:analyzed?Number(score):null,analyzedAt:analyzed?x.scanCompletedAt||null:null,findings:analyzed?findings:[],recommendations:analyzed?recommendations:[],contactSourceUrl:x.contactStatus==='verified'?safeEvidenceUrl(x.contactSourceUrl):''};
}
