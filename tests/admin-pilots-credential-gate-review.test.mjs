import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: exercise real admin pilot route control flow with dependency
// stubs. Never connect to Neon, send mail, grant a live pilot or issue a token.
const source=(await readFile(new URL('../app/api/admin-pilots/route.js',import.meta.url),'utf8'))
 .replace(/^import .*;$/gm,'')
 .replace(/export async function /g,'async function ');
const clientId='11111111-1111-4111-8111-111111111111';
function scenario({credential=null,account={client:{id:clientId,name:'ZERA Clothing'}},action='grant',email='pilot@example.test'}={}){
 const calls=[];
 const route=new Function('requireAdmin','enforceSameOrigin','getClientAccount','listClients',
  'getPilotAccess','grantPilot','revokePilot','getClientCredential','createPaymentAccessToken',
  source+';return {POST};')(
  async()=>null,()=>null,async()=>account,async()=>[],
  async()=>null,async()=>{calls.push('grant')},async()=>{calls.push('revoke')},
  async()=>credential,async()=>{calls.push('payment-token');return 'SYNTHETIC_TOKEN'});
 const req=new Request('https://test.example/api/admin-pilots',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({clientId,action,email,days:7,reason:'Synthetic customer pilot acceptance'})
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
 assert.deepEqual(calls,['grant','payment-token']);
});
test('pilot revocation does not require a credential or create payment token',async()=>{
 const {calls,invoke}=scenario({action:'revoke'});
 const result=await invoke();
 assert.equal(result.status,200);
 assert.deepEqual(calls,['revoke']);
});
