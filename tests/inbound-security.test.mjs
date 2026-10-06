import test from 'node:test';
import assert from 'node:assert/strict';
import {Webhook} from 'svix';
import {verifyInboundWebhook,trustedInbound,inboundText,mailbox} from '../lib/inbound-validation.js';
const secret='whsec_'+Buffer.alloc(32,7).toString('base64');
const payload=JSON.stringify({type:'email.received',data:{email_id:'email-123'}});
function signed(date=new Date()){
 const id='msg_test';return new Headers({'svix-id':id,'svix-timestamp':String(Math.floor(date.getTime()/1000)),'svix-signature':new Webhook(secret).sign(id,date,payload)});
}
test('webhooks reject forged payloads and stale timestamps',()=>{
 assert.equal(verifyInboundWebhook(payload,signed(),secret).type,'email.received');
 assert.throws(()=>verifyInboundWebhook(payload+' ',signed(),secret));
 assert.throws(()=>verifyInboundWebhook(payload,signed(new Date(Date.now()-600000)),secret));
 assert.throws(()=>verifyInboundWebhook(payload,new Headers(),secret));
});
test('unsigned sender identity and wrong recipients require human review',()=>{
 const email={to:['Inbox <reply@example.com>'],authentication:{dmarc:'pass'}};
 assert.equal(trustedInbound(email,'reply@example.com'),true);
 assert.equal(trustedInbound({...email,authentication:{dmarc:'fail'}},'reply@example.com'),false);
 assert.equal(trustedInbound(email,'other@example.com'),false);
 assert.equal(mailbox('Name <sender@example.com>'),'sender@example.com');
 assert.equal(inboundText({html:'<script>steal()</script><p>Hello</p>'}),'Hello');
});
