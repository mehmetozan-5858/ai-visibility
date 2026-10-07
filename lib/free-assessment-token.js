import {createHmac,timingSafeEqual} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function signature(value,secret){return createHmac('sha256',secret).update(value).digest('base64url')}
export function createFreeAssessmentToken(id,{secret=process.env.AUTH_SECRET,now=Date.now(),ttl=30*86400}={}){
 if(!secret||!uuid.test(id))throw Error('preview-token-unavailable');
 const value=`free-assessment.${id}.${Math.floor(now/1000)+Math.max(300,Math.min(30*86400,ttl))}`;
 return value+'.'+signature(value,secret);
}
export function verifyFreeAssessmentToken(token,{secret=process.env.AUTH_SECRET,now=Date.now()}={}){
 if(!secret||typeof token!=='string'||token.length>300)return null;
 const parts=token.split('.');if(parts.length!==4||parts[0]!=='free-assessment'||!uuid.test(parts[1]))return null;
 const exp=Number(parts[2]);if(!Number.isSafeInteger(exp)||exp<=Math.floor(now/1000)||exp>Math.floor(now/1000)+30*86400)return null;
 const expected=signature(parts.slice(0,3).join('.'),secret),sig=parts[3];
 return /^[A-Za-z0-9_-]{43}$/.test(sig)&&sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected))?{prospectId:parts[1],exp}:null;
}
export function freeAssessmentUrl(id,options={}){
 const base=new URL(options.base||process.env.PUBLIC_APP_URL||'https://www.aivisibilityworks.com');
 if(base.protocol!=='https:'||base.username||base.password)throw Error('preview-url-unavailable');
 return `${base.origin}/on-degerlendirme#token=${encodeURIComponent(createFreeAssessmentToken(id,options))}`;
}
