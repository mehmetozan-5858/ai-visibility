/**
 * Read-only association suggestions for administrator review.
 * An exact domain match is NOT proof of email/domain ownership.
 * Never issue tokens, create client accounts, or initiate provider scans from these suggestions.
 */
export function normalizedBusinessDomain(raw){
 if(typeof raw!=="string"||!raw.trim()||raw.length>500)return null;
 try{
  const value=raw.trim();
  const url=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value)?value:"https://"+value);
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.port||url.search||url.hash)return null;
  const hostname=url.hostname.toLowerCase().replace(/\.$/,"").replace(/^www\./,"");
  if(!hostname||hostname==="localhost"||!hostname.includes(".")||hostname.includes("..")||/[^a-z0-9.-]/.test(hostname))return null;
  if(url.pathname!=="/"&&url.pathname!=="")return null;
  return hostname;
 }catch{return null}
}

export function findAssessmentCandidates(leads=[],prospects=[]){
 const grouped=new Map();
 for(const prospect of prospects){
  const domain=normalizedBusinessDomain(prospect?.domain);
  if(!domain||!prospect?.id)continue;
  const list=grouped.get(domain)||[];list.push(prospect.id);grouped.set(domain,list);
 }
 return leads.map(lead=>{
  const domain=normalizedBusinessDomain(lead?.website);
  const matching=domain?grouped.get(domain)||[]:[];
  return {
   leadId:lead.id,
   leadStatus:lead.status,
   emailVerified:lead.emailVerified===true,
   readyForOwnershipReview:lead.emailVerified===true && matching.length===1,
   candidateCount:matching.length,
   candidateProspectId:matching.length===1?matching[0]:null,
   state:!domain?"missing-verifiable-domain":matching.length===0?"no-exact-match":matching.length===1?"manual-ownership-verification-required":"ambiguous-match",
   verifiedOwnership:false,
   accessGranted:false,
   assessmentReady:false
  };
 });
}
