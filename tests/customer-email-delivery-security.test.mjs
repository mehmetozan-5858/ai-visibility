import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const source=(await readFile(new URL('../lib/email-verification.js',import.meta.url),'utf8'))
 .replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
function sender(fetchImpl){
 return new Function('crypto','getDatabaseUrl','fetch',source+';return sendVerificationEmail;')(
  crypto,()=>'',fetchImpl);
}
test('verification delivery rejects invalid input, sanitizes failures and never reads provider bodies',async()=>{
 const oldKey=process.env.RESEND_API_KEY,oldFrom=process.env.EMAIL_FROM;
 process.env.RESEND_API_KEY='synthetic-key';process.env.EMAIL_FROM='sender@example.test';
 let calls=0,bodyReads=0;
 try{
  const send=sender(async()=>{calls++;return {ok:false,status:403,text:async()=>{bodyReads++;return 'private-code-recipient-and-key'}}});
  await assert.rejects(send('invalid','123456'),/invalid-email-verification/);
  await assert.rejects(send('owner@example.test','<script>'),/invalid-email-verification/);
  assert.equal(calls,0);
  await assert.rejects(send('owner@example.test','123456'),e=>e.message==='email-send-failed'&&e.status===403);
  assert.equal(calls,1);assert.equal(bodyReads,0);
  await assert.rejects(sender(async()=>{throw Error('private-network-details')})('owner@example.test','123456'),e=>e.message==='email-send-failed');
  let request;
  assert.equal(await sender(async(url,options)=>{request=options;return {ok:true}})(' Owner@Example.Test ','123456'),true);
  assert.deepEqual(JSON.parse(request.body).to,['owner@example.test']);
  assert.ok(request.signal instanceof AbortSignal);
 }finally{
  if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;
  if(oldFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=oldFrom;
 }
});

test('customer email proof consumes a code once and refuses expired and malformed codes against SQL',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE client_email_verifications(id UUID PRIMARY KEY,client_id UUID,email TEXT,code_hash TEXT,expires_at TIMESTAMPTZ,verified_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW())`);
  const start=source.indexOf('async function withDb('),end=source.indexOf('function normalizeEmail',start);
  const isolated=source.slice(0,start)+'const withDb=fn=>fn(db);\n'+source.slice(end);
  const verify=new Function('crypto','db',isolated+';return verifyEmailCode;')(crypto,db);
  const client='11111111-1111-4111-8111-111111111111';
  await db.query(`INSERT INTO client_email_verifications(id,client_id,email,code_hash,expires_at) VALUES($1,$2,'owner@example.test',$3,NOW()+INTERVAL '10 minutes')`,['22222222-2222-4222-8222-222222222222',client,crypto.createHash('sha256').update('123456').digest('hex')]);
  assert.equal(await verify(client,'other@example.test','123456'),null);
  assert.equal(await verify(client,'owner@example.test',123456),null);
  assert.equal(await verify(client,'owner@example.test','000000'),null);
  assert.ok(await verify(client,'owner@example.test','123456'));
  assert.equal(await verify(client,'owner@example.test','123456'),null);
  await db.exec(`UPDATE client_email_verifications SET verified_at=NULL,expires_at=NOW()-INTERVAL '1 minute'`);
  assert.equal(await verify(client,'owner@example.test','123456'),null);
 }finally{await db.close()}
});
