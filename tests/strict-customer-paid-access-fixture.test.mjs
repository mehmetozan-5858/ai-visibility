import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
const account={client:{id:'11111111-1111-4111-8111-111111111111',status:'active'},payments:[{status:'paid'}]};
function accessWithProof(proof){
 const pool={query:async()=>({rows:[]})};
 return new Function('crypto','databasePool','getDatabaseUrl','initializeSchema','customerHasVerifiedSettlement',source+';return customerAccess;')(
 {randomUUID:()=> 'mock'},()=>pool,()=> 'fixture',async()=>{},async()=>proof
 );
}
test('strict rollout rejects an internal paid label unless independent settlement is confirmed',async()=>{
 const previous=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED='true';
 try{
  assert.deepEqual(await accessWithProof(false)(account),{allowed:false,kind:'payment-review',reason:'independent-settlement-proof-required'});
  assert.deepEqual(await accessWithProof(true)(account),{allowed:true,kind:'paid'});
  assert.equal((await accessWithProof(true)({...account,client:{...account.client,status:'payment-review'}})).allowed,false);
 }finally{
  if(previous===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
  else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=previous;
 }
});
