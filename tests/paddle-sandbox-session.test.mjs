import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandboxSession,verifySandboxSession} from '../lib/paddle-sandbox-session.js';
const env={VERCEL_ENV:'preview',PADDLE_ENVIRONMENT:'sandbox',PADDLE_SANDBOX_ENABLED:'true',PADDLE_SANDBOX_WEBHOOK_SECRET:'local-fixture-secret-no-external-use'};
const now=1791950000000;
test('fixture sessions are server-created, distinct and signed; no existing customer identity is supplied',()=>{
 const a=createSandboxSession({env,now}),b=createSandboxSession({env,now});
 const session=verifySandboxSession(a,{env,now});
 assert.match(session.clientId,/^sandbox-browser-[0-9a-f-]{36}$/);
 assert.notEqual(session.clientId,verifySandboxSession(b,{env,now}).clientId);
 assert.equal(session.exp,Math.floor(now/1000)+3600);
});
test('production and disabled or unconfigured Sandbox cannot mint or accept fixture sessions',()=>{
 const token=createSandboxSession({env,now});
 for(const e of [{...env,VERCEL_ENV:'production'},{...env,PADDLE_ENVIRONMENT:'live'},{...env,PADDLE_SANDBOX_ENABLED:'false'},{...env,PADDLE_SANDBOX_WEBHOOK_SECRET:''}]){
  assert.throws(()=>createSandboxSession({env:e,now}));assert.equal(verifySandboxSession(token,{env:e,now}),null);
 }
});
test('tampered identity, purpose, expiry, signature and alternate signing key fail closed',()=>{
 const token=createSandboxSession({env,now});
 for(const t of [token.replace('sandbox-browser-','real-customer-'),token.replace('sandbox-client','client'),token+'.extra',token.slice(0,-1)+'z',token.replace(token.split('.')[2],'9999999999')])assert.equal(verifySandboxSession(t,{env,now}),null);
 assert.equal(verifySandboxSession(token,{env:{...env,PADDLE_SANDBOX_WEBHOOK_SECRET:'different-key'},now}),null);
 assert.equal(verifySandboxSession(token,{env,now:now+3600000}),null);
});
