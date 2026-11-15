import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: structural guard. Real two-backend PostgreSQL tests must
// independently prove lock ordering; this is NOT a production acceptance.
const source=()=>readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
const body=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));

for(const [name,next] of [
 ['confirmPayment','export async function upsertSalesOpportunity'],
 ['confirmCardPaymentByMerchantOid','export async function markCardPaymentFailedByMerchantOid']
]){
 test(name+' pins tenant lock before payment write and account activation',async()=>{
  const s=await source();
  const start='export async function '+name+'(';
  const section=body(s,start,next);
  assert.ok(section.startsWith(start),'payment writer must exist');
  const steps=[
   'await pool.connect()',
   'BEGIN ISOLATION LEVEL READ COMMITTED',
   "SET LOCAL lock_timeout = '2500ms'",
   "SET LOCAL statement_timeout = '10000ms'",
   'SELECT client_id AS "clientId" FROM payments',
   'await acquirePilotAdvisoryLockReview(tx,bound.clientId)',
   'UPDATE payments SET',
   "UPDATE clients SET plan=$2,status='active'",
   'COMMIT'
  ];
  let last=-1;
  for(const step of steps){
   const i=section.indexOf(step,last+1);
   assert.ok(i>last,'ordered pinned tenant-lock writer step missing: '+step);
   last=i;
  }
  assert.match(section,/await tx.query\("ROLLBACK"\)/);
  assert.match(section,/tx\.release\(\)/);
  assert.doesNotMatch(section,/pool\.query\("UPDATE clients SET/);
 });
}
