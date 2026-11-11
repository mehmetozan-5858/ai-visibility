import {randomBytes} from "node:crypto";
import {resolveTxt} from "node:dns/promises";
import {normalizedBusinessDomain} from "./customer-assessment-candidates.mjs";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const domainProofEnabled=()=>process.env.APPLICANT_DOMAIN_PROOF_ENABLED==="true";
export const validUuid=value=>typeof value==="string"&&uuid.test(value);
function publicDomain(domain){
 const normalized=normalizedBusinessDomain(domain);
 if(!normalized||/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(normalized)||/\\.(?:local|internal|localhost)$/.test(normalized))return null;
 return normalized;
}
export function domainProofRecord(domain,nonce){
 const normalized=publicDomain(domain);
 if(!normalized||/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(normalized)||/\\.(?:local|internal|localhost)$/.test(normalized)||!/^[a-f0-9]{48}$/.test(String(nonce||"")))throw Error("invalid-domain-proof");
 return {record:"_aiv-verify."+normalized,value:"aiv-lead="+nonce};
}
export function newDomainProofNonce(){return randomBytes(24).toString("hex");}
export async function checkDomainTxtProof(domain,nonce,{lookup=resolveTxt}={}){
 const item=domainProofRecord(domain,nonce);
 // No redirects, HTTP fetches or internal network URLs. DNS TXT only, exact comparison.
 try{
  const records=await Promise.race([
   lookup(item.record),
   new Promise((_,reject)=>setTimeout(()=>reject(Error("dns-timeout")),4000)),
  ]);
  return Array.isArray(records)&&records.some(parts=>Array.isArray(parts)&&parts.join("")===item.value);
 }catch{return false}
}
export function matchingApplicantDomain(lead,prospect){
 const left=publicDomain(lead?.website),right=publicDomain(prospect?.domain);
 return left&&left===right?left:null;
}
