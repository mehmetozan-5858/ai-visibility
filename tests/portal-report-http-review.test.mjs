import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalReportHttpReview} from '../lib/portal-report-http-review.mjs';

test('review HTTP adapter returns private authorized empty or populated report',async()=>{
 const read=createPortalReportHttpReview(async()=>[]);
 const ok=await read('synthetic-cookie');
 assert.equal(ok.status,200);
 assert.equal(ok.headers.get('Cache-Control'),'private, no-store, max-age=0');
 assert.equal(ok.headers.get('Pragma'),'no-cache');
 assert.equal(ok.headers.get('Vary'),'Cookie, Accept-Language');
 assert.deepEqual(await ok.json(),{authorized:true,reports:[]});
 const report=await createPortalReportHttpReview(async()=>[{clientId:'synthetic-tenant'}])('synthetic');
 assert.equal(report.status,200);
 assert.equal((await report.json()).reports.length,1);
});
test('missing, invalid session and revoked preflight cannot return reports',async()=>{
 const missing=await createPortalReportHttpReview(async()=>{throw Error('must-not-call')})('');
 assert.equal(missing.status,401);
 for(const [error,status,publicCode] of [
  ['review-envelope-customer-session-required',401,'customer-session-required'],
  ['review-envelope-entitlement-denied',403,'verified-pilot-entitlement-required'],
  ['report-envelope-authorization-unproven',503,'verified-report-unavailable'],
  ['review-envelope-role-unverified',503,'verified-report-unavailable'],
  ['synthetic private SQL credentials error',503,'verified-report-unavailable']
 ]){
  const response=await createPortalReportHttpReview(async()=>{throw Error(error)})('synthetic');
  assert.equal(response.status,status);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  const body=await response.json();
  assert.deepEqual(body,{error:publicCode});
  assert.ok(!JSON.stringify(body).includes(error));
 }
});
test('unexpected response shapes and unavailable gateway never advertise successful report',async()=>{
 assert.throws(()=>createPortalReportHttpReview(null),/review-http-gateway-unavailable/);
 for(const value of [null,undefined,{},false]){
  const response=await createPortalReportHttpReview(async()=>value)('synthetic');
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'verified-report-unavailable'});
 }
});
