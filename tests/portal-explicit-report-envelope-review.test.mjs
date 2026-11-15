import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeAuthorizedReportEnvelopeReview as decode}
 from '../lib/portal-explicit-report-envelope-review.mjs';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
test('explicit authorized and genuinely empty report is distinguishable from denial',()=>{
 assert.deepEqual(decode([{authorized:true,tenantId:A,reports:[]}],A),
  {authorized:true,reports:[]});
 for(const rows of [[],[{}],[{authorized:false,tenantId:A,reports:[]}],
  [{authorized:true,tenantId:B,reports:[]}],
  [{authorized:true,tenantId:A}],
  [{authorized:true,tenantId:A,reports:[]},{authorized:true,tenantId:A,reports:[]}]])
  assert.throws(()=>decode(rows,A),/report-envelope-authorization-unproven/);
});
test('cross-tenant rows and malformed data are never returned',()=>{
 assert.throws(()=>decode([{authorized:true,tenantId:A,
  reports:[{clientId:B,query:'other tenant'}]}],A),
  /report-envelope-cross-tenant-denied/);
 assert.throws(()=>decode([{authorized:true,tenantId:A,reports:[null]}],A),
  /report-envelope-cross-tenant-denied/);
 assert.throws(()=>decode([{authorized:true,tenantId:A,reports:Array(21).fill({clientId:A})}],A),
  /report-envelope-authorization-unproven/);
});
test('no tenant or caller-supplied success flag can bypass envelope validation',()=>{
 assert.throws(()=>decode([{authorized:true,tenantId:A,reports:[]}],'not-a-uuid'),
  /report-envelope-tenant-invalid/);
 assert.throws(()=>decode([{authorized:'true',tenantId:A,reports:[]}],A),
  /report-envelope-authorization-unproven/);
});
