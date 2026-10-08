// Permission enquiries can use checked official information without an AI score.
export function validEnquiryEvidence(x,domain,now=Date.now()){
 if(x?.method!=='official-enquiry-v1'||x.inspection?.method!=='official-html-v1'||x.inspection.status!=='checked')return false;
 const age=now-new Date(x.checkedAt).getTime();if(!Number.isFinite(age)||age<0||age>7*86400000)return false;
 try{const base=new URL(/^https?:\/\//i.test(domain)?domain:'https://'+domain).hostname.replace(/^www\./,'').toLowerCase(),url=new URL(x.inspection.sourceUrl);return url.protocol==='https:'&&!url.username&&!url.password&&(url.hostname===base||url.hostname.endsWith('.'+base))}catch{return false}
}
