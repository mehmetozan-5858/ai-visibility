import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verifyHash} from '../lib/client-password-verifier.mjs';
import {verifyClientToken} from '../lib/admin-auth.js';
import {issueExistingPasswordSessionReview} from '../lib/portal-existing-password-session-review.mjs';
import {createPortalReportHttpReview} from '../lib/portal-report-http-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const secret='synthetic-session-only-secret-2026';
const oldSecret=process.env.AUTH_SECRET;

test('existing password only: correct credentials sign tenant session; bad credentials cannot open report',{
 concurrency:false
},async()=>{
 process.env.AUTH_SECRET=secret;
 try{
  const password='existing-customer-passphrase-do-not-reset';
  const storedHash=hashPassword(password);
  const initialHash=storedHash;
  let verifies=0,reportReads=0,resetCalls=0;
  const verifyExisting=async(email,input)=>{
   verifies++;
   if(email!=='owner@example.com'||!verifyHash(input,storedHash))return null;
   return {clientId:A,email:'owner@example.com'};
  };
  const http=createPortalReportHttpReview(async(token)=>{
   const identity=await verifyClientToken(token);
   if(!identity||identity.clientId!==A)throw Error('review-envelope-customer-session-required');
   reportReads++;
   return [{clientId:A,query:'synthetic report',results:{}}];
  });
  for(const input of ['wrong-password','',password+'-changed']){
   const token=await issueExistingPasswordSessionReview({
    email:'OWNER@example.com',password:input,verifyExisting
   }).catch(error=>{assert.equal(error.message,'review-login-invalid-request');return null});
   assert.equal(token,null);
   assert.equal((await http(token||'')).status,401);
  }
  assert.equal(reportReads,0);
  const token=await issueExistingPasswordSessionReview({
   email:' OWNER@EXAMPLE.COM ',password,verifyExisting
  });
  assert.equal((await verifyClientToken(token)).clientId,A);
  const authorized=await http(token);
  assert.equal(authorized.status,200);
  assert.equal(authorized.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.deepEqual((await authorized.json()).reports.map(r=>r.clientId),[A]);
  assert.equal(reportReads,1);
  assert.equal(storedHash,initialHash);
  assert.equal(resetCalls,0,'no password reset or replacement ever occurs');
  assert.ok(verifies>=3);
 }finally{
  if(oldSecret===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=oldSecret;
 }
});
test('verified identity mismatch cannot mint a session or query a report',{concurrency:false},async()=>{
 process.env.AUTH_SECRET=secret;
 try{
  let reads=0;
  const http=createPortalReportHttpReview(async()=>{
   reads++;return [{clientId:B}];
  });
  for(const identity of [
   {clientId:B,email:'other@example.com'},
   {clientId:'untrusted',email:'owner@example.com'}
  ]){
   await assert.rejects(issueExistingPasswordSessionReview({
    email:'owner@example.com',password:'correct-password',
    verifyExisting:async()=>identity
   }),/review-login-untrusted-identity/);
  }
  assert.equal((await http('')).status,401);
  assert.equal(reads,0);
 }finally{
  if(oldSecret===undefined)delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET=oldSecret;
 }
});
