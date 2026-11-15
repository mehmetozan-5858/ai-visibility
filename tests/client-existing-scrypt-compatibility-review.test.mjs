import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyHash} from '../lib/client-password-verifier.mjs';

// REVIEW ONLY — synthetic password; no customer hash, DB write or reset.
// Regression for existing-password verification with malformed stored hashes.
test('existing scrypt hash still verifies without rotation or migration',()=>{
 const password='synthetic-existing-customer-password-2026';
 const stored=hashPassword(password);
 assert.match(stored,/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
 assert.equal(verifyHash(password,stored),true);
 assert.equal(verifyHash('synthetic-wrong-password',stored),false);
 assert.equal(verifyHash(password,stored),true,
  'failed attempt must not mutate the stored credential');
});

test('malformed and unsupported stored hashes deny safely',()=>{
 const password='synthetic-existing-customer-password-2026';
 const valid=hashPassword(password);
 const [kind,salt,digest]=valid.split('$');
 const variants=[
  null,undefined,{},42,'','plaintext','bcrypt$something',
  valid+'$extra','scrypt$'+salt,'scrypt$'+salt+'$gg'.repeat(64),
  'scrypt$'+salt+'$'+digest.slice(0,-2),
  'scrypt$'+salt.slice(0,-2)+'$'+digest,
  'scrypt$'+('z'.repeat(32))+'$'+digest,
  'scrypt$'+salt+'$'+('z'.repeat(128)),
  'sha256$'+salt+'$'+digest
 ];
 assert.equal(kind,'scrypt');
 for(const bad of variants)
  assert.equal(verifyHash(password,bad),false,'malformed verifier must deny');
});
