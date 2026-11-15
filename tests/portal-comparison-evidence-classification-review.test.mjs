import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// REVIEW ONLY. Guard against treating historical SQL rows as live AI evidence.
// No production credentials, customer records or paid provider calls.
test('customer portal never marks legacy comparisons as verified provider evidence',async()=>{
 const src=await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8');
 const unavailable="reportEvidence={available:false,comparisonCount:0,";
 assert.ok(src.includes(unavailable));
 assert.match(src,/evidenceClass:'unknown',verifiedProviderEvidence:false/);
 const assignments=[...src.matchAll(/reportEvidence=\{available:true,comparisonCount:rows\.length,\s*evidenceClass:'historical',verifiedProviderEvidence:false\}/g)];
 assert.equal(assignments.length,2,'strict and legacy comparison reads are historical, not live provider receipts');
 assert.doesNotMatch(src,/verifiedProviderEvidence:true/);
 assert.match(src,/if\(process\.env\.PORTAL_TENANT_RLS_ENABLED==='true'\)/);
});
