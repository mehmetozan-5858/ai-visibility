import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Verify actual shipped implementations, not a copied DDL-free adapter.
// These are review-only checks, not a live Neon minimum-privilege proof.
const credential=await readFile(new URL('../lib/client-credentials.js',import.meta.url),'utf8');
const verification=await readFile(new URL('../lib/email-verification.js',import.meta.url),'utf8');

test('customer credential routes never run request-time schema creation',()=>{
 assert.match(credential,/async function withDb\(fn\)/);
 assert.match(credential,/return await fn\(pool\)/);
 assert.doesNotMatch(credential,/CREATE\s+(?:TABLE|INDEX)/i);
 assert.match(credential,/INSERT INTO client_credentials/);
 assert.match(credential,/ON CONFLICT\(client_id\) DO NOTHING/);
});
test('email verification code flow relies on provisioned schema and uses scoped writes',()=>{
 assert.doesNotMatch(verification,/CREATE\s+(?:TABLE|INDEX)/i);
 assert.match(verification,/INSERT INTO client_email_verifications/);
 assert.match(verification,/UPDATE client_email_verifications/);
 assert.match(verification,/DELETE FROM client_email_verifications/);
 assert.match(verification,/WHERE client_id=\$1 AND lower\(email\)=lower\(\$2\)/);
 assert.match(verification,/RESEND_API_KEY/);
 assert.match(verification,/RESEND_FROM_EMAIL/);
});
