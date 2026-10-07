export function safeEvidenceUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}
}
const statements=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim().length>=12):[];
export function websiteEvidence(record,domain){
 const sourceUrl=safeEvidenceUrl(record?.sourceUrl);
 let official=false;
 try{const host=new URL(/^https?:\/\//i.test(domain)?domain:'https://'+domain).hostname.replace(/^www\./,'').toLowerCase(),u=new URL(sourceUrl);official=!u.port&&(u.hostname===host||u.hostname.endsWith('.'+host))}catch{}
 const checked=record?.method==='official-html-v1'&&record.status==='checked'&&official&&Number.isFinite(Date.parse(record.checkedAt))&&Date.parse(record.checkedAt)<=Date.now()+60000;
 const texts={"html-title":['Alınan HTML sayfasında boş olmayan title etiketi bulunamadı.','HTML sayfa başlığı mevcut.'],"meta-description":['Alınan HTML sayfasında boş olmayan meta description etiketi bulunamadı.','HTML meta description etiketi mevcut.']};
 const checks=checked&&Array.isArray(record.checks)?record.checks.filter(c=>texts[c.key]&&typeof c.present==='boolean').map(c=>({key:c.key,present:c.present,text:texts[c.key][Number(c.present)],sourceUrl,checkedAt:record.checkedAt})):[];
 return {checked:checked&&checks.length>0,sourceUrl:checked?sourceUrl:'',checkedAt:checked?record.checkedAt:null,scope:'Yalnız alınan sayfanın HTML yanıtı; JavaScript sonrası görünüm ve diğer sayfalar kontrol edilmedi.',observations:checks.filter(c=>c.present),issues:checks.filter(c=>!c.present)};
}
export function prospectEvidence(x){
 const score=x.scanScore,findings=statements(x.scanFindings),recommendations=statements(x.scanRecommendations);
 const analyzed=score!==null&&score!==undefined&&Number.isFinite(Number(score))&&Number(score)>=0&&Number(score)<=100&&!!x.scanProvider&&!/test|demo|synthetic/i.test(x.scanProvider)&&findings.length>0&&recommendations.length>0;
 const specialty=String(x.source||'').match(/^specialist-evidence: (.{30,}) \| (https:\/\/\S+)$/);
 const sourceUrl=safeEvidenceUrl(specialty?.[2]||x.source);
 let officialSource=false;
 try{const source=new URL(sourceUrl),domain=new URL(/^https?:\/\//i.test(x.domain)?x.domain:'https://'+x.domain).hostname.replace(/^www\./,'').toLowerCase();officialSource=source.hostname===domain||source.hostname.endsWith('.'+domain)}catch{}
 const page=websiteEvidence(x.scanEvidence,x.domain);
 return {page,verifiedIssues:page.issues,verifiedObservations:page.observations,pendingChecks:analyzed?findings:[],scoreKind:"provider-estimate",analyzed,sourceUrl,officialSource,specialty:officialSource?specialty?.[1]||'':'',provider:analyzed?x.scanProvider:'',score:analyzed?Number(score):null,analyzedAt:analyzed?x.scanCompletedAt||null:null,findings:analyzed?findings:[],recommendations:analyzed?recommendations:[],contactSourceUrl:x.contactStatus==='verified'?safeEvidenceUrl(x.contactSourceUrl):''};
}
