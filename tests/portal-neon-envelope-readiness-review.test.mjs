import test from 'node:test';
import assert from 'node:assert/strict';
import {
 signedEnvelopeReadinessSql,
 signedEnvelopeRequiredChecks,
 evaluateSignedEnvelopeReadiness,
 inspectSignedEnvelopeReadiness,
 signedEnvelopePreinstallChecks,
 signedEnvelopePostinstallChecks,
 evaluateSignedEnvelopeStage
} from '../lib/portal-neon-envelope-readiness-review.mjs';

const complete=()=>Object.fromEntries(signedEnvelopeRequiredChecks.map(k=>[k,true]));

test('missing entire reviewed owner/schema/HMAC/RPC inventory is HOLD',()=>{
 const result=evaluateSignedEnvelopeReadiness({});
 assert.equal(result.ready,false);
 assert.equal(result.blocked.length,signedEnvelopeRequiredChecks.length);
 assert.ok(result.blocked.includes('ownerExists'));
 assert.ok(result.blocked.includes('approvedHmac'));
 assert.ok(result.blocked.includes('rpcInstalled'));
});

test('every single missing privilege or extension component individually blocks release',()=>{
 for(const key of signedEnvelopeRequiredChecks){
  const row=complete();
  row[key]=false;
  const result=evaluateSignedEnvelopeReadiness(row);
  assert.deepEqual(result,{ready:false,blocked:[key],
   reason:'reviewed-envelope-prerequisites-blocked'},key);
 }
});

test('all metadata prerequisites still claim only metadata readiness',()=>{
 assert.deepEqual(evaluateSignedEnvelopeReadiness(complete()),
  {ready:true,blocked:[],reason:'metadata-only-prerequisites-present'});
});

test('SQL inventory uses PostgreSQL catalogs, no customer rows or secrets',()=>{
 assert.match(signedEnvelopeReadinessSql,/pg_catalog\.pg_roles/);
 assert.match(signedEnvelopeReadinessSql,/pg_catalog\.pg_extension/);
 assert.match(signedEnvelopeReadinessSql,/e\.extname='pgcrypto'/);
 assert.match(signedEnvelopeReadinessSql,/has_column_privilege/);
 assert.match(signedEnvelopeReadinessSql,/portal_authz\.hmac\(bytea,bytea,text\)/);
 assert.doesNotMatch(signedEnvelopeReadinessSql,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\s+(?:INTO|TABLE|ROLE|EXTENSION|SCHEMA|ON|FROM|public\.)/i);
 assert.doesNotMatch(signedEnvelopeReadinessSql,/\bSELECT\s+(?:\*|secret|password_hash)\s+FROM\s+public\./i);
});

test('single-row metadata result produces blocked fields; errors fail closed',async()=>{
 let calls=0;
 const blocked=await inspectSignedEnvelopeReadiness({query:async sql=>{
  calls++;
  assert.equal(sql,signedEnvelopeReadinessSql);
  return {rows:[{...complete(),ownerSigningKeySelect:false}]};
 }});
 assert.equal(calls,1);
 assert.deepEqual(blocked.blocked,['ownerSigningKeySelect']);
 assert.equal(blocked.ready,false);
 assert.equal((await inspectSignedEnvelopeReadiness({query:async()=>{
  throw Error('not provisioned');
 }})).reason,'read-only-inspection-failed');
 assert.equal((await inspectSignedEnvelopeReadiness()).ready,false);
});

test('preinstall stage is independent of migration-created tables and RPC',()=>{
 const row=complete();
 for(const key of signedEnvelopePostinstallChecks)row[key]=false;
 const pre=evaluateSignedEnvelopeStage(row,'preinstall');
 assert.deepEqual(pre,{ready:true,stage:'preinstall',blocked:[],
  reason:'metadata-only-stage-present'});
 const post=evaluateSignedEnvelopeStage(row,'postinstall');
 assert.deepEqual(post.blocked,[...signedEnvelopePostinstallChecks]);
 assert.equal(post.ready,false);
 assert.equal(evaluateSignedEnvelopeReadiness(row).ready,false);
});

test('preinstall gate requires each owner and extension prerequisite; never relaxes',()=>{
 assert.equal(signedEnvelopePreinstallChecks.length,13);
 assert.equal(signedEnvelopePostinstallChecks.length,5);
 assert.equal(new Set([...signedEnvelopePreinstallChecks,...signedEnvelopePostinstallChecks]).size,
  signedEnvelopeRequiredChecks.length);
 for(const key of signedEnvelopePreinstallChecks){
  const row=complete();
  row[key]=false;
  assert.deepEqual(evaluateSignedEnvelopeStage(row,'preinstall').blocked,[key],key);
 }
 assert.equal(evaluateSignedEnvelopeStage(complete(),'unknown').ready,false);
});

test('postinstall cannot pass if preinstall owner or HMAC disappears',()=>{
 const row=complete();
 row.ownerExists=false;
 row.approvedHmac=false;
 assert.equal(evaluateSignedEnvelopeStage(row,'preinstall').ready,false);
 const post=evaluateSignedEnvelopeStage(row,'postinstall');
 assert.equal(post.ready,false);
 assert.deepEqual(post.blocked,['ownerExists','approvedHmac']);
});

test('postinstall must verify SECURITY DEFINER owner, search_path and no PUBLIC EXECUTE',()=>{
 const row=complete();
 row.rpcSecureOwnerAndAcl=false;
 const pre=evaluateSignedEnvelopeStage(row,'preinstall');
 const post=evaluateSignedEnvelopeStage(row,'postinstall');
 assert.equal(pre.ready,true,'RPC security is a postinstall requirement');
 assert.equal(post.ready,false);
 assert.deepEqual(post.blocked,['rpcSecureOwnerAndAcl']);
 assert.match(signedEnvelopeReadinessSql,/p\.proowner=\(SELECT oid FROM expected\)/);
 assert.match(signedEnvelopeReadinessSql,/p\.prosecdef=true/);
 assert.match(signedEnvelopeReadinessSql,/search_path=pg_catalog/);
 assert.match(signedEnvelopeReadinessSql,/acl\.grantee=0 AND acl\.privilege_type='EXECUTE'/);
});
