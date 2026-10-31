import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {reportRecipient,customerReportDeliveryKey,createCustomerReportEmailHandler} from '../lib/customer-report-delivery.mjs';
const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('recipient requires matching verified credential for the same customer, without provisioning',async()=>{
 const db=new PGlite();try{
  const pool={query:(sql,args)=>db.query(sql,args)};assert.equal(await reportRecipient(pool,own),null);
  await db.exec(`CREATE TABLE client_credentials(client_id UUID,email TEXT);CREATE TABLE client_email_verifications(client_id UUID,email TEXT,verified_at TIMESTAMPTZ);
   INSERT INTO client_credentials VALUES('${own}','own@example.org');INSERT INTO client_email_verifications VALUES('${other}','own@example.org',NOW()),('${own}','different@example.org',NOW())`);
  assert.equal(await reportRecipient(pool,own),null);
  await db.query('INSERT INTO client_email_verifications VALUES($1,$2,NOW())',[own,'OWN@example.org']);
  assert.equal(await reportRecipient(pool,own),'own@example.org');
 }finally{await db.close()}
});
function fixture(changes={}){
 const sends=[],reads=[];
 const dependencies={guard:async()=>null,authorize:async()=>({clientId:own}),getAccount:async()=>({client:{id:own,name:'Fixture'},scans:[]}),getAccess:async()=>({allowed:true,kind:'pilot',email:'own@example.org'}),getPool:()=>({}),getRecipient:async(_pool,id)=>{reads.push(id);return 'own@example.org'},readComparisons:async(_pool,id)=>[{clientId:id,query:'fixture',results:[]}],buildReport:async()=>new Response('fixture PDF'),deliver:async(key,payload)=>{sends.push({key,payload});return {duplicate:false}},settings:()=>({RESEND_API_KEY:'fixture',RESEND_FROM_EMAIL:'reports@example.org'}),...changes};
 const handler=createCustomerReportEmailHandler(dependencies);
 const request=body=>new Request('https://example.org/api/client-portal/report/email',{method:'POST',body:JSON.stringify(body??{confirmSendReport:true}),headers:{'content-type':'application/json'}});
 return {handler,sends,reads,request};
}
test('explicit request sends only to own verified address with PDF attachment and reports acceptance accurately',async()=>{
 const f=fixture(),r=await f.handler(f.request());assert.equal(r.status,200);assert.deepEqual(f.reads,[own]);
 assert.deepEqual(f.sends[0].payload.to,['own@example.org']);assert.equal(Buffer.from(f.sends[0].payload.attachments[0].content,'base64').toString(),'fixture PDF');
 assert.equal((await r.json()).status,'provider-accepted');assert.match(r.headers.get('cache-control'),/private.*no-store/);
});
test('foreign selectors, missing auth/access/configuration/recipient/report never send',async()=>{
 const variants=[{authorize:async()=>null},{getAccess:async()=>({allowed:false})},{settings:()=>({})},{getRecipient:async()=>null},{getAccess:async()=>({allowed:true,kind:'pilot',email:'other@example.org'})},{readComparisons:async()=>[]}];
 for(const config of variants){const f=fixture(config);assert.ok((await f.handler(f.request())).status>=400);assert.equal(f.sends.length,0)}
 const f=fixture();assert.equal((await f.handler(f.request({confirmSendReport:true,to:'other@example.org'}))).status,400);assert.equal(f.sends.length,0);assert.deepEqual(f.reads,[]);
});
test('same snapshot and mailbox keep one delivery key; new recipient or report gets a distinct key',()=>{
 const data={clientId:own,email:'own@example.org',report:{query:'fixture'}};
 assert.equal(customerReportDeliveryKey(data),customerReportDeliveryKey({...data}));
 assert.notEqual(customerReportDeliveryKey(data),customerReportDeliveryKey({...data,email:'other@example.org'}));
 assert.notEqual(customerReportDeliveryKey(data),customerReportDeliveryKey({...data,report:{query:'new'}}));
});
