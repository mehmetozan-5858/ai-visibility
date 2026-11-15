import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY: the disposable PostgreSQL race tests execute in parallel CI.
// Force-dropped databases can kill another in-flight connection with 57P01
// after the test runner has already reported success or failure.
test('two-backend card/revoke race drains clients before dropping its isolated database',async()=>{
 const source=await readFile(new URL('./portal-card-revoke-two-backend-postgres-review.test.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/DROP DATABASE[^\n]*WITH\s*\(FORCE\)/i);
 assert.match(source,/if\(pendingCard\)await pendingCard\.catch\(\(\)=>\{\}\)/);
 assert.match(source,/if\(pendingRevoke\)await pendingRevoke\.catch\(\(\)=>\{\}\)/);
 assert.match(source,/observer\?\.release\(\);revoker\?\.release\(\)/);
 assert.match(source,/if\(db\)await db\.end\(\);\s*if\(created\)await admin\.query\('DROP DATABASE IF EXISTS/);
});
