import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyHash} from '../lib/client-password-verifier.mjs';
import {createClientToken,verifyClientToken} from '../lib/admin-auth.js';

// Synthetic-only acceptance: never change any real customer password/hash.
const A='11111111-1111-4111-8111-111111111111';
test('existing scrypt password accepts original secret and can issue a signed customer session',async()=>{
 const original=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='synthetic-login-session-key-for-isolated-test';
 try{
  const password='synthetic-correct-existing-password';
  const stored=hashPassword(password);
  assert.match(stored,/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(verifyHash(password,stored),true);
  assert.equal(verifyHash(password+'wrong',stored),false);
  const cookie=await createClientToken(A);
  assert.equal((await verifyClientToken(cookie))?.clientId,A);
  assert.equal(await verifyClientToken(cookie+'tampered'),null);
 }finally{
  if(original===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=original;
 }
});
test('malformed or unsupported stored verifier denies login without throwing or modifying stored value',()=>{
 const password='synthetic-unmodified-customer-password';
 const valid=hashPassword(password);
 const invalid=[
  null,undefined,'','plaintext-password','md5$abcd$1234',
  'scrypt$$','scrypt$zz$'+'f'.repeat(128),
  'scrypt$'+'a'.repeat(32)+'$'+'q'.repeat(128),
  'scrypt$'+'a'.repeat(30)+'$'+'b'.repeat(128),
  'scrypt$'+'a'.repeat(32)+'$'+'b'.repeat(126),
  valid+'$extra',42,{}
 ];
 for(const stored of invalid)
  assert.equal(verifyHash(password,stored),false,'malformed verifier must reject');
 assert.equal(verifyHash(password,valid),true,'existing valid password remains usable');
});
