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
  assert.equal(after.providerConsentTablePresent,false);
  assert.equal(after.consentStorageReady,false);
  assert.equal(after.reason,'reviewed-provider-consent-schema-not-installed');
  assert.equal(after.receiptRlsEnabled,true);
  assert.equal(after.observationRlsEnabled,true);
  assert.ok(['privileged-role-bypasses-rls','unprivileged-role-not-yet-audited','role-unverified'].includes(after.dbRoleSafety));
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

test('read-only diagnostic flags a privileged runtime role without leaking its identity',async()=>{
 const sqlResult={rows:[{receipts:true,observations:true,consents:true,privilegedRole:true,
  receiptsRls:true,observationsRls:true}]};
 const s=await freeApplicantProofStorageStatus({query:async()=>sqlResult});
 assert.equal(s.dbRoleSafety,'privileged-role-bypasses-rls');
 assert.equal(s.ready,false);
 assert.equal(s.customerAcceptance,false);
 assert.equal(JSON.stringify(s).includes('neondb_owner'),false);
});

test('missing consent schema or malformed consent diagnostics never report customer readiness',async()=>{
 const first=await freeApplicantProofStorageStatus({query:async()=>({rows:[{
  receipts:true,observations:true,consents:false,privilegedRole:false,
  receiptsRls:true,observationsRls:true}]})});
 assert.equal(first.providerConsentTablePresent,false);
 assert.equal(first.reason,'reviewed-provider-consent-schema-not-installed');
 assert.equal(first.ready,false);
 const malformed=await freeApplicantProofStorageStatus({query:async()=>({rows:[{
  receipts:true,observations:true,consents:'true'}]})});
 assert.equal(malformed.status,'unavailable');
 assert.equal(malformed.customerAcceptance,false);
});
