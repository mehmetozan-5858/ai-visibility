import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {sandboxEnabled} from './paddle-sandbox.js';
export const SANDBOX_SESSION_COOKIE='ai_paddle_sandbox_client';
export function createSandboxSession({env=process.env,now=Date.now()}={}){
 if(!sandboxEnabled(env)||!env.PADDLE_SANDBOX_WEBHOOK_SECRET)throw Error('sandbox-session-disabled');
 const clientId='sandbox-browser-'+randomUUID();
 const exp=Math.floor(now/1000)+3600;
 const body=`sandbox-client.${clientId}.${exp}`;
 const signature=createHmac('sha256',env.PADDLE_SANDBOX_WEBHOOK_SECRET).update(body).digest('hex');
 return `${body}.${signature}`;
}
export function verifySandboxSession(token='',{env=process.env,now=Date.now()}={}){
 if(!sandboxEnabled(env)||!env.PADDLE_SANDBOX_WEBHOOK_SECRET)return null;
 const parts=String(token).split('.');
 if(parts.length!==4||parts[0]!=='sandbox-client'||!/^sandbox-browser-[0-9a-f-]{36}$/.test(parts[1])||!/^\d{10}$/.test(parts[2])||!/^[0-9a-f]{64}$/.test(parts[3]))return null;
 const exp=Number(parts[2]),current=Math.floor(now/1000);
 if(exp<=current||exp>current+3600)return null;
 const expected=createHmac('sha256',env.PADDLE_SANDBOX_WEBHOOK_SECRET).update(parts.slice(0,3).join('.')).digest();
 return timingSafeEqual(expected,Buffer.from(parts[3],'hex'))?{clientId:parts[1],exp}:null;
}
