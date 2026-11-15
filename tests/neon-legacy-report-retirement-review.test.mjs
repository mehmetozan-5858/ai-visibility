import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('legacy privileged report retirement is guarded and cannot execute in review',async()=>{
 const sql=await readFile(new URL('../docs/security/neon-legacy-report-retirement-review.sql',import.meta.url),'utf8');
 assert.match(sql,/v_owner_bypass IS DISTINCT FROM true/);
 assert.match(sql,/v_gateway IS DISTINCT FROM false/);
 assert.match(sql,/v_public IS DISTINCT FROM false/);
 assert.match(sql,/v_acl IS DISTINCT FROM/);
 assert.match(sql,/external JavaScript, jobs/);
 assert.match(sql,/^-- DROP FUNCTION public\.portal_trial_verified_report\(uuid,bigint,text\);/m);
 assert.equal(sql.split('\n').filter(l=>/^\s*DROP FUNCTION\b/i.test(l)).length,0);
 assert.equal(sql.split('\n').filter(l=>/^\s*COMMIT\s*;/i.test(l)).length,0);
 assert.match(sql,/^ROLLBACK;$/m);
});
