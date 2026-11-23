import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: exercise real admin pilot route control flow with dependency
// stubs. Never connect to Neon, send mail, grant a live pilot or issue a token.
const source=(await readFile(new URL('../app/api/admin-pilots/route.js',import.meta.url),'utf8'))
 .replace(/^import .*;$/gm,'')
 .replace(/export async function /g,'async function ');
const clientId='11111111-1111-4111-8111-111111111111';
function scenario({credential=null,account={client:{id:clientId,name:'ZERA Clothing',plan:'Pilot',status:'active'}},action='grant',email='pilot@example.test',confirmZeraPilotBootstrap=false,priorPilot=null,emailSenderConfigured=true,signingConfigured=true,otherTenantEmailUsed=false,signingFails=false}={}){
 const calls=[];
 const route=new Function('requireAdmin','enforceSameOrigin','getClientAccount','listClients',
  'getPilotAccess','grantPilot','revokePilot','getClientCredential','getClientCredentialByEmail','createPaymentAccessToken','process',
  source+';return {POST};')(
  async()=>null,()=>null,async()=>account,async()=>[],
  async()=>priorPilot,async()=>{calls.push('grant')},async()=>{calls.push('revoke')},
  async()=>credential,async()=>otherTenantEmailUsed?{clientId:'OTHER_SYNTHETIC_TENANT'}:null,
  async()=>{calls.push('payment-token');if(signingFails)throw Error('synthetic-signing-failure');return 'SYNTHETIC_TOKEN'},
  {env:{...(emailSenderConfigured?{RESEND_API_KEY:'synthetic-test-key',EMAIL_FROM:'test@example.invalid'}:{}),...(signingConfigured?{AUTH_SECRET:'SYNTHETIC_SIGNING_SECRET'}:{})}});
 const req=new Request('https://test.example/api/admin-pilots',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({clientId,action,email,days:7,reason:'Synthetic customer pilot acceptance',confirmZeraPilotBootstrap})
 });
 return {calls,invoke:()=>route.POST(req)};
}
test('pilot grant with missing login credential fails closed without entitlement or token',async()=>{
 const {calls,invoke}=scenario();
 const result=await invoke();
 assert.equal(result.status,409);
 assert.deepEqual(calls,[]);
 assert.match((await result.json()).error,/giriş kaydı yok/);
});
test('pilot identity mismatch fails before any grant',async()=>{
 const {calls,invoke}=scenario({credential:{email:'different@example.test'}});
 const result=await invoke();
 assert.equal(result.status,409);
 assert.deepEqual(calls,[]);
});
test('matched provisioned login permits reviewed pilot grant path',async()=>{
 const {calls,invoke}=scenario({credential:{email:'PILOT@example.test'}});
 const result=await invoke();
 assert.equal(result.status,200);
 assert.deepEqual(calls,['payment-token','grant']);
});
test('failed link signing cannot create a pilot entitlement',async()=>{
 for(const action of ['grant','bootstrap']){
  const {calls,invoke}=scenario({action,confirmZeraPilotBootstrap:true,
   credential:action==='grant'?{email:'pilot@example.test'}:null,
   signingFails:true});
  const result=await invoke();
  assert.equal(result.status,400);
  assert.deepEqual(calls,['payment-token']);
  assert.equal((await result.json()).error.includes('Pilot açılamadı'),true);
 }
});

test('pilot revocation does not require a credential or create payment token',async()=>{
 const {calls,invoke}=scenario({action:'revoke'});
 const result=await invoke();
 assert.equal(result.status,200);
 assert.deepEqual(calls,['revoke']);
});

test('explicit ZERA bootstrap creates one test pilot invite without pre-existing password',async()=>{
 const {calls,invoke}=scenario({action:'bootstrap',confirmZeraPilotBootstrap:true});
 const result=await invoke();
 assert.equal(result.status,200);
 assert.deepEqual(calls,['payment-token','grant']);
 const body=await result.json();
 assert.equal(body.testOnly,true);
 assert.match(body.pilotUrl,/^\/odeme\?token=/);
 assert.doesNotMatch(JSON.stringify(body),/pilot@example.test|password|PRIVATE/);
});
test('missing explicit confirmation or non-ZERA customer blocks bootstrap',async()=>{
 for(const options of [
  {action:'bootstrap'},
  {action:'bootstrap',confirmZeraPilotBootstrap:true,
   account:{client:{id:clientId,name:'Other Customer',plan:'Pilot',status:'active'}}},
  {action:'bootstrap',confirmZeraPilotBootstrap:true,
   account:{client:{id:clientId,name:'ZERA Clothing',plan:'Pilot',status:'payment-review'}}},
  {action:'bootstrap',confirmZeraPilotBootstrap:true,credential:{email:'pilot@example.test'}},
  {action:'bootstrap',confirmZeraPilotBootstrap:true,priorPilot:{email:'pilot@example.test'}}
 ]){
  const {calls,invoke}=scenario(options);
  assert.equal((await invoke()).status,409);
  assert.deepEqual(calls,[]);
 }
});
test('unknown action cannot grant or generate a payment token',async()=>{
 const {calls,invoke}=scenario({action:'unknown',credential:{email:'pilot@example.test'}});
 assert.equal((await invoke()).status,400);
 assert.deepEqual(calls,[]);
});

test('ZERA first-account bootstrap denies invitation if email sender is unconfigured',async()=>{
 const {calls,invoke}=scenario({action:'bootstrap',confirmZeraPilotBootstrap:true,
  emailSenderConfigured:false});
 const result=await invoke();
 assert.equal(result.status,503);
 assert.deepEqual(calls,[],'must not grant entitlement or create link');
 assert.match((await result.json()).error,/E-posta doğrulama/);
});

test('no invitation signing key means zero pilot writes or payment tokens',async()=>{
 for(const action of ['bootstrap','grant']){
  const {calls,invoke}=scenario({action,confirmZeraPilotBootstrap:true,
   credential:action==='grant'?{email:'pilot@example.test'}:null,signingConfigured:false});
  const result=await invoke();
  assert.equal(result.status,503);
  assert.deepEqual(calls,[]);
 }
});

test('existing email on a different customer blocks ZERA activation before pilot write',async()=>{
 const {calls,invoke}=scenario({action:'bootstrap',confirmZeraPilotBootstrap:true,otherTenantEmailUsed:true});
 const response=await invoke();
 assert.equal(response.status,409);
 assert.deepEqual(calls,[]);
 const payload=await response.json();
 assert.match(payload.error,/başka bir müşteri giriş hesabına bağlı/);
 assert.doesNotMatch(JSON.stringify(payload),/OTHER_SYNTHETIC_TENANT/);
});
