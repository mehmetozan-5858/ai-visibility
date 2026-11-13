import {createHmac,timingSafeEqual} from "node:crypto";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const purpose="applicant-assessment-v1";
function safeSecret(input){
 if(typeof input!=="string"||input.length<32)throw Error("assessment-preview-secret-unavailable");
 return input;
}
function sign(payload,secret){
 return createHmac("sha256",safeSecret(secret)).update(payload).digest("base64url");
}
/** Server-issued, short-lived bearer grant, scoped to exactly one verified lead-prospect link. */
export function createApplicantAssessmentGrant({leadId,prospectId,secret=process.env.APPLICANT_ASSESSMENT_SECRET,now=Date.now(),ttlSeconds=900}={}){
 if(!UUID.test(leadId||"")||!UUID.test(prospectId||"")||!Number.isFinite(now))throw Error("invalid-assessment-grant");
 const seconds=Math.min(900,Math.max(60,Math.trunc(ttlSeconds)));
 const exp=Math.floor(now/1000)+seconds;
 const payload=[purpose,leadId,prospectId,exp].join(".");
 return payload+"."+sign(payload,secret);
}
export function verifyApplicantAssessmentGrant(token,{secret=process.env.APPLICANT_ASSESSMENT_SECRET,now=Date.now()}={}){
 if(typeof token!=="string"||token.length>350||!Number.isFinite(now)||typeof secret!=="string"||secret.length<32)return null;
 const p=token.split(".");
 if(p.length!==5||p[0]!==purpose||!UUID.test(p[1])||!UUID.test(p[2])||!/^[0-9]{10,12}$/.test(p[3])||!/^[a-zA-Z0-9_-]{43}$/.test(p[4]))return null;
 const exp=Number(p[3]),current=Math.floor(now/1000);
 if(!Number.isSafeInteger(exp)||exp<=current||exp>current+900)return null;
 const expected=sign(p.slice(0,4).join("."),secret);
 if(!timingSafeEqual(Buffer.from(p[4]),Buffer.from(expected)))return null;
 return {leadId:p[1],prospectId:p[2],expiresAt:exp};
}
export function linkedApplicantAssessmentEnabled(){
 return process.env.APPLICANT_ASSESSMENT_PREVIEW_ENABLED==="true";
}
