import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=()=>readFile(new URL('../lib/payment-reversal.js',import.meta.url),'utf8');

function inspectReversalLockOrder(source){
 const body=source.slice(source.indexOf('export async function reversePayment('));
 const tenant=body.indexOf('SELECT client_id AS "clientId" FROM payments WHERE id=$1');
 const advisory=body.indexOf('await acquirePilotAdvisoryLockReview(tx,bound.clientId)');
 const row=body.indexOf('SELECT * FROM payments WHERE id=$1 AND client_id=$2 FOR UPDATE');
 const suspend=body.indexOf("UPDATE clients SET status='payment-review'");
 const commit=body.indexOf('await tx.query("COMMIT")');
 return {tenant,advisory,row,suspend,commit,
  safe:tenant>=0&&advisory>tenant&&row>advisory&&
   suspend>row&&commit>suspend&&
   body.includes('BEGIN ISOLATION LEVEL READ COMMITTED')&&
   body.includes('await tx.query("ROLLBACK")')};
}

test('bank reversal resolves stored tenant and takes shared advisory lock before payment row lock',async()=>{
 const source=await read();
 assert.match(source,/import \{acquirePilotAdvisoryLockReview\} from "\.\/portal-pilot-advisory-lock-review\.mjs"/);
 assert.equal(inspectReversalLockOrder(source).safe,true);
 assert.match(source,/\[id,bound\.clientId\]\)\)\.rows\[0\]/);
});

test('a removed or late reversal advisory lock is rejected by release-review regression',async()=>{
 const source=await read();
 assert.equal(inspectReversalLockOrder(source.replace(
  'await acquirePilotAdvisoryLockReview(tx,bound.clientId);',
  '/* no serialization */')).safe,false);
 const late=source.replace(
  'await acquirePilotAdvisoryLockReview(tx,bound.clientId);','')
  .replace('if(!payment||payment.status','await acquirePilotAdvisoryLockReview(tx,bound.clientId);\n  if(!payment||payment.status');
 assert.equal(inspectReversalLockOrder(late).safe,false,
  'row lock before shared advisory lock must fail review');
});
