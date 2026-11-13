import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('answer evidence distinguishes provider, cost-ledger and observation failure without exposing raw details',async()=>{
 const source=await readFile(new URL('../lib/answer-evidence-providers.js',import.meta.url),'utf8');
 const collection=source.slice(source.indexOf('export async function collectAnswerEvidence'));
 assert.match(collection,/reason:'provider-request-failed'/);
 assert.match(collection,/reason:'cost-recording-failed'/);
 assert.match(collection,/reason:'invalid-observation'/);
 assert.match(collection,/try\{answer=await withRequestBudget/);
 assert.match(collection,/try\{await recordCost/);
 assert.match(collection,/try\{observations\.push\(answerObservation/);
 assert.match(collection,/catch\{errors\.push\(\{provider,query,reason:'provider-request-failed'/);
 assert.match(collection,/catch\{errors\.push\(\{provider,query,reason:'cost-recording-failed'/);
 assert.match(collection,/catch\{errors\.push\(\{provider,query,reason:'invalid-observation'/);
 assert.doesNotMatch(collection,/error:(?:String\(error\)|error\.message|err\.message)/);
});
