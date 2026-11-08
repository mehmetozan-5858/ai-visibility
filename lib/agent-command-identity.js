import {createHmac,timingSafeEqual} from 'node:crypto';
import {commandControlStatus} from './agent-command-control.js';

const validId=x=>typeof x==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(x);
const audience='agent-command-control-v1';
// Keys and lookup are trusted server configuration. Tokens carry no tenant or scope grants.
export function createAgentIdentityResolver({keys,getAgent,clock=()=>Math.floor(Date.now()/1000)}){
 if(!keys || typeof keys!=='object' || Array.isArray(keys) || typeof getAgent!=='function')throw Error('invalid-identity-config');
 const keyMap=new Map(Object.entries(keys));
 if(!keyMap.size || [...keyMap].some(([id,key])=>!validId(id) || typeof key!=='string' || Buffer.byteLength(key)<32))throw Error('invalid-identity-config');
 function agent(actorId){
  const value=getAgent(actorId),status=commandControlStatus();
  if(!value || value.enabled!==true || !validId(value.tenantId) ||
   !Array.isArray(value.projects) || !value.projects.length || value.projects.some(p=>!status.projects.includes(p)) ||
   !Array.isArray(value.actions) || !value.actions.length || value.actions.some(a=>!status.actions.includes(a)))throw Error('invalid-agent-token');
  return {authenticated:true,actorId,tenantId:value.tenantId,projects:[...value.projects],actions:[...value.actions]};
 }
 const sign=(text,key)=>createHmac('sha256',key).update(text).digest('base64url');
 return Object.freeze({
  issue({actorId,keyId,ttlSeconds=300}){
   if(!validId(actorId) || !keyMap.has(keyId) || !Number.isInteger(ttlSeconds) || ttlSeconds<1 || ttlSeconds>900)throw Error('invalid-token-request');
   agent(actorId);const iat=clock();if(!Number.isSafeInteger(iat))throw Error('invalid-clock');
   const body=Buffer.from(JSON.stringify({v:1,aud:audience,sub:actorId,kid:keyId,iat,exp:iat+ttlSeconds})).toString('base64url');
   return body+'.'+sign(body,keyMap.get(keyId));
  },
  resolve(token){
   try{
    if(typeof token!=='string' || token.length>4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))throw Error();
    const [body,signature]=token.split('.'),payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if(!payload || Object.keys(payload).sort().join(',')!=='aud,exp,iat,kid,sub,v' || payload.v!==1 || payload.aud!==audience ||
     !validId(payload.sub) || !keyMap.has(payload.kid))throw Error();
    const expected=Buffer.from(sign(body,keyMap.get(payload.kid))),supplied=Buffer.from(signature);
    if(expected.length!==supplied.length || !timingSafeEqual(expected,supplied))throw Error();
    const now=clock();
    if(!Number.isSafeInteger(now) || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) ||
     payload.iat>now || payload.exp<=now || payload.exp<=payload.iat || payload.exp-payload.iat>900)throw Error();
    return agent(payload.sub);
   }catch{throw Error('invalid-agent-token');}
  }
 });
}
