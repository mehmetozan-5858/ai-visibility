import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {freeApplicantProofStorageStatus} from '../lib/free-applicant-proof-storage-status.mjs';

test('read-only proof storage check is not equivalent to live evidence acceptance',async()=>{
 const db=new PGlite();
 try{
  const before=await freeApplicantProofStorageStatus(db);
  assert.equal(before.status,'schema-incomplete');
  assert.equal(before.ready,false);
  assert.equal(before.customerAcceptance,false);
  await db.exec(await readFile(new URL('../migrations/free-applicant-verified-proof-review.sql',import.meta.url),'utf8'));
  const after=await freeApplicantProofStorageStatus(db);
  assert.equal(after.status,'schema-present-unverified');
  assert.equal(after.receiptsTablePresent,true);
  assert.equal(after.observationsTablePresent,true);
  assert.equal(after.ready,false);
  assert.equal(after.customerAcceptance,false);
  assert.ok(!JSON.stringify(after).includes('response_id'));
 }finally{await db.close()}
});
test('unavailable or malformed database cannot report proof readiness',async()=>{
 for(const db of [null,{}, {query:async()=>({rows:[{}]})},{query:async()=>{throw Error('private connection secret')}}]){
  const state=await freeApplicantProofStorageStatus(db);
  assert.equal(state.status,'unavailable');
  assert.equal(state.customerAcceptance,false);
  assert.equal(state.ready,false);
  assert.doesNotMatch(JSON.stringify(state),/private connection secret/);
 }
});
