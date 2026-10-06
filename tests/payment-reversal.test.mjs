import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=(await fs.readFile(new URL('../lib/payment-reversal.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
function fixture({remaining=false,status='paid',method='bank-transfer',failAudit=false}={}){
 const calls=[];const tx={release(){calls.push('release')},async query(sql,args){calls.push(sql);if(sql.startsWith('SELECT * FROM payments'))return {rows:[{id:'p',client_id:'c',status,method,reference_code:'AIV-TEST'}]};if(sql.startsWith('SELECT 1 FROM payments'))return {rows:remaining?[{x:1}]:[]};if(sql.includes('to_regclass'))return {rows:[{}]};if(sql.startsWith('INSERT INTO client_activity')&&failAudit)throw Error('audit-failed');return {rows:[]}}};
 return {calls,reverse:new Function('databasePool','getDatabaseUrl','randomUUID',source+';return reversePayment')(()=>({connect:async()=>tx}),()=> 'test-url',()=> 'audit-id')};
}
test('reversal suspends unpaid access, preserves other paid service, and rolls back on audit failure',async()=>{
 for(const options of [{},{remaining:true},{failAudit:true},{status:'customer-reported'},{method:'card'}]){
  const {calls,reverse}=fixture(options);const fails=options.failAudit||options.status||options.method;
  if(fails){await assert.rejects(reverse('p','Wrong approval'));assert.ok(calls.includes('ROLLBACK'));assert.ok(!calls.includes('COMMIT'));}
  else{const r=await reverse('p','Wrong approval');assert.equal(r.accessSuspended,!options.remaining);assert.equal(calls.some(x=>x.startsWith('UPDATE clients')),!options.remaining);assert.ok(calls.includes('COMMIT'));}
  assert.equal(calls.at(-1),'release');
 }
});
