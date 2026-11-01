import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {databasePool} from './database-runtime.js';
import {getDatabaseUrl} from './db.js';

const ALLOWED_EVENTS=new Set([
  'transaction.completed','transaction.payment_failed',
  'transaction.paid','transaction.past_due',
  'subscription.created','subscription.activated','subscription.updated',
  'subscription.paused','subscription.resumed','subscription.canceled','subscription.past_due'
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function verifyPaddleLiveSignature(raw,header,secret,{now=Date.now(),tolerance=300}={}){
  if(!secret||typeof raw!=='string'||typeof header!=='string')return false;
  const parts=header.split(';').map(part=>part.trim().split('='));
  const timestamps=parts.filter(([key])=>key==='ts');
  if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]||''))return false;
  const ts=Number(timestamps[0][1]);
  if(!Number.isSafeInteger(ts)||Math.abs(now/1000-ts)>tolerance)return false;
  const expected=createHmac('sha256',secret).update(`${timestamps[0][1]}:${raw}`).digest();
  return parts.filter(([key])=>key==='h1').some(([,value])=>{
    if(!/^[a-f0-9]{64}$/i.test(value||''))return false;
    return timingSafeEqual(expected,Buffer.from(value,'hex'));
  });
}

export function normalizePaddleLiveEvent(event){
  const id=String(event?.event_id||'');
  const type=String(event?.event_type||'');
  const occurredAt=String(event?.occurred_at||'');
  if(!/^(?:evt|ntfsimevt)_[a-z0-9]+$/i.test(id)||!Number.isFinite(Date.parse(occurredAt)))throw Error('invalid-event');
  if(!ALLOWED_EVENTS.has(type))return null;
  const data=event?.data&&typeof event.data==='object'?event.data:{};
  const entityId=String(data.id||'');
  const expectedPrefix=type.startsWith('subscription.')?'sub_':'txn_';
  if(!entityId.startsWith(expectedPrefix))throw Error('invalid-entity');
  const custom=data.custom_data&&typeof data.custom_data==='object'?data.custom_data:{};
  const paymentId=String(custom.payment_id||custom.paymentId||'');
  const clientId=String(custom.client_id||custom.clientId||'');
  return {id,type,occurredAt,entityId,status:String(data.status||''),paymentId,clientId,data};
}

export function subscriptionAccessState(item){
  if(!String(item?.type||'').startsWith('subscription.'))return null;
  const type=String(item.type),status=String(item.status||'').toLowerCase();
  if(['subscription.paused','subscription.canceled','subscription.past_due'].includes(type)||['paused','canceled','past_due'].includes(status))return 'payment-review';
  if(['subscription.activated','subscription.resumed'].includes(type)||(type==='subscription.updated'&&status==='active'))return 'active';
  return null;
}

export function transactionPricedAmount(data){
  const items=Array.isArray(data?.items)?data.items:[];
  if(!items.length)return null;
  let total=0;
  for(const item of items){
    const raw=item?.price?.unit_price?.amount;
    const quantity=Number(item?.quantity??1);
    if(!/^\d+$/.test(String(raw??''))||!Number.isSafeInteger(quantity)||quantity<1)return null;
    const amount=Number(raw);
    if(!Number.isSafeInteger(amount)||amount<0)return null;
    total+=amount*quantity;
    if(!Number.isSafeInteger(total))return null;
  }
  return total;
}

export function isPaddleRenewal(item){
  return item?.type==='transaction.completed'&&String(item?.data?.origin||'').toLowerCase()==='subscription_recurring';
}

export function expectedPaddleItemAmount(item,payment){
  const setup=Number(payment?.setup_amount),monthly=Number(payment?.monthly_amount);
  if(!Number.isSafeInteger(setup)||setup<0||!Number.isSafeInteger(monthly)||monthly<0)return null;
  const units=isPaddleRenewal(item)?monthly:setup+monthly;
  return Number.isSafeInteger(units)&&units>0&&Number.isSafeInteger(units*100)?units*100:null;
}

