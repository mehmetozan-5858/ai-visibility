/**
 * Fail-closed review policy for binding an applicant to a prospect with stored observations.
 * Never infer ownership from a domain match, an email token, or a prospect contact email.
 * Inputs must be loaded by a trusted server transaction, not submitted by the applicant.
 */
import {normalizedBusinessDomain} from "./customer-assessment-candidates.mjs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function evaluateApplicantAssessmentLink({lead,challenge,prospect,ownership,existingLinks=[]}={}){
 const deny=(reason)=>({allowed:false,reason,createsAccount:false,issuesToken:false,startsProvider:false});
 if(!uuid.test(lead?.id||"")||!uuid.test(prospect?.id||""))return deny("invalid-ids");
 if(!challenge||challenge.leadId!==lead.id||challenge.email!==String(lead.email||"").trim().toLowerCase()||
    !challenge.verifiedAt||!challenge.consumedAt)return deny("email-not-verified");
 const leadDomain=normalizedBusinessDomain(lead.website),prospectDomain=normalizedBusinessDomain(prospect.domain);
 if(!leadDomain||!prospectDomain||leadDomain!==prospectDomain)return deny("domain-mismatch");
 if(!ownership||ownership.leadId!==lead.id||ownership.prospectId!==prospect.id||
    ownership.domain!==leadDomain||ownership.status!=="verified"||
    ownership.source!=="trusted-server-review"||!ownership.verifiedAt||
    !uuid.test(ownership.reviewId||""))return deny("business-ownership-unverified");
 if(!Array.isArray(existingLinks)||existingLinks.some(x=>
    x.leadId===lead.id&&x.prospectId!==prospect.id ||
    x.prospectId===prospect.id&&x.leadId!==lead.id))return deny("conflicting-link");
 return {allowed:true,reason:"reviewed-identity-only",leadId:lead.id,prospectId:prospect.id,
  createsAccount:false,issuesToken:false,startsProvider:false};
}
