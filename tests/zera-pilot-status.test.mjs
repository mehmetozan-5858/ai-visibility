import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../app/api/clients/zera-pilot-status/route.js',import.meta.url),'utf8');
test('combined pilot status is admin-only, read-only and seven-task aware',()=>{
 assert.match(route,/requireAdmin\(req\)/);
 assert.match(route,/ZERA_TASKS\.map/);
 assert.match(route,/zeraAttemptsSelectQuery/);
 assert.match(route,/zera_google_evidence_reviews/);
 assert.match(route,/zera_owned_site_observations/);
 assert.doesNotMatch(route,/INSERT INTO|ALTER TABLE|CREATE TABLE|compareCustomerProviders|collectZeraOwnedSite/);
 assert.match(route,/providerCallsExecuted:0/);
 assert.match(route,/visibilityScore:null/);
});