async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS paddle_live_events(
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    payment_id UUID,
    client_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS paddle_live_subscription_origins(
    subscription_id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS paddle_live_subscription_links(
    subscription_id TEXT PRIMARY KEY,
    payment_id UUID NOT NULL,
    client_id UUID NOT NULL,
    transaction_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS paddle_live_entities(
    entity_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '',
    payment_id UUID,
    client_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    event_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

function transactionCurrency(data){return String(data?.currency_code||data?.currency||'').toUpperCase()}

async function recordRenewalPayment(tx,item,payment){
  if(!isPaddleRenewal(item)||payment.status!=='paid'||Number(payment.monthly_amount)<=0)return {renewalRecorded:false};
  const reference=`PADDLE-${item.entityId}`.toUpperCase();
  const row=(await tx.query(`INSERT INTO payments(
      id,client_id,reference_code,method,status,plan,setup_amount,monthly_amount,currency,
      service_start_consent_at,terms_version,paid_at
    ) VALUES($1,$2,$3,'paddle','paid',$4,0,$5,$6,$7,$8,$9)
    ON CONFLICT(reference_code) DO NOTHING RETURNING id`,[
    randomUUID(),item.clientId,reference,payment.plan,Number(payment.monthly_amount)||0,payment.currency||'',
    payment.service_start_consent_at||null,payment.terms_version||null,item.occurredAt
  ])).rows[0];
  return {renewalRecorded:Boolean(row),renewalPaymentId:row?.id};
}

async function applyTransaction(tx,item){
  if(!UUID.test(item.paymentId)||!UUID.test(item.clientId))return {linked:false,reason:'missing-payment-link'};
  const payment=(await tx.query(`SELECT id,client_id,status,currency,plan,setup_amount,monthly_amount,service_start_consent_at,terms_version
    FROM payments WHERE id=$1 AND client_id=$2 FOR UPDATE`,[item.paymentId,item.clientId])).rows[0];
  if(!payment)return {linked:false,reason:'payment-not-found'};
  const currency=transactionCurrency(item.data);
  const pricedAmount=transactionPricedAmount(item.data);
  const expected=expectedPaddleItemAmount(item,payment);
  if(!currency||!payment.currency||currency!==payment.currency)return {linked:false,reason:'currency-mismatch'};
  if(pricedAmount===null||expected===null||pricedAmount!==expected)return {linked:false,reason:'amount-mismatch'};
  if(item.type==='transaction.completed'){
    const subscriptionId=String(item.data?.subscription_id||'');
    if(/^sub_[a-z0-9]+$/i.test(subscriptionId)){
      const link=await tx.query(`INSERT INTO paddle_live_subscription_links(subscription_id,payment_id,client_id,transaction_id)
        VALUES($1,$2,$3,$4) ON CONFLICT(subscription_id) DO UPDATE SET subscription_id=EXCLUDED.subscription_id
        WHERE paddle_live_subscription_links.payment_id=EXCLUDED.payment_id
        AND paddle_live_subscription_links.client_id=EXCLUDED.client_id RETURNING subscription_id`,
        [subscriptionId,item.paymentId,item.clientId,item.entityId]);
      if(!link.rows.length)return {linked:false,paymentChanged:false,reason:'subscription-link-conflict'};
    }
    const renewal=await recordRenewalPayment(tx,item,payment);
    if(renewal.renewalRecorded){
      await tx.query("UPDATE clients SET plan=$2,status='active' WHERE id=$1",[item.clientId,payment.plan]);
      return {linked:true,paymentChanged:true,paymentStatus:'paid',...renewal};
    }
    if(isPaddleRenewal(item))return {linked:true,paymentChanged:false,paymentStatus:'paid',...renewal};
    const updated=(await tx.query(`UPDATE payments SET status='paid',method='paddle',paid_at=COALESCE(paid_at,NOW())
      WHERE id=$1 AND client_id=$2 AND status NOT IN ('paid','refunded')
      RETURNING id,client_id,plan,status`,[item.paymentId,item.clientId])).rows[0];
    if(updated)await tx.query("UPDATE clients SET plan=$2,status='active' WHERE id=$1",[updated.client_id,updated.plan]);
    return {linked:true,paymentChanged:Boolean(updated),paymentStatus:'paid'};
  }
  if(item.type==='transaction.paid'||item.type==='transaction.past_due'){
    // A pending/overdue provider event is not final settlement evidence.
    return {linked:true,paymentChanged:false,paymentStatus:payment.status};
  }
  if(item.type==='transaction.payment_failed'){
    const updated=(await tx.query(`UPDATE payments SET status='failed',method='paddle'
      WHERE id=$1 AND client_id=$2 AND status NOT IN ('paid','refunded') RETURNING id`,[item.paymentId,item.clientId])).rows[0];
    return {linked:true,paymentChanged:Boolean(updated),paymentStatus:updated?'failed':payment.status};
  }
  return {linked:true,paymentChanged:false,paymentStatus:payment.status};
}

async function applySubscriptionAccess(tx,item){
  if(!UUID.test(item.clientId)||!UUID.test(item.paymentId))return {linked:false,accessChanged:false,reason:'missing-payment-link'};
  // A signed subscription event still needs an existing tenant-owned payment link.
  const owned=(await tx.query("SELECT id FROM payments WHERE id=$1 AND client_id=$2 FOR UPDATE",[item.paymentId,item.clientId])).rows[0];
  if(!owned)return {linked:false,accessChanged:false,reason:'payment-not-found'};
  const link=(await tx.query(`SELECT subscription_id FROM paddle_live_subscription_links
    WHERE subscription_id=$1 AND payment_id=$2 AND client_id=$3 FOR UPDATE`,
    [item.entityId,item.paymentId,item.clientId])).rows[0];
  if(!link)return {linked:false,accessChanged:false,reason:'subscription-link-unverified'};
  const nextStatus=subscriptionAccessState(item);
  if(!nextStatus)return {linked:true,accessChanged:false};
  if(nextStatus==='active'){
    const updated=(await tx.query(`UPDATE clients SET status='active' WHERE id=$1 AND EXISTS(
      SELECT 1 FROM payments WHERE client_id=$1 AND status='paid'
    ) AND status IS DISTINCT FROM 'active' RETURNING id`,[item.clientId])).rows[0];
    return {linked:true,accessChanged:Boolean(updated),clientStatus:updated?'active':undefined};
  }
  const updated=(await tx.query(`UPDATE clients SET status='payment-review' WHERE id=$1 AND status IS DISTINCT FROM 'payment-review' RETURNING id`,[item.clientId])).rows[0];
  return {linked:true,accessChanged:Boolean(updated),clientStatus:updated?'payment-review':undefined};
}

export async function recordPaddleLiveEvent(event){
  const item=normalizePaddleLiveEvent(event);
  if(!item)return {ignored:true};
  const url=getDatabaseUrl();
  if(!url)throw Error('database-unavailable');
  const pool=databasePool(url);await ensure(pool);
  const tx=await pool.connect();
  try{
    await tx.query('BEGIN');
    const inserted=(await tx.query(`INSERT INTO paddle_live_events(event_id,event_type,entity_id,occurred_at,payment_id,client_id)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id`,[
      item.id,item.type,item.entityId,item.occurredAt,UUID.test(item.paymentId)?item.paymentId:null,UUID.test(item.clientId)?item.clientId:null
    ])).rows[0];
    if(!inserted){await tx.query('COMMIT');return {duplicate:true};}
    // Capture provider-origin transaction identity from signed subscription.created even
    // when custom_data is missing. This table never grants access by itself.
    if(item.type==='subscription.created'&&/^txn_[a-z0-9]+$/i.test(String(item.data?.transaction_id||''))){
      const saved=await tx.query(`INSERT INTO paddle_live_subscription_origins(subscription_id,transaction_id)
        VALUES($1,$2) ON CONFLICT(subscription_id) DO UPDATE SET subscription_id=EXCLUDED.subscription_id
        WHERE paddle_live_subscription_origins.transaction_id=EXCLUDED.transaction_id RETURNING subscription_id`,
        [item.entityId,item.data.transaction_id]);
      if(!saved.rows.length)throw Error('subscription-origin-conflict');
    }
    const paymentResult=item.type.startsWith('transaction.')?await applyTransaction(tx,item):{linked:UUID.test(item.paymentId)&&UUID.test(item.clientId),paymentChanged:false};
    const entityChanged=(await tx.query(`INSERT INTO paddle_live_entities(entity_id,event_type,status,payment_id,client_id,occurred_at,event_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(entity_id) DO UPDATE SET event_type=EXCLUDED.event_type,status=EXCLUDED.status,payment_id=COALESCE(EXCLUDED.payment_id,paddle_live_entities.payment_id),client_id=COALESCE(EXCLUDED.client_id,paddle_live_entities.client_id),occurred_at=EXCLUDED.occurred_at,event_id=EXCLUDED.event_id,updated_at=NOW()
      WHERE (paddle_live_entities.occurred_at,paddle_live_entities.event_id)<(EXCLUDED.occurred_at,EXCLUDED.event_id)
      RETURNING entity_id`,[
      item.entityId,item.type,item.status,UUID.test(item.paymentId)?item.paymentId:null,UUID.test(item.clientId)?item.clientId:null,item.occurredAt,item.id
    ])).rows[0];
    let subscriptionResult=item.type.startsWith('subscription.')
      ?entityChanged?await applySubscriptionAccess(tx,item):{linked:UUID.test(item.clientId),accessChanged:false,stale:true}
      :{};
    // Paddle may deliver subscription events before transaction.completed.
    // Reconcile only after validated settlement and an exact tenant-owned subscription link.
    if(item.type==='transaction.completed'&&paymentResult.linked===true&&
       paymentResult.paymentStatus==='paid'&&
       /^sub_[a-z0-9]+$/i.test(String(item.data?.subscription_id||''))){
      const origin=(await tx.query(`SELECT transaction_id FROM paddle_live_subscription_origins
        WHERE subscription_id=$1 AND transaction_id=$2 FOR UPDATE`,
        [item.data.subscription_id,item.entityId])).rows[0];
      const prior=origin?(await tx.query(`SELECT event_type,status,occurred_at,event_id FROM paddle_live_entities
        WHERE entity_id=$1 AND (payment_id=$2 OR payment_id IS NULL)
        AND (client_id=$3 OR client_id IS NULL)
        AND event_type LIKE 'subscription.%' FOR UPDATE`,
        [item.data.subscription_id,item.paymentId,item.clientId])).rows[0]:null;
      if(prior){
        subscriptionResult=await applySubscriptionAccess(tx,{
          entityId:item.data.subscription_id,paymentId:item.paymentId,clientId:item.clientId,
          type:prior.event_type,status:prior.status,occurredAt:prior.occurred_at
        });
      }
    }
    await tx.query('COMMIT');
    return {recorded:true,eventType:item.type,...paymentResult,...subscriptionResult};
  }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error}finally{tx.release()}
}
