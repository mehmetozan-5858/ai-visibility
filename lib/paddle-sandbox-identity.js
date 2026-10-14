import {randomUUID} from 'node:crypto';
import {PADDLE_SANDBOX_CATALOG} from './paddle-sandbox-catalog.js';
import {sandboxEnabled} from './paddle-sandbox.js';
import {verifyClientToken} from './admin-auth.js';
import {verifySandboxSession,SANDBOX_SESSION_COOKIE} from './paddle-sandbox-session.js';

export async function sandboxClientSession(req,{verifySession=verifyClientToken}={}){
 const fixture=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(SANDBOX_SESSION_COOKIE+'='));
 if(fixture.length){if(fixture.length!==1)return null;return verifySandboxSession(fixture[0].slice(SANDBOX_SESSION_COOKIE.length+1))}
 const matches=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('ai_client='));
 if(matches.length!==1)return null;
 let session;try{session=await verifySession(decodeURIComponent(matches[0].slice(10)))}catch{return null}
 if(!session||!/^[a-zA-Z0-9_-]{1,100}$/.test(session.clientId||''))return null;
 return session;
}
export async function checkoutIntentRequest(req,{env=process.env,verifySession=verifyClientToken}={}){
 if(!sandboxEnabled(env))return {status:404};
 if(req.method!=='POST'||req.headers.get('origin')!==new URL(req.url).origin||!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return {status:403};
 const session=await sandboxClientSession(req,{verifySession});if(!session)return {status:401};
 let body;try{body=await req.json()}catch{return {status:400}}
 if(!body||Object.keys(body).some(x=>!['service','currency'].includes(x)))return {status:400};
 const row=Object.hasOwn(PADDLE_SANDBOX_CATALOG,body.service)?PADDLE_SANDBOX_CATALOG[body.service]:null;
 const priceId=row&&Object.hasOwn(row.prices,body.currency)?row.prices[body.currency]:null;
 if(typeof priceId!=='string')return {status:400};
 return {status:200,clientId:session.clientId,service:body.service,priceId,kind:body.service.includes('monitoring')?'monthly':'one-time'};
}
export async function createSandboxCheckoutIntent(input,db){
 const id=randomUUID();
 await db.query(`INSERT INTO paddle_sandbox_checkout_intents(id,client_id,service_code,price_id,kind,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '30 minutes')`,[id,input.clientId,input.service,input.priceId,input.kind]);
 return {intentId:id,priceId:input.priceId};
}

// Caller MUST already have verified the raw Paddle signature. Use the same event transaction.
export async function linkSandboxIntent(event,item,tx){
 const id=event.data?.custom_data?.checkout_intent_id;
 if(id===undefined)return; // Anonymous test checkout remains a recorded, unlinked event.
 if(typeof id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw Error('invalid-intent');
 const intent=(await tx.query('SELECT * FROM paddle_sandbox_checkout_intents WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!intent)throw Error('unknown-intent');
 if(item.priceIds.length!==1||item.priceIds[0]!==intent.price_id||event.data.items[0].quantity!==1)throw Error('intent-price-mismatch');
 const customer=event.data.customer_id;
 const sub=item.type.startsWith('subscription.')?item.entityId:event.data.subscription_id||null;
 const transaction=item.type.startsWith('transaction.')?item.entityId:null;
 if(!/^ctm_[a-z0-9]+$/.test(customer||'')||(sub&&!/^sub_[a-z0-9]+$/.test(sub)))throw Error('invalid-intent-entity');
 if(intent.kind==='one-time'&&sub)throw Error('intent-subscription-mismatch');
 if(intent.paddle_customer_id&&intent.paddle_customer_id!==customer)throw Error('intent-customer-mismatch');
 if(intent.subscription_id&&sub!==intent.subscription_id)throw Error('intent-subscription-mismatch');
 if(transaction&&intent.initial_transaction_id&&transaction!==intent.initial_transaction_id&&(!intent.subscription_id||sub!==intent.subscription_id))throw Error('intent-transaction-mismatch');
 // Provider occurrence time permits delayed delivery of an originally timely checkout.
 if(!intent.paddle_customer_id&&(Date.parse(item.occurredAt)<Date.parse(intent.created_at)-5000||Date.parse(item.occurredAt)>Date.parse(intent.expires_at)))throw Error('expired-intent');
 await tx.query('INSERT INTO paddle_sandbox_customers(customer_id,client_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[customer,intent.client_id]);
 const owner=(await tx.query('SELECT client_id FROM paddle_sandbox_customers WHERE customer_id=$1',[customer])).rows[0];
 if(owner?.client_id!==intent.client_id)throw Error('customer-already-linked');
 await tx.query(`UPDATE paddle_sandbox_checkout_intents SET paddle_customer_id=$2,subscription_id=COALESCE(subscription_id,$3),initial_transaction_id=COALESCE(initial_transaction_id,$4) WHERE id=$1`,[id,customer,sub,transaction]);
}
