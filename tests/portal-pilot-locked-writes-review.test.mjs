import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../review/portal-pilot-locked-writes.mjs',import.meta.url),'utf8');
test('pilot grant and revoke acquire the exact report tenant advisory lock',()=>{
 assert.match(source,/portal-pilot-lock-v1:/);
 assert.match(source,/pg_catalog\.pg_advisory_xact_lock\(pg_catalog\.hashtextextended/);
 assert.match(source,/async function grantPilotLocked[\s\S]*?await tx\.query\(pilotTenantLockSql,\[clientId\]\)/);
 assert.match(source,/async function revokePilotLocked[\s\S]*?await tx\.query\(pilotTenantLockSql,\[clientId\]\)/);
});
test('pilot writes remain review-only and never independently commit',()=>{
 assert.doesNotMatch(source,/\bCOMMIT\b|\bBEGIN\b|process\.env|fetch\(/);
 assert.match(source,/UPDATE public\.client_pilot_access SET revoked_at=/);
 assert.match(source,/ON CONFLICT\(client_id\) DO UPDATE/);
});
