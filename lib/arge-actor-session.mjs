import {createHmac, timingSafeEqual} from 'node:crypto';

// This token is separate from the existing tenant-only cookie. Issuance must be
// invoked only after authenticating an individual and resolving their tenant.
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const domain='ai-visibility-arge-actor-v1';
const maxLifetime=3600;
const signature=(payload,secret)=>createHmac('sha256',secret).update(`${domain}.${payload}`).digest();
const validSecret=secret=>typeof secret==='string'&&Buffer.byteLength(secret,'utf8')>=32;

export function issueArgeActorSession({tenantId,actorId,secret,now=Math.floor(Date.now()/1000),ttl=900}={}){
 if(!validId(tenantId)||!validId(actorId)||!validSecret(secret)||!Number.isSafeInteger(now)||
    !Number.isSafeInteger(ttl)||ttl<1||ttl>maxLifetime) throw Error('invalid-actor-session-input');
 const payload=Buffer.from(JSON.stringify({v:1,tenantId,actorId,iat:now,exp:now+ttl})).toString('base64url');
 return `${payload}.${signature(payload,secret).toString('base64url')}`;
}

export function verifyArgeActorSession(token,{secret,tenantId,now=Math.floor(Date.now()/1000)}={}){
 if(!validSecret(secret)||!validId(tenantId)||!Number.isSafeInteger(now)||typeof token!=='string'||token.length>2048)return null;
 const parts=token.split('.');
 if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return null;
 try{
  const supplied=Buffer.from(parts[1],'base64url'),expected=signature(parts[0],secret);
  if(supplied.length!==expected.length||supplied.toString('base64url')!==parts[1]||!timingSafeEqual(supplied,expected))return null;
  const raw=Buffer.from(parts[0],'base64url');
  if(raw.toString('base64url')!==parts[0])return null;
  const claims=JSON.parse(raw.toString('utf8'));
  if(!claims||Object.keys(claims).sort().join(',')!=='actorId,exp,iat,tenantId,v'||claims.v!==1||
    !validId(claims.tenantId)||!validId(claims.actorId)||claims.tenantId!==tenantId||
    !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat>now||
    claims.exp<=now||claims.exp<=claims.iat||claims.exp-claims.iat>maxLifetime)return null;
  // Membership and authorization must still be checked against the database.
  return {clientId:claims.tenantId,actorId:claims.actorId,verified:true,exp:claims.exp};
 }catch{return null;}
}
